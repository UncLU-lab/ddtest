import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import {
  createDatabaseConfig,
  DEFAULT_APPLICATION_DATABASE_ROLE,
  DEFAULT_RUNTIME_DATABASE_POOL_MAX,
} from '../config/database.config';
import { Organization } from '../modules/cross-cutting/entities/organization.entity';
import { User } from '../modules/cross-cutting/entities/user.entity';

const DEFAULT_ORGANIZATION_NAME = 'Demurrage Defender Staging';
const DEFAULT_ORGANIZATION_SLUG = 'demurrage-defender-staging';
const DEFAULT_USER_FULL_NAME = 'Demurrage Defender Staging User';
const PROVISION_CONFIRMATION = 'provision-staging-user';
const UUID_V5_NAMESPACE = Buffer.from(
  '6ba7b8119dad11d180b400c04fd430c8',
  'hex',
);

export interface ProvisioningInput {
  databaseUrl: string;
  firebaseUid: string;
  email: string;
  fullName: string;
  organizationName: string;
  organizationSlug: string;
}

export interface ProvisioningResult {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  firebaseUid: string;
  email: string;
  runtimeRole: string;
  tenantContextCleared: boolean;
}

type ResolverRow = {
  user_id: string;
  organization_id: string;
  organization_exists: boolean;
};

type RepoBundle = {
  organizations: Repository<Organization>;
  users: Repository<User>;
};

type ProvisionedIdentity = {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  firebaseUid: string;
};

export function readProvisioningInput(
  env: NodeJS.ProcessEnv = process.env,
): ProvisioningInput {
  if (env.PROVISION_CONFIRM?.trim() !== PROVISION_CONFIRMATION) {
    throw new Error(
      `PROVISION_CONFIRM must be exactly "${PROVISION_CONFIRMATION}" to run this command.`,
    );
  }

  const databaseUrl = env.PROVISION_DATABASE_URL?.trim();
  const firebaseUid = env.PROVISION_FIREBASE_UID?.trim();
  const email = env.PROVISION_USER_EMAIL?.trim();

  if (!databaseUrl) {
    throw new Error('PROVISION_DATABASE_URL is required.');
  }

  if (!firebaseUid) {
    throw new Error('PROVISION_FIREBASE_UID is required.');
  }

  if (!email) {
    throw new Error('PROVISION_USER_EMAIL is required.');
  }

  return {
    databaseUrl,
    firebaseUid,
    email: email.toLowerCase(),
    fullName:
      env.PROVISION_USER_FULL_NAME?.trim() || DEFAULT_USER_FULL_NAME,
    organizationName:
      env.PROVISION_ORGANIZATION_NAME?.trim() || DEFAULT_ORGANIZATION_NAME,
    organizationSlug:
      env.PROVISION_ORGANIZATION_SLUG?.trim() || DEFAULT_ORGANIZATION_SLUG,
  };
}

