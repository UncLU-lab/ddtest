import { DataSource, Repository } from 'typeorm';
import {
  provisionStagingUserWithRepos,
  readProvisioningInput,
  verifyProvisioning,
  type ProvisioningInput,
} from './provision-staging-user';
import { Organization } from '../modules/cross-cutting/entities/organization.entity';
import { User } from '../modules/cross-cutting/entities/user.entity';

function input(overrides: Partial<ProvisioningInput> = {}): ProvisioningInput {
  return {
    databaseUrl: 'postgresql://owner@example.test/db',
    firebaseUid: 'firebase-uid-1',
    email: 'staging@example.test',
    fullName: 'Staging User',
    organizationName: 'Demurrage Defender Staging',
    organizationSlug: 'demurrage-defender-staging',
    ...overrides,
  };
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Demurrage Defender Staging',
    slug: 'demurrage-defender-staging',
    createdAt: new Date('2026-08-24T00:00:00Z'),
    updatedAt: new Date('2026-08-24T00:00:00Z'),
    users: [],
    ...overrides,
  };
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    email: 'staging@example.test',
    fullName: 'Staging User',
    createdAt: new Date('2026-08-24T00:00:00Z'),
    lastLogin: null,
    organizationId: 'org-1',
    organization: null,
    auditLogs: [],
    aiInteractions: [],
    feedbackSignals: [],
    ...overrides,
  };
}

describe('readProvisioningInput', () => {
  it('requires explicit confirmation and required values', () => {
    expect(() => readProvisioningInput({})).toThrow(
      'PROVISION_CONFIRM must be exactly "provision-staging-user" to run this command.',
    );
    expect(() =>
      readProvisioningInput({
        PROVISION_CONFIRM: 'provision-staging-user',
      }),
    ).toThrow('PROVISION_DATABASE_URL is required.');
  });

  it('normalizes optional defaults', () => {
    expect(
      readProvisioningInput({
        PROVISION_CONFIRM: 'provision-staging-user',
        PROVISION_DATABASE_URL: 'postgresql://owner@example.test/db',
        PROVISION_FIREBASE_UID: 'firebase-user',
        PROVISION_USER_EMAIL: 'Staging@Example.Test',
      }),
    ).toEqual(
      expect.objectContaining({
        firebaseUid: 'firebase-user',
        email: 'staging@example.test',
        fullName: 'Demurrage Defender Staging User',
        organizationName: 'Demurrage Defender Staging',
        organizationSlug: 'demurrage-defender-staging',
      }),
    );
  });
});

