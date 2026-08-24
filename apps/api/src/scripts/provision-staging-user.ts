import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { createDatabaseConfig } from '../config/database.config';
import {
  DEFAULT_APPLICATION_DATABASE_ROLE,
  DEFAULT_RUNTIME_DATABASE_POOL_MAX,
} from '../config/database.config';
import { Organization } from '../modules/cross-cutting/entities/organization.entity';
import { User } from '../modules/cross-cutting/entities/user.entity';

const DEFAULT_ORGANIZATION_NAME = 'Demurrage Defender Staging';
const DEFAULT_ORGANIZATION_SLUG = 'demurrage-defender-staging';
const DEFAULT_USER_FULL_NAME = 'Demurrage Defender Staging User';
const PROVISION_CONFIRMATION = 'provision-staging-user';

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

async function ensureOrganization(
  organizations: Repository<Organization>,
  input: ProvisioningInput,
): Promise<Organization> {
  const existing = await organizations.findOne({
    where: { slug: input.organizationSlug },
  });

  if (existing) {
    if (existing.name !== input.organizationName) {
      throw new Error(
        `Organization slug "${input.organizationSlug}" already exists with a different name.`,
      );
    }

    return existing;
  }

  return organizations.save(
    organizations.create({
      name: input.organizationName,
      slug: input.organizationSlug,
    }),
  );
}

async function ensureUser(
  users: Repository<User>,
  organization: Organization,
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
      existing.organizationId !== organization.id
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

    if (existing.organizationId !== organization.id) {
      existing.organizationId = organization.id;
      return users.save(existing);
    }

    return existing;
  }

  return users.save(
    users.create({
      firebaseUid: input.firebaseUid,
      email: input.email,
      fullName: input.fullName,
      organizationId: organization.id,
    }),
  );
}

export async function verifyProvisioning(
  owner: DataSource,
  application: DataSource,
  result: {
    organizationId: string;
    organizationSlug: string;
    userId: string;
    firebaseUid: string;
  },
): Promise<ProvisioningResult> {
  const [counts] = await owner.query<
    Array<{
      organization_count: string;
      firebase_uid_count: string;
      email: string;
      organization_id: string;
      user_id: string;
    }>
  >(
    `
    SELECT
      (SELECT COUNT(*)::text
       FROM organizations
       WHERE slug = $1) AS organization_count,
      (SELECT COUNT(*)::text
       FROM users
       WHERE firebase_uid = $2) AS firebase_uid_count,
      user_record.email AS email,
      user_record.organization_id::text AS organization_id,
      user_record.id::text AS user_id
    FROM users user_record
    WHERE user_record.id = $3
    `,
    [result.organizationSlug, result.firebaseUid, result.userId],
  );

  if (!counts) {
    throw new Error('Provisioned user record could not be reloaded.');
  }

  if (counts.organization_count !== '1') {
    throw new Error('Expected exactly one staging organization.');
  }

  if (counts.firebase_uid_count !== '1') {
    throw new Error('Expected exactly one user for the supplied Firebase UID.');
  }

  if (counts.organization_id !== result.organizationId) {
    throw new Error('Provisioned user is not linked to the expected organization.');
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

  return {
    organizationId: result.organizationId,
    organizationSlug: result.organizationSlug,
    userId: result.userId,
    firebaseUid: result.firebaseUid,
    email: counts.email,
    runtimeRole: role.current_user,
  };
}

export async function provisionStagingUserWithRepos(
  repos: RepoBundle,
  input: ProvisioningInput,
): Promise<{
  organizationId: string;
  organizationSlug: string;
  userId: string;
  firebaseUid: string;
}> {
  const organization = await ensureOrganization(repos.organizations, input);
  const user = await ensureUser(repos.users, organization, input);

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    userId: user.id,
    firebaseUid: user.firebaseUid,
  };
}

function createOwnerDataSource(databaseUrl: string): DataSource {
  return new DataSource(createBaseDatabaseConfig(databaseUrl));
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

function createApplicationVerificationDataSource(databaseUrl: string): DataSource {
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

  try {
    const provisioned = await owner.transaction(async (manager) =>
      provisionStagingUserWithRepos(
        {
          organizations: manager.getRepository(Organization),
          users: manager.getRepository(User),
        },
        input,
      ),
    );

    return verifyProvisioning(owner, application, provisioned);
  } finally {
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