export function deriveOrganizationId(organizationSlug: string): string {
  const hash = createHash('sha1')
    .update(UUID_V5_NAMESPACE)
    .update(Buffer.from(organizationSlug, 'utf8'))
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export async function resolveExistingUser(
  application: DataSource,
  firebaseUid: string,
): Promise<ResolverRow | null> {
  const rows = await application.query<ResolverRow[]>(
    `SELECT * FROM app.resolve_authenticated_user($1::text)`,
    [firebaseUid],
  );

  if (rows.length > 1) {
    throw new Error(
      'resolve_authenticated_user returned multiple rows for the supplied Firebase UID.',
    );
  }

  return rows[0] ?? null;
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

async function ensureOrganization(
  organizations: Repository<Organization>,
  organizationId: string,
  input: ProvisioningInput,
): Promise<Organization> {
  const existing = await organizations.findOne({
    where: { id: organizationId },
  });

  if (existing) {
    if (existing.slug !== input.organizationSlug) {
      throw new Error(
        `Organization ${organizationId} already exists with a different slug.`,
      );
    }

    if (existing.name !== input.organizationName) {
      throw new Error(
        `Organization slug "${input.organizationSlug}" already exists with a different name.`,
      );
    }

    return existing;
  }

  try {
    return organizations.save(
      organizations.create({
        id: organizationId,
        name: input.organizationName,
        slug: input.organizationSlug,
      }),
    );
  } catch (error) {
    throw mapUniquenessError(
      error,
      `Organization slug "${input.organizationSlug}" is already assigned to another organization.`,
    );
  }
}

async function ensureUser(
  users: Repository<User>,
  organizationId: string,
  input: ProvisioningInput,
): Promise<User> {
  const existingByFirebaseUid = await users.findOne({
    where: { firebaseUid: input.firebaseUid },
  });
  const existingByEmail = await users.findOne({
    where: { email: input.email },
  });

  if (
    existingByFirebaseUid &&
    existingByEmail &&
    existingByFirebaseUid.id !== existingByEmail.id
  ) {
    throw new Error(
      'Existing user records conflict: firebase UID and email resolve to different users.',
    );
  }

  if (
    existingByEmail &&
    !existingByFirebaseUid &&
    existingByEmail.firebaseUid !== input.firebaseUid
  ) {
    throw new Error(
      `Email "${input.email}" is already assigned to another Firebase UID.`,
    );
  }

  const existing = existingByFirebaseUid ?? existingByEmail;

  if (existing) {
    if (
      existing.organizationId &&
      existing.organizationId !== organizationId
    ) {
      throw new Error(
        `Firebase UID "${input.firebaseUid}" is already assigned to another organization.`,
      );
    }

    if (existing.email !== input.email) {
      throw new Error(
        `Firebase UID "${input.firebaseUid}" already exists with a different email.`,
      );
    }

    if (existing.fullName !== input.fullName) {
      throw new Error(
        `Firebase UID "${input.firebaseUid}" already exists with a different full name.`,
      );
    }

    if (existing.organizationId !== organizationId) {
      existing.organizationId = organizationId;
      return users.save(existing);
    }

    return existing;
  }

  try {
    return users.save(
      users.create({
        firebaseUid: input.firebaseUid,
        email: input.email,
        fullName: input.fullName,
        organizationId,
      }),
    );
  } catch (error) {
    throw mapUniquenessError(
      error,
      'A conflicting existing user already owns the supplied Firebase UID or email.',
    );
  }
}

function mapUniquenessError(error: unknown, message: string): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined;

  if (code === '23505') {
    return new Error(message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function provisionStagingUserWithRepos(
  repos: RepoBundle,
  input: ProvisioningInput,
  organizationId = deriveOrganizationId(input.organizationSlug),
): Promise<ProvisionedIdentity> {
  const organization = await ensureOrganization(
    repos.organizations,
    organizationId,
    input,
  );
  const user = await ensureUser(repos.users, organization.id, input);

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    userId: user.id,
    firebaseUid: user.firebaseUid,
  };
}

export async function runProvisioningTransaction(
  runner: QueryRunner,
  input: ProvisioningInput,
  organizationId: string,
): Promise<ProvisionedIdentity> {
  await runner.startTransaction();

  try {
    await enterProvisioningRole(runner);
    await establishTenantContext(runner, organizationId);

    const provisioned = await provisionStagingUserWithRepos(
      {
        organizations: runner.manager.getRepository(Organization),
        users: runner.manager.getRepository(User),
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

export async function verifyProvisioning(
  owner: DataSource,
  application: DataSource,
  result: ProvisionedIdentity,
): Promise<ProvisioningResult> {
  const applicationRunner = application.createQueryRunner();
  await applicationRunner.connect();

  let counts:
    | {
        organization_count: string;
        firebase_uid_count: string;
        email_count: string;
        email: string;
        organization_id: string;
        user_id: string;
      }
    | undefined;

  try {
    await applicationRunner.startTransaction();
    await establishTenantContext(applicationRunner, result.organizationId);

    [counts] = (await applicationRunner.query(
      `
      SELECT
        (SELECT COUNT(*)::text
         FROM organizations
         WHERE id = $1 AND slug = $2) AS organization_count,
        (SELECT COUNT(*)::text
         FROM users
         WHERE firebase_uid = $3) AS firebase_uid_count,
        (SELECT COUNT(*)::text
         FROM users
         WHERE email = (
           SELECT email FROM users WHERE id = $4
         )) AS email_count,
        user_record.email AS email,
        user_record.organization_id::text AS organization_id,
        user_record.id::text AS user_id
      FROM users user_record
      WHERE user_record.id = $4
      `,
      [
        result.organizationId,
        result.organizationSlug,
        result.firebaseUid,
        result.userId,
      ],
    )) as Array<{
      organization_count: string;
      firebase_uid_count: string;
      email_count: string;
      email: string;
      organization_id: string;
      user_id: string;
    }>;

    if (!counts) {
      throw new Error('Provisioned user record could not be reloaded.');
    }

    if (counts.organization_count !== '1') {
      throw new Error('Expected exactly one staging organization.');
    }

    if (counts.firebase_uid_count !== '1') {
      throw new Error(
        'Expected exactly one user for the supplied Firebase UID.',
      );
    }

    if (counts.email_count !== '1') {
      throw new Error('Expected exactly one user for the supplied email.');
    }

    if (counts.organization_id !== result.organizationId) {
      throw new Error(
        'Provisioned user is not linked to the expected organization.',
      );
    }

    const ownRows = (await applicationRunner.query(
      `SELECT id FROM organizations WHERE id = $1`,
      [result.organizationId],
    )) as Array<{ id: string }>;
    if (ownRows.length !== 1) {
      throw new Error(
        'Application role could not read the provisioned organization.',
      );
    }

    await applicationRunner.rollbackTransaction();
  } finally {
    await applicationRunner.release();
  }

  const resolved = await application.query<ResolverRow[]>(
    `SELECT * FROM app.resolve_authenticated_user($1::text)`,
    [result.firebaseUid],
  );

  if (resolved.length !== 1) {
    throw new Error(
      'resolve_authenticated_user did not return exactly one row.',
    );
  }

  const [row] = resolved;
  if (
    row.user_id !== result.userId ||
    row.organization_id !== result.organizationId ||
    row.organization_exists !== true
  ) {
    throw new Error(
      'resolve_authenticated_user returned an unexpected user or organization mapping.',
    );
  }

  const [role] = await application.query<Array<{ current_user: string }>>(
    `SELECT current_user`,
  );

  if (role?.current_user !== DEFAULT_APPLICATION_DATABASE_ROLE) {
    throw new Error(
      `Expected runtime role ${DEFAULT_APPLICATION_DATABASE_ROLE}, got ${role?.current_user ?? 'unknown'}.`,
    );
  }

  const unauthorizedRunner = application.createQueryRunner();
  await unauthorizedRunner.connect();

  try {
    await unauthorizedRunner.startTransaction();
    let rejected = false;

    try {
      await unauthorizedRunner.query(
        `INSERT INTO organizations (id, name, slug)
         VALUES ($1, 'Unauthorized Organization', $2)`,
        [
          deriveOrganizationId(`unauthorized-${result.organizationId}`),
          `unauthorized-${result.organizationSlug}`,
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
        'Application role unexpectedly inserted an organization without tenant context.',
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
    userId: result.userId,
    firebaseUid: result.firebaseUid,
    email: counts.email,
    runtimeRole: role.current_user,
    tenantContextCleared:
      (tenantContext?.tenant_id ?? '') === '' &&
      (tenantContext?.user_id ?? '') === '' &&
      tenantContext?.current_user !== DEFAULT_APPLICATION_DATABASE_ROLE,
  };
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

export async function runProvisioning(
  input: ProvisioningInput,
): Promise<ProvisioningResult> {
  const owner = createOwnerDataSource(input.databaseUrl);
  const application = createApplicationVerificationDataSource(
    input.databaseUrl,
  );

  await owner.initialize();
  await application.initialize();

  const existing = await resolveExistingUser(application, input.firebaseUid);
  const organizationId =
    existing?.organization_id ?? deriveOrganizationId(input.organizationSlug);

  const runner = owner.createQueryRunner();
  await runner.connect();

  try {
    const provisioned = await runProvisioningTransaction(
      runner,
      input,
      organizationId,
    );
    return verifyProvisioning(owner, application, provisioned);
  } finally {
    await runner.release();
    await application.destroy();
    await owner.destroy();
  }
}

function printResult(result: ProvisioningResult): void {
  console.log(
    JSON.stringify(
      {
        organizationId: result.organizationId,
        organizationSlug: result.organizationSlug,
        userId: result.userId,
        firebaseUid: result.firebaseUid,
        email: result.email,
        runtimeRole: result.runtimeRole,
        tenantContextCleared: result.tenantContextCleared,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const input = readProvisioningInput();
  const result = await runProvisioning(input);
  printResult(result);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
