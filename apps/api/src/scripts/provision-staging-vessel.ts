import 'reflect-metadata';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import {
  createDatabaseConfig,
  DEFAULT_APPLICATION_DATABASE_ROLE,
  DEFAULT_RUNTIME_DATABASE_POOL_MAX,
} from '../config/database.config';
import { Vessel } from '../modules/bulk/entities/vessel.entity';
import { VesselsService } from '../modules/bulk/vessels/vessels.service';
import { Organization } from '../modules/cross-cutting/entities/organization.entity';
import { TenantContextService } from '../modules/cross-cutting/tenant-context/tenant-context.service';
import { Voyage } from '../modules/bulk/entities/voyage.entity';
import { deriveOrganizationId } from './provision-staging-user';

const DEFAULT_ORGANIZATION_NAME = 'Demurrage Defender Staging';
const DEFAULT_ORGANIZATION_SLUG = 'demurrage-defender-staging';
const DEFAULT_VESSEL_NAME = 'MV Staging Explorer';
const DEFAULT_VESSEL_IMO = '7999001';
const DEFAULT_VESSEL_FLAG = 'Panama';
const DEFAULT_VESSEL_TYPE = 'Bulk Carrier';
const DEFAULT_VESSEL_DWT = 50000;
const PROVISION_CONFIRMATION = 'provision-staging-vessel';

export interface ProvisionVesselInput {
  databaseUrl: string;
  organizationSlug: string;
  organizationName: string;
  vesselName: string;
  vesselImo: string;
  vesselFlag: string;
  vesselType: string;
  vesselDwt: number;
}

export interface ProvisionVesselResult {
  organizationId: string;
  organizationSlug: string;
  vesselId: string;
  vesselName: string;
  vesselImo: string;
  runtimeRole: string;
  tenantContextCleared: boolean;
  frontendLookupVisible: boolean;
}

type VesselIdentity = {
  organizationId: string;
  organizationSlug: string;
  vesselId: string;
  vesselName: string;
  vesselImo: string;
};

type RepoBundle = {
  organizations: Repository<Organization>;
  vessels: Repository<Vessel>;
};

