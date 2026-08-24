import { IsNull, Repository } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { CpClause } from '../entities/cp-clause.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { Counterparty } from '../entities/counterparty.entity';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { Vessel } from '../entities/vessel.entity';
import { VoyageCounterparty } from '../entities/voyage-counterparty.entity';
import { Voyage } from '../entities/voyage.entity';
import { normalizeCommercialTermsToClauses } from '../charter-party-terms';
import { VoyagesService } from './voyages.service';

const VOYAGE_ID = '11111111-1111-4111-8111-111111111111';
const VESSEL_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000002';
const SHEX_CALENDAR = {
  calendarVersion: 1 as const,
  timeZone: 'Australia/Sydney',
  holidayDates: ['2026-12-25'],
  saturdayExcepted: false,
};

function buildService(
  voyage: Partial<Voyage>,
  organizationId = ORGANIZATION_ID,
) {
  const resolvedVoyage =
    voyage && (voyage as Voyage).organizationId === undefined
      ? { ...voyage, organizationId }
      : voyage;
  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  };
  const voyages = {
    findOne: jest.fn().mockResolvedValue(resolvedVoyage),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    merge: jest.fn((target, source) => Object.assign(target, source)),
  };
  const vessels = {
    findOne: jest.fn().mockResolvedValue({ id: VESSEL_ID }),
  };
  const sofDocuments = {
    find: jest.fn().mockResolvedValue([]),
  };
  const norDocuments = {
    find: jest.fn().mockResolvedValue([]),
  };
  const laytimeCalculations = {
    findOne: jest.fn().mockResolvedValue(null),
  };
  const disputes = {
    find: jest.fn().mockResolvedValue([]),
  };
  const manager = {
    create: jest.fn((_entity, value) => value),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    update: jest.fn(),
  };
  const savedIds = [
    VOYAGE_ID,
    'counterparty-1',
    'voyage-counterparty-1',
    'counterparty-2',
    'voyage-counterparty-2',
    'charter-party-1',
    'clause-1',
    'clause-2',
    'clause-3',
    'clause-4',
    'clause-5',
    'clause-6',
    'clause-7',
    'clause-8',
    'clause-9',
    'clause-10',
    'clause-11',
    'clause-12',
  ];
  let saveCall = 0;

  manager.save.mockImplementation(async (value: unknown) => ({
    ...(value as Record<string, unknown>),
    id: savedIds[saveCall++] ?? `saved-${saveCall}`,
  }));

  const dataSource = {
    transaction: jest.fn((work) => work(manager)),
  };
  const tenantContext = {
    getOrganizationId: jest.fn().mockReturnValue(organizationId),
  };

  return {
    service: new VoyagesService(
      voyages as unknown as Repository<Voyage>,
      vessels as unknown as Repository<Vessel>,
      sofDocuments as unknown as Repository<SofDocument>,
      norDocuments as unknown as Repository<NorDocument>,
      laytimeCalculations as unknown as Repository<LaytimeCalculation>,
      disputes as unknown as Repository<DisputeCaseBulk>,
      dataSource as unknown as TenantDatabaseContextService,
      tenantContext as any,
    ),
    voyages,
    vessels,
    manager,
    dataSource,
    queryBuilder,
    tenantContext,
  };
}

