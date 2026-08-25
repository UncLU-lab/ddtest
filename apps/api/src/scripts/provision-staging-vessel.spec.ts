import { DataSource, QueryRunner, Repository } from 'typeorm';
import {
  provisionStagingVesselWithRepos,
  readProvisionVesselInput,
  runProvisionVesselTransaction,
  verifyProvisionedVessel,
  type ProvisionVesselInput,
} from './provision-staging-vessel';
import { Vessel } from '../modules/bulk/entities/vessel.entity';
import { VesselsService } from '../modules/bulk/vessels/vessels.service';
import { Organization } from '../modules/cross-cutting/entities/organization.entity';
import { deriveOrganizationId } from './provision-staging-user';

function input(overrides: Partial<ProvisionVesselInput> = {}): ProvisionVesselInput {
  return {
    databaseUrl: 'postgresql://owner@example.test/db',
    organizationSlug: 'demurrage-defender-staging',
    organizationName: 'Demurrage Defender Staging',
    vesselName: 'MV Staging Explorer',
    vesselImo: '7999001',
    vesselFlag: 'Panama',
    vesselType: 'Bulk Carrier',
    vesselDwt: 50000,
    ...overrides,
  };
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: deriveOrganizationId('demurrage-defender-staging'),
    name: 'Demurrage Defender Staging',
    slug: 'demurrage-defender-staging',
    createdAt: new Date('2026-08-25T00:00:00Z'),
    updatedAt: new Date('2026-08-25T00:00:00Z'),
    users: [],
    ...overrides,
  };
}

function vessel(overrides: Partial<Vessel> = {}): Vessel {
  return {
    id: 'vessel-1',
    organizationId: deriveOrganizationId('demurrage-defender-staging'),
    imo: '7999001',
    name: 'MV Staging Explorer',
    flag: 'Panama',
    type: 'Bulk Carrier',
    dwt: 50000,
    createdAt: new Date('2026-08-25T00:00:00Z'),
    updatedAt: new Date('2026-08-25T00:00:00Z'),
    voyages: [],
    ...overrides,
  };
}

describe('readProvisionVesselInput', () => {
  it('requires explicit confirmation and database URL', () => {
    expect(() => readProvisionVesselInput({})).toThrow(
      'PROVISION_CONFIRM must be exactly "provision-staging-vessel" to run this command.',
    );
    expect(() =>
      readProvisionVesselInput({
        PROVISION_CONFIRM: 'provision-staging-vessel',
      }),
    ).toThrow('PROVISION_DATABASE_URL is required.');
  });

  it('applies staging defaults and validates IMO and DWT', () => {
    expect(
      readProvisionVesselInput({
        PROVISION_CONFIRM: 'provision-staging-vessel',
        PROVISION_DATABASE_URL: 'postgresql://owner@example.test/db',
      }),
    ).toEqual(
      expect.objectContaining({
        organizationSlug: 'demurrage-defender-staging',
        vesselName: 'MV Staging Explorer',
        vesselImo: '7999001',
        vesselDwt: 50000,
      }),
    );

    expect(() =>
      readProvisionVesselInput({
        PROVISION_CONFIRM: 'provision-staging-vessel',
        PROVISION_DATABASE_URL: 'postgresql://owner@example.test/db',
        PROVISION_VESSEL_IMO: 'abc',
      }),
    ).toThrow('PROVISION_VESSEL_IMO must be exactly 7 digits.');

    expect(() =>
      readProvisionVesselInput({
        PROVISION_CONFIRM: 'provision-staging-vessel',
        PROVISION_DATABASE_URL: 'postgresql://owner@example.test/db',
        PROVISION_VESSEL_DWT: '0',
      }),
    ).toThrow('PROVISION_VESSEL_DWT must be a positive integer.');
  });
});