describe('provisionStagingUserWithRepos', () => {
  function createRepos(options: {
    existingOrganization?: Organization | null;
    existingUserByFirebaseUid?: User | null;
    existingUserByEmail?: User | null;
  }) {
    const saveOrganization = jest.fn(async (value: Organization) => ({
      ...value,
      id: value.id ?? 'org-1',
      createdAt: value.createdAt ?? new Date('2026-08-24T00:00:00Z'),
      updatedAt: value.updatedAt ?? new Date('2026-08-24T00:00:00Z'),
    }));
    const saveUser = jest.fn(async (value: User) => ({
      ...value,
      id: value.id ?? 'user-1',
      createdAt: value.createdAt ?? new Date('2026-08-24T00:00:00Z'),
    }));

    const organizations = {
      findOne: jest.fn(async () => options.existingOrganization ?? null),
      create: jest.fn((value) => value),
      save: saveOrganization,
    } as unknown as Repository<Organization>;

    const users = {
      findOne: jest
        .fn()
        .mockImplementationOnce(
          async () => options.existingUserByFirebaseUid ?? null,
        )
        .mockImplementationOnce(async () => options.existingUserByEmail ?? null),
      create: jest.fn((value) => value),
      save: saveUser,
    } as unknown as Repository<User>;

    return { organizations, users, saveOrganization, saveUser };
  }

  it('creates a new staging organization and user', async () => {
    const repos = createRepos({});

    const result = await provisionStagingUserWithRepos(repos, input());

    expect(repos.saveOrganization).toHaveBeenCalled();
    expect(repos.saveUser).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: 'firebase-uid-1',
        organizationId: 'org-1',
      }),
    );
    expect(result).toEqual({
      organizationId: 'org-1',
      organizationSlug: 'demurrage-defender-staging',
      userId: 'user-1',
      firebaseUid: 'firebase-uid-1',
    });
  });

  it('reuses an existing matching organization and user idempotently', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingUserByFirebaseUid: user(),
      existingUserByEmail: user(),
    });

    const result = await provisionStagingUserWithRepos(repos, input());

    expect(repos.saveOrganization).not.toHaveBeenCalled();
    expect(repos.saveUser).not.toHaveBeenCalled();
    expect(result.userId).toBe('user-1');
  });

  it('rejects a staging slug collision with a different name', async () => {
    const repos = createRepos({
      existingOrganization: organization({ name: 'Different Name' }),
    });

    await expect(
      provisionStagingUserWithRepos(repos, input()),
    ).rejects.toThrow(
      'Organization slug "demurrage-defender-staging" already exists with a different name.',
    );
  });

  it('rejects email reuse by another Firebase UID', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingUserByEmail: user({ firebaseUid: 'other-firebase-uid' }),
    });

    await expect(
      provisionStagingUserWithRepos(repos, input()),
    ).rejects.toThrow(
      'Email "staging@example.test" is already assigned to another Firebase UID.',
    );
  });

  it('rejects an existing Firebase UID mapped to another organization', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingUserByFirebaseUid: user({ organizationId: 'org-2' }),
      existingUserByEmail: user({ organizationId: 'org-2' }),
    });

    await expect(
      provisionStagingUserWithRepos(repos, input()),
    ).rejects.toThrow(
      'Firebase UID "firebase-uid-1" is already assigned to another organization.',
    );
  });

  it('assigns the organization when a matching Firebase UID exists but is unscoped', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingUserByFirebaseUid: user({ organizationId: null }),
      existingUserByEmail: user({ organizationId: null }),
    });

    const result = await provisionStagingUserWithRepos(repos, input());

    expect(repos.saveUser).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
    );
    expect(result.organizationId).toBe('org-1');
  });
});

describe('verifyProvisioning', () => {
  it('verifies the database result and runtime role', async () => {
    const owner = {
      query: jest.fn(async () => [
        {
          organization_count: '1',
          firebase_uid_count: '1',
          email: 'staging@example.test',
          organization_id: 'org-1',
          user_id: 'user-1',
        },
      ]),
    } as unknown as DataSource;

    const application = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            user_id: 'user-1',
            organization_id: 'org-1',
            organization_exists: true,
          },
        ])
        .mockResolvedValueOnce([{ current_user: 'demurrage_defender_app' }]),
    } as unknown as DataSource;

    await expect(
      verifyProvisioning(owner, application, {
        organizationId: 'org-1',
        organizationSlug: 'demurrage-defender-staging',
        userId: 'user-1',
        firebaseUid: 'firebase-uid-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        runtimeRole: 'demurrage_defender_app',
      }),
    );
  });

  it('fails when resolve_authenticated_user is not unique', async () => {
    const owner = {
      query: jest.fn(async () => [
        {
          organization_count: '1',
          firebase_uid_count: '1',
          email: 'staging@example.test',
          organization_id: 'org-1',
          user_id: 'user-1',
        },
      ]),
    } as unknown as DataSource;

    const application = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ current_user: 'demurrage_defender_app' }]),
    } as unknown as DataSource;

    await expect(
      verifyProvisioning(owner, application, {
        organizationId: 'org-1',
        organizationSlug: 'demurrage-defender-staging',
        userId: 'user-1',
        firebaseUid: 'firebase-uid-1',
      }),
    ).rejects.toThrow(
      'resolve_authenticated_user did not return exactly one row.',
    );
  });
});
