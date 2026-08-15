import { DataSource, Repository } from 'typeorm';
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
import { VoyagesService } from './voyages.service';

const VOYAGE_ID = '11111111-1111-4111-8111-111111111111';
const VESSEL_ID = '22222222-2222-4222-8222-222222222222';

function buildService(voyage: Partial<Voyage>) {
  const voyages = {
    findOne: jest.fn().mockResolvedValue(voyage),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    merge: jest.fn(),
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
  ];
  let saveCall = 0;

  manager.save.mockImplementation(async (value: unknown) => ({
    ...(value as Record<string, unknown>),
    id: savedIds[saveCall++] ?? `saved-${saveCall}`,
  }));

  const dataSource = {
    transaction: jest.fn((work) => work(manager)),
  };

  return {
    service: new VoyagesService(
      voyages as unknown as Repository<Voyage>,
      vessels as unknown as Repository<Vessel>,
      sofDocuments as unknown as Repository<SofDocument>,
      norDocuments as unknown as Repository<NorDocument>,
      laytimeCalculations as unknown as Repository<LaytimeCalculation>,
      disputes as unknown as Repository<DisputeCaseBulk>,
      dataSource as unknown as DataSource,
    ),
    voyages,
    vessels,
    manager,
    dataSource,
  };
}

describe('VoyagesService voyage persistence', () => {
  it('persists voyage counterparty links and commercial terms when creating a voyage', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
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
      where: { id: VESSEL_ID },
      select: { id: true },
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(
      Voyage,
      expect.objectContaining({
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
    expect(manager.update).toHaveBeenCalledWith(
      Voyage,
      VOYAGE_ID,
      { charterPartyId: 'charter-party-1' },
    );
    expect(voyages.findOne).toHaveBeenCalledWith({
      where: { id: VOYAGE_ID },
      relations: {
        vessel: true,
        charterParty: { clauses: true },
        counterpartyLinks: { counterparty: true },
      },
    });
    expect(result).toBe(persistedVoyage);
  });

  it('persists a SHEX basis clause when the submitted contract basis is SHEX', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
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
      norNoticePeriod: '6 hours',
    });

    expect(manager.create).toHaveBeenCalledWith(
      CpClause,
      expect.objectContaining({
        charterPartyId: 'charter-party-1',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHEX',
        parameters: { shex: true },
      }),
    );
  });

  it('does not fabricate charter-party clauses when the voyage has no commercial terms', async () => {
    const persistedVoyage = {
      id: VOYAGE_ID,
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
      where: { id: VOYAGE_ID },
      relations: {
        vessel: true,
        charterParty: { clauses: true },
        counterpartyLinks: { counterparty: true },
      },
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