function readPositiveInteger(value: string | undefined, label: string): number {
  if (!value?.trim()) {
    throw new Error(`${label} is required.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

export function readProvisionVesselInput(
  env: NodeJS.ProcessEnv = process.env,
): ProvisionVesselInput {
  if (env.PROVISION_CONFIRM?.trim() !== PROVISION_CONFIRMATION) {
    throw new Error(
      `PROVISION_CONFIRM must be exactly "${PROVISION_CONFIRMATION}" to run this command.`,
    );
  }

  const databaseUrl = env.PROVISION_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('PROVISION_DATABASE_URL is required.');
  }

  const vesselImo = env.PROVISION_VESSEL_IMO?.trim() || DEFAULT_VESSEL_IMO;
  if (!/^\d{7}$/.test(vesselImo)) {
    throw new Error('PROVISION_VESSEL_IMO must be exactly 7 digits.');
  }

  return {
    databaseUrl,
    organizationSlug:
      env.PROVISION_ORGANIZATION_SLUG?.trim() || DEFAULT_ORGANIZATION_SLUG,
    organizationName:
      env.PROVISION_ORGANIZATION_NAME?.trim() || DEFAULT_ORGANIZATION_NAME,
    vesselName: env.PROVISION_VESSEL_NAME?.trim() || DEFAULT_VESSEL_NAME,
    vesselImo,
    vesselFlag: env.PROVISION_VESSEL_FLAG?.trim() || DEFAULT_VESSEL_FLAG,
    vesselType: env.PROVISION_VESSEL_TYPE?.trim() || DEFAULT_VESSEL_TYPE,
    vesselDwt: env.PROVISION_VESSEL_DWT?.trim()
      ? readPositiveInteger(env.PROVISION_VESSEL_DWT, 'PROVISION_VESSEL_DWT')
      : DEFAULT_VESSEL_DWT,
  };
}

async function enterProvisioningRole(runner: QueryRunner): Promise<void> {
  await runner.query(`SET LOCAL ROLE ${DEFAULT_APPLICATION_DATABASE_ROLE}`);
}

async function establishTenantContext(
  runner: QueryRunner,
  organizationId: string,
): Promise<void> {
  await runner.query(
    `SELECT
       set_config('app.current_tenant_id', $1, true),
       set_config('app.current_user_id', '', true)`,
    [organizationId],
  );
}

async function ensureTrustedOrganization(
  organizations: Repository<Organization>,
  organizationId: string,
  input: ProvisionVesselInput,
): Promise<Organization> {
  const organization = await organizations.findOne({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error(
      `Organization slug "${input.organizationSlug}" is not provisioned.`,
    );
  }

  if (organization.slug !== input.organizationSlug) {
    throw new Error(
      `Organization ${organizationId} exists with a different slug.`,
    );
  }

  if (organization.name !== input.organizationName) {
    throw new Error(
      `Organization slug "${input.organizationSlug}" exists with a different name.`,
    );
  }

  return organization;
}

function sameVesselShape(
  vessel: Pick<Vessel, 'name' | 'imo' | 'flag' | 'type' | 'dwt' | 'organizationId'>,
  input: ProvisionVesselInput,
  organizationId: string,
): boolean {
  return (
    vessel.organizationId === organizationId &&
    vessel.name === input.vesselName &&
    vessel.imo === input.vesselImo &&
    vessel.flag === input.vesselFlag &&
    vessel.type === input.vesselType &&
    vessel.dwt === input.vesselDwt
  );
}

async function ensureVessel(
  vessels: Repository<Vessel>,
  organizationId: string,
  input: ProvisionVesselInput,
): Promise<Vessel> {
  const existingByImo = await vessels.findOne({
    where: { imo: input.vesselImo },
  });
  const existingByName = await vessels.findOne({
    where: {
      organizationId,
      name: input.vesselName,
    },
  });

  if (
    existingByImo &&
    existingByImo.organizationId !== organizationId
  ) {
    throw new Error(
      `IMO "${input.vesselImo}" is already assigned to another organization.`,
    );
  }

  if (
    existingByImo &&
    !sameVesselShape(existingByImo, input, organizationId)
  ) {
    throw new Error(
      `IMO "${input.vesselImo}" already exists with different vessel details.`,
    );
  }

  if (existingByName && !sameVesselShape(existingByName, input, organizationId)) {
    throw new Error(
      `Vessel "${input.vesselName}" already exists in organization "${input.organizationSlug}" with different details.`,
    );
  }

  const existing = existingByImo ?? existingByName;
  if (existing) {
    return existing;
  }

  try {
    return vessels.save(
      vessels.create({
        organizationId,
        imo: input.vesselImo,
        name: input.vesselName,
        flag: input.vesselFlag,
        type: input.vesselType,
        dwt: input.vesselDwt,
      }),
    );
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined;

    if (code === '23505') {
      throw new Error(
        'A conflicting existing vessel already owns the supplied IMO or name.',
      );
    }

    throw error;
  }
}

export async function provisionStagingVesselWithRepos(
  repos: RepoBundle,
  input: ProvisionVesselInput,
  organizationId = deriveOrganizationId(input.organizationSlug),
): Promise<VesselIdentity> {
  const organization = await ensureTrustedOrganization(
    repos.organizations,
    organizationId,
    input,
  );
  const vessel = await ensureVessel(repos.vessels, organization.id, input);

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    vesselId: vessel.id,
    vesselName: vessel.name,
    vesselImo: vessel.imo,
  };
}

export async function runProvisionVesselTransaction(
  runner: QueryRunner,
  input: ProvisionVesselInput,
  organizationId: string,
): Promise<VesselIdentity> {
  await runner.startTransaction();

  try {
    await enterProvisioningRole(runner);
    await establishTenantContext(runner, organizationId);

    const provisioned = await provisionStagingVesselWithRepos(
      {
        organizations: runner.manager.getRepository(Organization),
        vessels: runner.manager.getRepository(Vessel),
      },
      input,
      organizationId,
    );

    await runner.commitTransaction();
    return provisioned;
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  }
}

function createBaseDatabaseConfig(databaseUrl: string) {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDbPoolMax = process.env.DB_POOL_MAX;

  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'development';
  process.env.DB_POOL_MAX = '1';

  try {
    return createDatabaseConfig({ useApplicationRole: false });
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousDbPoolMax === undefined) {
      delete process.env.DB_POOL_MAX;
    } else {
      process.env.DB_POOL_MAX = previousDbPoolMax;
    }
  }
}

function createOwnerDataSource(databaseUrl: string): DataSource {
  return new DataSource(createBaseDatabaseConfig(databaseUrl));
}

function createApplicationVerificationDataSource(
  databaseUrl: string,
): DataSource {
  return new DataSource({
    ...createBaseDatabaseConfig(databaseUrl),
    extra: {
      options: `-c role=${DEFAULT_APPLICATION_DATABASE_ROLE}`,
      max: DEFAULT_RUNTIME_DATABASE_POOL_MAX,
    },
  });
}

function buildTenantContext(organizationId: string): TenantContextService {
  return {
    getOrganizationId: () => organizationId,
    getUserId: () => null,
    setCurrentTenant: () => undefined,
    clear: () => undefined,
  } as unknown as TenantContextService;
}

async function listTenantVessels(
  runner: QueryRunner,
  organizationId: string,
): Promise<Vessel[]> {
  const service = new VesselsService(
    runner.manager.getRepository(Vessel),
    runner.manager.getRepository(Voyage),
    buildTenantContext(organizationId),
  );

  const result = await service.findAll({ page: 1, limit: 200 } as any);
  return result.data;
}

export async function verifyProvisionedVessel(
  owner: DataSource,
  application: DataSource,
  result: VesselIdentity,
): Promise<ProvisionVesselResult> {
  const applicationRunner = application.createQueryRunner();
  await applicationRunner.connect();

  let vesselId = result.vesselId;
  let frontendLookupVisible = false;

  try {
    await applicationRunner.startTransaction();
    await establishTenantContext(applicationRunner, result.organizationId);

    const ownOrganizations = (await applicationRunner.query(
      `SELECT id, slug, name FROM organizations WHERE id = $1`,
      [result.organizationId],
    )) as Array<{ id: string; slug: string; name: string }>;
    if (ownOrganizations.length !== 1) {
      throw new Error('Application role could not read the staging organization.');
    }

    const tenantVessels = await listTenantVessels(
      applicationRunner,
      result.organizationId,
    );
    const vessel = tenantVessels.find(
      (item) => item.id === result.vesselId && item.name === result.vesselName,
    );

    if (!vessel) {
      throw new Error(
        'Tenant-scoped vessel list did not include the provisioned staging vessel.',
      );
    }

    frontendLookupVisible = true;
    vesselId = vessel.id;

    const [counts] = (await applicationRunner.query(
      `SELECT
         COUNT(*) FILTER (WHERE id = $1)::text AS vessel_id_count,
         COUNT(*) FILTER (WHERE imo = $2)::text AS vessel_imo_count,
         COUNT(*) FILTER (WHERE name = $3)::text AS vessel_name_count
       FROM vessels
       WHERE organization_id = $4`,
      [
        result.vesselId,
        result.vesselImo,
        result.vesselName,
        result.organizationId,
      ],
    )) as Array<{
      vessel_id_count: string;
      vessel_imo_count: string;
      vessel_name_count: string;
    }>;

    if (!counts || counts.vessel_id_count !== '1') {
      throw new Error('Expected exactly one staging vessel with the provisioned ID.');
    }

    if (counts.vessel_imo_count !== '1') {
      throw new Error('Expected exactly one staging vessel with the supplied IMO.');
    }

    if (counts.vessel_name_count !== '1') {
      throw new Error('Expected exactly one staging vessel with the supplied name.');
    }

    await applicationRunner.rollbackTransaction();
  } finally {
    await applicationRunner.release();
  }

  const [role] = await application.query<Array<{ current_user: string }>>(
    `SELECT current_user`,
  );

  if (role?.current_user !== DEFAULT_APPLICATION_DATABASE_ROLE) {
    throw new Error(
      `Expected runtime role ${DEFAULT_APPLICATION_DATABASE_ROLE}, got ${role?.current_user ?? 'unknown'}.`,
    );
  }

  const crossTenantRunner = application.createQueryRunner();
  await crossTenantRunner.connect();

  try {
    await crossTenantRunner.startTransaction();
    await establishTenantContext(
      crossTenantRunner,
      deriveOrganizationId(`other-${result.organizationSlug}`),
    );

    const crossTenantRows = (await crossTenantRunner.query(
      `SELECT id FROM vessels WHERE id = $1`,
      [result.vesselId],
    )) as Array<{ id: string }>;

    if (crossTenantRows.length !== 0) {
      throw new Error('Another tenant could read the staging vessel.');
    }

    await crossTenantRunner.rollbackTransaction();
  } finally {
    await crossTenantRunner.release();
  }

  const unauthorizedRunner = application.createQueryRunner();
  await unauthorizedRunner.connect();

  try {
    await unauthorizedRunner.startTransaction();
    let rejected = false;

    try {
      await unauthorizedRunner.query(
        `INSERT INTO vessels (organization_id, imo, name, flag, type, dwt)
         VALUES ($1, $2, 'Unauthorized Vessel', 'Panama', 'Bulk Carrier', 12345)`,
        [
          result.organizationId,
          `${result.vesselImo.slice(0, 6)}9`,
        ],
      );
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : undefined;
      rejected = code === '42501';

      if (!rejected) {
        throw error;
      }
    }

    if (!rejected) {
      throw new Error(
        'Application role unexpectedly inserted a vessel without tenant context.',
      );
    }

    await unauthorizedRunner.rollbackTransaction();
  } finally {
    await unauthorizedRunner.release();
  }

  const [tenantContext] = await owner.query<
    Array<{
      tenant_id: string | null;
      user_id: string | null;
      current_user: string;
    }>
  >(
    `SELECT
       current_setting('app.current_tenant_id', true) AS tenant_id,
       current_setting('app.current_user_id', true) AS user_id,
       current_user`,
  );

  return {
    organizationId: result.organizationId,
    organizationSlug: result.organizationSlug,
    vesselId,
    vesselName: result.vesselName,
    vesselImo: result.vesselImo,
    runtimeRole: role.current_user,
    tenantContextCleared:
      (tenantContext?.tenant_id ?? '') === '' &&
      (tenantContext?.user_id ?? '') === '' &&
      tenantContext?.current_user !== DEFAULT_APPLICATION_DATABASE_ROLE,
    frontendLookupVisible,
  };
}

export async function runProvisionVessel(
  input: ProvisionVesselInput,
): Promise<ProvisionVesselResult> {
  const owner = createOwnerDataSource(input.databaseUrl);
  const application = createApplicationVerificationDataSource(
    input.databaseUrl,
  );
  const organizationId = deriveOrganizationId(input.organizationSlug);

  await owner.initialize();
  await application.initialize();

  const runner = owner.createQueryRunner();
  await runner.connect();

  try {
    const provisioned = await runProvisionVesselTransaction(
      runner,
      input,
      organizationId,
    );
    return verifyProvisionedVessel(owner, application, provisioned);
  } finally {
    await runner.release();
    await application.destroy();
    await owner.destroy();
  }
}

function printResult(result: ProvisionVesselResult): void {
  console.log(
    JSON.stringify(
      {
        organizationId: result.organizationId,
        organizationSlug: result.organizationSlug,
        vesselId: result.vesselId,
        vesselName: result.vesselName,
        vesselImo: result.vesselImo,
        runtimeRole: result.runtimeRole,
        tenantContextCleared: result.tenantContextCleared,
        frontendLookupVisible: result.frontendLookupVisible,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const input = readProvisionVesselInput();
  const result = await runProvisionVessel(input);
  printResult(result);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