describe('provisionStagingVesselWithRepos', () => {
  function createRepos(options: {
    existingOrganization?: Organization | null;
    existingByImo?: Vessel | null;
    existingByName?: Vessel | null;
  }) {
    const saveVessel = jest.fn(async (value: Vessel) => ({
      ...value,
      id: value.id ?? 'vessel-1',
      createdAt: value.createdAt ?? new Date('2026-08-25T00:00:00Z'),
      updatedAt: value.updatedAt ?? new Date('2026-08-25T00:00:00Z'),
    }));

    const organizations = {
      findOne: jest.fn(async () => options.existingOrganization ?? null),
    } as unknown as Repository<Organization>;

    const vessels = {
      findOne: jest
        .fn()
        .mockImplementationOnce(async () => options.existingByImo ?? null)
        .mockImplementationOnce(async () => options.existingByName ?? null),
      create: jest.fn((value) => value),
      save: saveVessel,
    } as unknown as Repository<Vessel>;

    return { organizations, vessels, saveVessel };
  }

  it('creates the staging vessel for the trusted organization', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
    });

    const result = await provisionStagingVesselWithRepos(repos, input());

    expect(repos.saveVessel).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: deriveOrganizationId('demurrage-defender-staging'),
        name: 'MV Staging Explorer',
        imo: '7999001',
      }),
    );
    expect(result).toEqual({
      organizationId: deriveOrganizationId('demurrage-defender-staging'),
      organizationSlug: 'demurrage-defender-staging',
      vesselId: 'vessel-1',
      vesselName: 'MV Staging Explorer',
      vesselImo: '7999001',
    });
  });

  it('reuses an existing matching vessel idempotently', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingByImo: vessel(),
      existingByName: vessel(),
    });

    const result = await provisionStagingVesselWithRepos(repos, input());

    expect(repos.saveVessel).not.toHaveBeenCalled();
    expect(result.vesselId).toBe('vessel-1');
  });

  it('fails when the staging organization is missing', async () => {
    const repos = createRepos({});

    await expect(provisionStagingVesselWithRepos(repos, input())).rejects.toThrow(
      'Organization slug "demurrage-defender-staging" is not provisioned.',
    );
  });

  it('fails closed on name conflicts inside the same organization', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingByName: vessel({ imo: '7999002' }),
    });

    await expect(provisionStagingVesselWithRepos(repos, input())).rejects.toThrow(
      'Vessel "MV Staging Explorer" already exists in organization "demurrage-defender-staging" with different details.',
    );
  });

  it('fails closed on IMO conflicts in another organization', async () => {
    const repos = createRepos({
      existingOrganization: organization(),
      existingByImo: vessel({
        organizationId: 'other-org',
      }),
    });

    await expect(provisionStagingVesselWithRepos(repos, input())).rejects.toThrow(
      'IMO "7999001" is already assigned to another organization.',
    );
  });
});

describe('runProvisionVesselTransaction', () => {
  it('establishes role and tenant context before vessel provisioning', async () => {
    const orgRepo = {
      findOne: jest.fn(async () => organization()),
    } as unknown as Repository<Organization>;
    const vesselRepo = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'vessel-1' })),
    } as unknown as Repository<Vessel>;

    const runner = {
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      query: jest.fn(async () => undefined),
      manager: {
        getRepository: jest
          .fn()
          .mockReturnValueOnce(orgRepo)
          .mockReturnValueOnce(vesselRepo),
      },
    } as unknown as QueryRunner;

    await runProvisionVesselTransaction(
      runner,
      input(),
      deriveOrganizationId('demurrage-defender-staging'),
    );

    expect((runner as any).query.mock.calls[0][0]).toContain(
      'SET LOCAL ROLE demurrage_defender_app',
    );
    expect((runner as any).query.mock.calls[1][0]).toContain(
      "set_config('app.current_tenant_id'",
    );
    expect((runner as any).commitTransaction).toHaveBeenCalled();
  });
});

describe('verifyProvisionedVessel', () => {
  function createRunner() {
    return {
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      manager: {
        getRepository: jest.fn(),
      },
      query: jest.fn(),
    };
  }

  it('verifies frontend lookup visibility, runtime role and tenant isolation', async () => {
    const tenantRunner = createRunner();
    tenantRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          id: deriveOrganizationId('demurrage-defender-staging'),
          slug: 'demurrage-defender-staging',
          name: 'Demurrage Defender Staging',
        },
      ])
      .mockResolvedValueOnce([
        {
          vessel_id_count: '1',
          vessel_imo_count: '1',
          vessel_name_count: '1',
        },
      ]);
    tenantRunner.manager.getRepository
      .mockReturnValueOnce({} as Repository<Vessel>)
      .mockReturnValueOnce({} as Repository<any>);

    const crossTenantRunner = createRunner();
    crossTenantRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]);

    const unauthorizedRunner = createRunner();
    unauthorizedRunner.query
      .mockRejectedValueOnce({ code: '42501' });

    const application = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(tenantRunner)
        .mockReturnValueOnce(crossTenantRunner)
        .mockReturnValueOnce(unauthorizedRunner),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ current_user: 'demurrage_defender_app' }]),
    } as unknown as DataSource;

    const owner = {
      query: jest.fn().mockResolvedValueOnce([
        {
          tenant_id: '',
          user_id: '',
          current_user: 'render_admin',
        },
      ]),
    } as unknown as DataSource;

    const serviceFindAll = jest
      .spyOn(VesselsService.prototype, 'findAll')
      .mockResolvedValueOnce({
        data: [vessel()],
        meta: { page: 1, limit: 200, total: 1 },
      });

    const result = await verifyProvisionedVessel(owner, application, {
      organizationId: deriveOrganizationId('demurrage-defender-staging'),
      organizationSlug: 'demurrage-defender-staging',
      vesselId: 'vessel-1',
      vesselName: 'MV Staging Explorer',
      vesselImo: '7999001',
    });

    expect(serviceFindAll).toHaveBeenCalledWith({ page: 1, limit: 200 });
    expect(result).toEqual({
      organizationId: deriveOrganizationId('demurrage-defender-staging'),
      organizationSlug: 'demurrage-defender-staging',
      vesselId: 'vessel-1',
      vesselName: 'MV Staging Explorer',
      vesselImo: '7999001',
      runtimeRole: 'demurrage_defender_app',
      tenantContextCleared: true,
      frontendLookupVisible: true,
    });

    serviceFindAll.mockRestore();
  });
});