describe('VoyagesService voyage persistence', () => {
  it('returns a lightweight voyage list read model with derived operational fields', async () => {
    const voyage = {
      id: VOYAGE_ID,
      vesselId: VESSEL_ID,
      vessel: { id: VESSEL_ID, name: 'BW Magnolia' },
      reference: 'VOY-20260815-009',
      cargoQuantity: '65000.00',
      cargoType: 'LNG',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
      eta: new Date('2026-09-03T10:00:00.000Z'),
      status: 'Active',
    } as Voyage;
    const { service, queryBuilder } = buildService(voyage);

    queryBuilder.getCount.mockResolvedValue(1);
    queryBuilder.getRawAndEntities.mockResolvedValue({
      entities: [voyage],
      raw: [
        {
          supplier: 'Vitol Asia',
          receiver: 'PetroChina',
          latestDemurrageAmount: '42500.00',
          latestCalculationAt: new Date('2026-08-15T10:00:00.000Z'),
          newestSofUploadAt: new Date('2026-08-16T10:00:00.000Z'),
          openDisputeCount: '2',
          amountUnderDispute: '1500.00',
        },
      ],
    });

    const result = await service.findAll({ page: 1, limit: 20 } as any);

    expect(queryBuilder.clone).toHaveBeenCalled();
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'voyage.organizationId = :organizationId',
    );
    expect(queryBuilder.getRawAndEntities).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: VOYAGE_ID,
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      exposure: 42500,
      openDisputeCount: 2,
      amountUnderDispute: 1500,
      risk: 'elevated',
      calculationStale: true,
      laycanExpired: false,
    });
  });

  it('persists voyage counterparty links and commercial terms when creating a voyage', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      charterParty: {
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: '12500.00',
        timeCountingBasis: '6h SHINC',
        norNoticePeriod: '12 hours',
        clauses: [
          { id: 'clause-1', clauseType: 'laytime_rate' },
          { id: 'clause-2', clauseType: 'demurrage_rate' },
          { id: 'clause-3', clauseType: 'despatch' },
        ],
      },
      counterpartyLinks: [],
    } as Voyage;
    const { service, voyages, vessels, manager, dataSource } =
      buildService(persistedVoyage);

    const result = await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-20260815-009',
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
      laytimeAllowed: 72,
      demurrageRate: 25000,
      dispatchRate: 12500,
      timeCountingBasis: '6h SHINC',
      norNoticePeriod: '12 hours',
    });

    expect(vessels.findOne).toHaveBeenCalledWith({
      where: { id: VESSEL_ID, organizationId: ORGANIZATION_ID },
      select: { id: true },
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(
      Voyage,
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        vesselId: VESSEL_ID,
        cargoQuantity: '65000.00',
        reference: 'VOY-20260815-009',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      Counterparty,
      expect.objectContaining({
        organizationId: '00000000-0000-0000-0000-000000000001',
        name: 'Vitol Asia',
        type: 'charterer',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      VoyageCounterparty,
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        counterpartyId: 'counterparty-1',
        role: 'Supplier',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      VoyageCounterparty,
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        counterpartyId: 'counterparty-2',
        role: 'Receiver',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CharterParty,
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        formType: 'Pre-ops draft',
        effectiveDate: '2026-09-01',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: '12500.00',
        timeCountingBasis: '6h SHINC',
        norNoticePeriod: '12 hours',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 72h\nNOR notice: 12 hours',
        parameters: { hours: 72, noticeHours: 12 },
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $25,000/day',
        parameters: { rate: 25000 },
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'despatch',
        rawText: 'Dispatch: $12,500/day',
        parameters: { rate: 12500 },
      }),
    );
    expect(
      manager.create.mock.calls
        .filter(([entity]) => entity === CpClause)
        .map(([, value]) => value),
    ).toEqual(
      normalizeCommercialTermsToClauses({
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: '12500.00',
        timeCountingBasis: '6h SHINC',
        norNoticePeriod: '12 hours',
      }).map(({ id: _id, ...clause }) => ({
        charterPartyId: 'charter-party-1',
        ...clause,
      })),
    );
    expect(manager.update).toHaveBeenCalledWith(Voyage, VOYAGE_ID, {
      charterPartyId: 'charter-party-1',
    });
    expect(voyages.findOne).toHaveBeenCalledWith({
      where: {
        id: VOYAGE_ID,
        organizationId: ORGANIZATION_ID,
      },
      relations: {
        vessel: true,
        charterParty: { clauses: true },
        counterpartyLinks: { counterparty: true },
      },
    });
    expect(result).toBe(persistedVoyage);
  });

  it('persists loading and discharge commercial clauses in the same create transaction', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      charterParty: {
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: '12500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '12 hours',
        clauses: [
          { id: 'clause-1', clauseType: 'laytime_rate' },
          { id: 'clause-2', clauseType: 'demurrage_rate' },
          { id: 'clause-3', clauseType: 'despatch' },
          { id: 'clause-4', clauseType: 'shex_shinc' },
        ],
      },
      counterpartyLinks: [],
    } as Voyage;
    const { service, manager, dataSource } = buildService(persistedVoyage);

    const result = await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-20260815-017',
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
      laytimeAllowed: 72,
      demurrageRate: 25000,
      dispatchRate: 12500,
      timeCountingBasis: 'SHEX',
      shexCalendar: SHEX_CALENDAR,
      norNoticePeriod: '12 hours',
      loadingTerms: {
        laytimeAllowed: 24,
        weatherWorking: true,
        wibon: false,
      },
      dischargeTerms: {
        laytimeAllowed: 18,
        wipon: true,
      },
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(
      CharterParty,
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        fullText: expect.stringContaining('Loading terms:'),
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'laytime_rate',
        rawText: 'Loading laytime allowed: 24h',
        parameters: { hours: 24, operation: 'Loading' },
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'weather_working',
        rawText: 'Loading weather working: enabled',
        parameters: { enabled: true, operation: 'Loading' },
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'wibon',
        rawText: 'Loading wibon: disabled',
        parameters: { enabled: false, operation: 'Loading' },
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'wipon',
        rawText: 'Discharge wipon: enabled',
        parameters: { enabled: true, operation: 'Discharge' },
      }),
    );
    expect(result).toBe(persistedVoyage);
  });

  it('rolls back the create transaction when a clause write fails', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      charterParty: null,
      counterpartyLinks: [],
    } as Voyage;
    const { service, voyages, manager, dataSource } =
      buildService(persistedVoyage);
    const stagedWrites: Array<Record<string, unknown>> = [];
    const committedWrites: Array<Record<string, unknown>> = [];
    let nextId = 1;

    manager.save.mockImplementation(
      async (entityOrValue: unknown, maybeValue?: unknown) => {
        const value = (maybeValue ?? entityOrValue) as Record<string, unknown>;
        const entity =
          maybeValue && typeof entityOrValue === 'function'
            ? entityOrValue.name
            : 'Entity';

        if (value.clauseType === 'weather_working') {
          throw new Error('Simulated clause write failure');
        }

        stagedWrites.push({
          entity,
          clauseType: value.clauseType,
        });

        return {
          ...value,
          id: `saved-${nextId++}`,
        };
      },
    );

    dataSource.transaction.mockImplementation(async (work) => {
      stagedWrites.length = 0;

      try {
        const result = await work(manager);
        committedWrites.push(...stagedWrites);
        return result;
      } catch (error) {
        stagedWrites.length = 0;
        throw error;
      }
    });

    await expect(
      service.create({
        vesselId: VESSEL_ID,
        cargoQuantity: 65000,
        cargoType: 'LNG',
        reference: 'VOY-20260815-018',
        supplier: 'Vitol Asia',
        receiver: 'PetroChina',
        loadPort: 'USNOL',
        dischargePort: 'SGSIN',
        laycanStart: '2026-09-01',
        laycanEnd: '2026-09-05',
        loadingTerms: {
          weatherWorking: true,
        },
      }),
    ).rejects.toThrow('Simulated clause write failure');

    expect(committedWrites).toHaveLength(0);
    expect(voyages.findOne).not.toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Loading', 'Loading'],
    ['Discharge', 'Discharge'],
  ] as const)(
    'persists an explicit laytime operation of %s when creating a voyage',
    async (operation) => {
      const persistedVoyage = {
        id: VOYAGE_ID,
        organizationId: ORGANIZATION_ID,
        vessel: { id: VESSEL_ID },
        laytimeOperation: operation,
        charterParty: null,
        counterpartyLinks: [],
      } as Voyage;
      const { service, manager } = buildService(persistedVoyage);

      const result = await service.create({
        vesselId: VESSEL_ID,
        cargoQuantity: 65000,
        cargoType: 'LNG',
        reference: 'VOY-20260815-014',
        supplier: 'Vitol Asia',
        receiver: 'PetroChina',
        loadPort: 'USNOL',
        dischargePort: 'SGSIN',
        laycanStart: '2026-09-01',
        laycanEnd: '2026-09-05',
        laytimeOperation: operation,
      });

      expect(manager.create).toHaveBeenCalledWith(
        Voyage,
        expect.objectContaining({
          vesselId: VESSEL_ID,
          cargoQuantity: '65000.00',
          reference: 'VOY-20260815-014',
          laytimeOperation: operation,
        }),
      );
      expect(result).toBe(persistedVoyage);
    },
  );

  it.each([
    ['dry_bulk', 'dry_bulk'],
    ['tanker', 'tanker'],
  ] as const)(
    'persists bulkOperationType = %s when creating a voyage',
    async (bulkOperationType) => {
      const persistedVoyage = {
        id: VOYAGE_ID,
        organizationId: ORGANIZATION_ID,
        vessel: { id: VESSEL_ID },
        bulkOperationType,
        charterParty: null,
        counterpartyLinks: [],
      } as Voyage;
      const { service, manager } = buildService(persistedVoyage);

      const result = await service.create({
        vesselId: VESSEL_ID,
        cargoQuantity: 65000,
        cargoType: 'LNG',
        reference: 'VOY-20260815-016',
        supplier: 'Vitol Asia',
        receiver: 'PetroChina',
        loadPort: 'USNOL',
        dischargePort: 'SGSIN',
        laycanStart: '2026-09-01',
        laycanEnd: '2026-09-05',
        bulkOperationType,
      });

      expect(manager.create).toHaveBeenCalledWith(
        Voyage,
        expect.objectContaining({
          vesselId: VESSEL_ID,
          cargoQuantity: '65000.00',
          reference: 'VOY-20260815-016',
          bulkOperationType,
        }),
      );
      expect(result).toBe(persistedVoyage);
    },
  );

  it('leaves the database default in place when laytime operation is omitted', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      laytimeOperation: 'Discharge',
      charterParty: null,
      counterpartyLinks: [],
    } as Voyage;
    const { service, manager } = buildService(persistedVoyage);

    await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-20260815-015',
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
    });

    const voyageCreate = manager.create.mock.calls.find(
      ([entity]) => entity === Voyage,
    )?.[1] as Record<string, unknown> | undefined;

    expect(voyageCreate).toBeDefined();
    expect(voyageCreate).not.toHaveProperty('laytimeOperation');
  });

  it('persists a SHEX basis clause when the submitted contract basis is SHEX', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      charterParty: {
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: null,
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
        clauses: [
          { id: 'clause-1', clauseType: 'laytime_rate' },
          { id: 'clause-2', clauseType: 'demurrage_rate' },
          { id: 'clause-3', clauseType: 'shex_shinc' },
        ],
      },
      counterpartyLinks: [],
    } as Voyage;
    const { service, manager } = buildService(persistedVoyage);

    await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-20260815-010',
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
      laytimeAllowed: 72,
      demurrageRate: 25000,
      timeCountingBasis: 'SHEX',
      shexCalendar: SHEX_CALENDAR,
      norNoticePeriod: '6 hours',
    });

    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHEX',
        parameters: { shex: true, ...SHEX_CALENDAR },
      }),
    );
    expect(
      manager.create.mock.calls
        .filter(([entity]) => entity === CpClause)
        .map(([, value]) => value),
    ).toEqual(
      normalizeCommercialTermsToClauses({
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: null,
        timeCountingBasis: 'SHEX',
        shexCalendar: SHEX_CALENDAR,
        norNoticePeriod: '6 hours',
      }).map(({ id: _id, ...clause }) => ({
        charterPartyId: 'charter-party-1',
        ...clause,
      })),
    );
  });

  it('rejects new voyage SHEX terms without an explicit versioned calendar', async () => {
    const { service, dataSource } = buildService({ id: VOYAGE_ID } as Voyage);

    await expect(
      service.create({
        vesselId: VESSEL_ID,
        cargoQuantity: 65000,
        cargoType: 'LNG',
        reference: 'VOY-SHEX-MISSING',
        loadPort: 'USNOL',
        dischargePort: 'SGSIN',
        laycanStart: '2026-09-01',
        laycanEnd: '2026-09-05',
        timeCountingBasis: 'SHEX',
      }),
    ).rejects.toThrow('new SHEX terms require');

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects SHEX calendar fields when creating an explicit SHINC term', async () => {
    const { service } = buildService({ id: VOYAGE_ID } as Voyage);

    await expect(
      service.create({
        vesselId: VESSEL_ID,
        cargoQuantity: 65000,
        cargoType: 'LNG',
        reference: 'VOY-SHINC-CALENDAR',
        loadPort: 'USNOL',
        dischargePort: 'SGSIN',
        laycanStart: '2026-09-01',
        laycanEnd: '2026-09-05',
        timeCountingBasis: 'SHINC',
        shexCalendar: SHEX_CALENDAR,
      }),
    ).rejects.toThrow('SHEX calendar fields require a SHEX time counting basis');
  });

  it('persists an operation-specific versioned SHEX calendar during atomic creation', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      charterParty: { id: 'charter-party-1', clauses: [] },
      counterpartyLinks: [],
    } as unknown as Voyage;
    const { service, manager } = buildService(persistedVoyage);

    await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-LOADING-SHEX',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
      loadingTerms: {
        timeCountingBasis: 'SHEX',
        shexCalendar: SHEX_CALENDAR,
      },
    });

    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        clauseType: 'shex_shinc',
        parameters: {
          shex: true,
          ...SHEX_CALENDAR,
          operation: 'Loading',
        },
      }),
    );
  });

  it('persists a changed laytime operation when updating a voyage', async () => {
    const voyage = {
      id: VOYAGE_ID,
      vesselId: VESSEL_ID,
      laytimeOperation: 'Discharge',
      charterParty: null,
      counterpartyLinks: [],
    } as Voyage;
    const { service, voyages } = buildService(voyage);

    const result = await service.update(VOYAGE_ID, {
      laytimeOperation: 'Loading',
    });

    expect(voyages.save).toHaveBeenCalledWith(
      expect.objectContaining({ laytimeOperation: 'Loading' }),
    );
    expect(result).toEqual(
      expect.objectContaining({ laytimeOperation: 'Loading' }),
    );
  });

  it.each([
    ['dry_bulk', 'dry_bulk'],
    ['tanker', 'tanker'],
  ] as const)(
    'persists bulkOperationType = %s when updating a voyage',
    async (bulkOperationType) => {
      const voyage = {
        id: VOYAGE_ID,
        vesselId: VESSEL_ID,
        bulkOperationType: null,
        charterParty: null,
        counterpartyLinks: [],
      } as Voyage;
      const { service, voyages } = buildService(voyage);

      const result = await service.update(VOYAGE_ID, {
        bulkOperationType,
      });

      expect(voyages.save).toHaveBeenCalledWith(
        expect.objectContaining({ bulkOperationType }),
      );
      expect(result).toEqual(expect.objectContaining({ bulkOperationType }));
    },
  );

  it('persists editable voyage metadata and leaves omitted fields unchanged', async () => {
    const voyage = {
      id: VOYAGE_ID,
      vesselId: VESSEL_ID,
      cargoQuantity: '65000.00',
      cargoType: 'Iron Ore',
      dischargePort: 'CNSHA',
      eta: null,
      charterParty: null,
      counterpartyLinks: [],
    } as Voyage;
    const { service, voyages } = buildService(voyage);

    const result = await service.update(VOYAGE_ID, {
      cargoQuantity: 67000,
      dischargePort: 'SGSIN',
      eta: '2026-09-10T04:00:00.000Z',
    });

    expect(voyages.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cargoQuantity: '67000.00',
        cargoType: 'Iron Ore',
        dischargePort: 'SGSIN',
        eta: new Date('2026-09-10T04:00:00.000Z'),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        cargoQuantity: '67000.00',
        cargoType: 'Iron Ore',
        dischargePort: 'SGSIN',
      }),
    );
  });

  it('returns not found when the voyage does not exist', async () => {
    const { service, voyages } = buildService(null as unknown as Voyage);
    voyages.findOne.mockResolvedValueOnce(null);

    await expect(
      service.update(VOYAGE_ID, {
        cargoType: 'LNG',
      }),
    ).rejects.toThrow(`Voyage ${VOYAGE_ID} not found`);
  });

  it('rejects a voyage that exists in another organization', async () => {
    const voyage = {
      id: VOYAGE_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      vesselId: VESSEL_ID,
      charterParty: null,
      counterpartyLinks: [],
    } as Voyage;
    const { service, voyages } = buildService(voyage, ORGANIZATION_ID);
    voyages.findOne.mockImplementation(({ where }) =>
      where.organizationId === ORGANIZATION_ID ? voyage : null,
    );

    await expect(service.findOne(VOYAGE_ID)).rejects.toThrow(
      `Voyage ${VOYAGE_ID} not found`,
    );
  });

  it('persists an explicit SHINC basis clause when the submitted contract basis is SHINC', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      vessel: { id: VESSEL_ID },
      charterParty: {
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: null,
        timeCountingBasis: 'SHINC',
        norNoticePeriod: '6 hours',
        clauses: [
          { id: 'clause-1', clauseType: 'laytime_rate' },
          { id: 'clause-2', clauseType: 'demurrage_rate' },
          { id: 'clause-3', clauseType: 'shex_shinc' },
        ],
      },
      counterpartyLinks: [],
    } as Voyage;
    const { service, manager } = buildService(persistedVoyage);

    await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-20260815-012',
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
      laytimeAllowed: 72,
      demurrageRate: 25000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    });

    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHINC',
        parameters: { shex: false },
      }),
    );
  });

  it('does not fabricate charter-party clauses when the voyage has no commercial terms', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
      organizationId: ORGANIZATION_ID,
      vessel: { id: VESSEL_ID },
      charterParty: null,
      counterpartyLinks: [],
    } as Voyage;
    const { service, manager } = buildService(persistedVoyage);

    await service.create({
      vesselId: VESSEL_ID,
      cargoQuantity: 65000,
      cargoType: 'LNG',
      reference: 'VOY-20260815-011',
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-09-01',
      laycanEnd: '2026-09-05',
    });

    expect(manager.create).not.toHaveBeenCalledWith(
      CharterParty,
      expect.objectContaining({ voyageId: VOYAGE_ID }),
    );
    expect(manager.create).not.toHaveBeenCalledWith(
      CpClause,
      expect.anything(),
    );
    expect(manager.update).not.toHaveBeenCalledWith(
      Voyage,
      VOYAGE_ID,
      expect.objectContaining({ charterPartyId: expect.anything() }),
    );
  });

  it('reconstructs voyage summary from persisted relations on the voyage record', async () => {
    const voyage = {
      id: VOYAGE_ID,
      status: 'Active',
      laycanEnd: '2026-12-31',
      charterParty: {
        id: 'charter-party-1',
        clauses: [{ id: 'clause-1' }],
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: '12500.00',
        timeCountingBasis: '6h SHINC',
        norNoticePeriod: '12 hours',
      },
      counterpartyLinks: [
        {
          id: 'supplier-link',
          role: 'Supplier',
          counterparty: { name: 'Vitol Asia' },
        },
        {
          id: 'receiver-link',
          role: 'Receiver',
          counterparty: { name: 'PetroChina' },
        },
      ],
    } as Voyage;
    const { service, voyages } = buildService(voyage);

    const summary = await service.findSummary(VOYAGE_ID);

    expect(voyages.findOne).toHaveBeenCalledWith({
      where: {
        id: VOYAGE_ID,
        organizationId: ORGANIZATION_ID,
      },
      relations: {
        vessel: true,
        charterParty: { clauses: true },
        counterpartyLinks: { counterparty: true },
      },
    });
    expect((service as any).laytimeCalculations.findOne).toHaveBeenCalledWith({
      where: { voyageId: VOYAGE_ID, parentCalculationId: IsNull() },
      order: { version: 'DESC' },
    });
    expect(summary.parties).toEqual({
      supplier: 'Vitol Asia',
      receiver: 'PetroChina',
    });
    expect(summary.commercialTerms).toEqual({
      laytimeAllowed: 72,
      demurrageRate: '25000.00',
      dispatchRate: '12500.00',
      timeCountingBasis: '6h SHINC',
      norNoticePeriod: '12 hours',
    });
  });
});
