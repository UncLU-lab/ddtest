import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { Voyage } from '../entities/voyage.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { LaytimeCalculationsService } from './laytime-calculations.service';

const VOYAGE_ID = '11111111-1111-4111-8111-111111111111';

function buildService(maximum = 0) {
  const charterParty = {
    id: 'charter-party-1',
    clauses: [
      {
        id: 'laytime-clause',
        clauseType: 'laytime_rate',
        rawText: '48 hours laytime',
        parameters: { hours: 48, noticeHours: 6 },
      },
      {
        id: 'demurrage-clause',
        clauseType: 'demurrage_rate',
        rawText: 'USD 12,000 per day',
        parameters: { rate: 12000 },
      },
    ],
    laytimeAllowed: 48,
    demurrageRate: '12000.00',
    dispatchRate: null,
    timeCountingBasis: null,
    norNoticePeriod: '6 hours',
  };

  return buildServiceWithCharterParty(maximum, charterParty);
}

function buildServiceWithCharterParty(
  maximum = 0,
  charterPartyOverrides?: Partial<{
    id: string;
    clauses: Array<{
      id: string;
      clauseType: string;
      rawText: string;
      parameters: Record<string, unknown>;
    }>;
    laytimeAllowed: number | null;
    demurrageRate: string | null;
    dispatchRate: string | null;
    timeCountingBasis: string | null;
    norNoticePeriod: string | null;
  }>,
) {
  const calculations = {
    findOne: jest.fn(),
    save: jest.fn(async (calculation) => calculation),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maximum }),
    })),
    create: jest.fn((_entity, value) => value),
    save: jest.fn(async (value) =>
      Array.isArray(value) ? value : { ...value, id: 'new-calculation' },
    ),
    findOneOrFail: jest.fn().mockResolvedValue({
      id: 'new-calculation',
      voyageId: VOYAGE_ID,
      version: maximum + 1,
      status: 'Draft',
      periods: [],
    }),
  };
  const dataSource = {
    transaction: jest.fn((work) => work(manager)),
  };
  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue({
      id: VOYAGE_ID,
      cargoQuantity: '20000.00',
    }),
  };
  const charterParty = {
    id: 'charter-party-1',
    clauses: [
      {
        id: 'laytime-clause',
        clauseType: 'laytime_rate',
        rawText: '48 hours laytime',
        parameters: { hours: 48, noticeHours: 6 },
      },
      {
        id: 'demurrage-clause',
        clauseType: 'demurrage_rate',
        rawText: 'USD 12,000 per day',
        parameters: { rate: 12000 },
      },
    ],
    laytimeAllowed: 48,
    demurrageRate: '12000.00',
    dispatchRate: null,
    timeCountingBasis: null,
    norNoticePeriod: '6 hours',
    ...charterPartyOverrides,
  };
  const charterParties = {
    findOne: jest.fn().mockResolvedValue({
      ...charterParty,
    }),
  };
  const norDocuments = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'nor-1',
        tenderTime: new Date('2026-03-04T00:00:00Z'),
        acceptedTime: new Date('2026-03-04T00:00:00Z'),
      },
    ]),
  };
  const sofDocuments = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'sof-1',
        status: 'Final',
        uploadDate: new Date('2026-03-03T00:00:00Z'),
      },
    ]),
  };
  const sofEvents = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'completion-1',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-06T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        isManualOverride: false,
      },
    ]),
  };

  return {
    service: new LaytimeCalculationsService(
      calculations as unknown as Repository<LaytimeCalculation>,
      {} as Repository<CalculationPeriod>,
      charterParties as unknown as Repository<CharterParty>,
      norDocuments as unknown as Repository<NorDocument>,
      sofDocuments as unknown as Repository<SofDocument>,
      sofEvents as unknown as Repository<SofEvent>,
      voyagesService as unknown as VoyagesService,
      dataSource as unknown as DataSource,
    ),
    calculations,
    charterParty,
    manager,
  };
}

describe('LaytimeCalculationsService lifecycle', () => {
  it('persists a new draft calculation at MAX(version) + 1 without updating prior versions', async () => {
    const { service, calculations, manager } = buildService(4);

    const result = await service.calculate(VOYAGE_ID);

    expect(result.calculation.version).toBe(5);
    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({ voyageId: VOYAGE_ID, version: 5, status: 'Draft' }),
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('persists selected sources, decisions, warnings, and the engine version', async () => {
    const { service, manager } = buildService();

    await service.calculate(VOYAGE_ID);

    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({
        engineVersion: 'laytime-engine-v1',
        warnings: [],
        inputSnapshot: expect.objectContaining({
          norDocuments: [
            expect.objectContaining({
              id: 'nor-1',
              tenderTime: '2026-03-04T00:00:00.000Z',
              acceptedTime: '2026-03-04T00:00:00.000Z',
            }),
          ],
          sofEvents: [
            expect.objectContaining({ id: 'completion-1', eventType: 'CARGO_COMPLETED' }),
          ],
        }),
        decisionSnapshot: expect.objectContaining({
          commencement: expect.objectContaining({
            basis: 'nor_accepted',
            norDocumentId: 'nor-1',
            noticeHours: 6,
            noticeSource: 'charter_party',
            commencedAt: '2026-03-04T06:00:00.000Z',
          }),
          cargoCompletion: {
            eventId: 'completion-1',
            eventType: 'CARGO_COMPLETED',
            eventTime: '2026-03-06T06:00:00.000Z',
          },
          allowedLaytime: expect.objectContaining({
            clauseId: 'laytime-clause',
            allowedLaytime: '2 days 00:00:00',
          }),
          demurrage: expect.objectContaining({
            clauseId: 'demurrage-clause',
            ratePerDay: 12000,
          }),
        }),
      }),
    );
  });

  it('reconstructs a laytime_rate clause from charter-party columns when clause rows are absent', async () => {
    const { service, charterParty, manager } = buildServiceWithCharterParty(0, {
      clauses: [],
      laytimeAllowed: 72,
      demurrageRate: '2500.00',
      dispatchRate: null,
      timeCountingBasis: '6h SHINC',
      norNoticePeriod: '6 hours',
    });

    await service.calculate(VOYAGE_ID);

    expect(charterParty.clauses).toEqual([]);
    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          charterParty: expect.objectContaining({
            clauses: expect.arrayContaining([
              expect.objectContaining({
                clauseType: 'laytime_rate',
                parameters: { hours: 72, noticeHours: 6 },
              }),
            ]),
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          allowedLaytime: expect.objectContaining({
            clauseParameters: { hours: 72, noticeHours: 6 },
          }),
        }),
      }),
    );
  });

  it('keeps the stored snapshot independent of later source-object changes', async () => {
    const { service, charterParty, manager } = buildService();

    await service.calculate(VOYAGE_ID);
    charterParty.clauses[0].parameters.hours = 96;

    const calculationCreate = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    );
    const savedCalculation = calculationCreate?.[1] as LaytimeCalculation;

    expect(savedCalculation.inputSnapshot).toEqual(
      expect.objectContaining({
        charterParty: expect.objectContaining({
          clauses: expect.arrayContaining([
            expect.objectContaining({ parameters: { hours: 48, noticeHours: 6 } }),
          ]),
        }),
      }),
    );
    expect(savedCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        allowedLaytime: expect.objectContaining({
          clauseParameters: { hours: 48, noticeHours: 6 },
        }),
      }),
    );
  });

  it('creates a new draft version when the previous maximum version is final', async () => {
    const { service, manager } = buildService(1);

    const result = await service.calculate(VOYAGE_ID);

    expect(result.calculation).toEqual(
      expect.objectContaining({ version: 2, status: 'Draft' }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({ version: 2, status: 'Draft' }),
    );
  });

  it('finalizes only the status of a draft calculation', async () => {
    const { service, calculations } = buildService();
    const calculation = {
      id: 'draft-calculation',
      status: 'Draft',
      allowedLaytime: '2 days 00:00:00',
      usedLaytime: '2 days 01:00:00',
      demurrageAmount: '500.00',
      despatchAmount: '0.00',
      inputSnapshot: { norDocuments: [{ id: 'nor-1' }] },
      decisionSnapshot: { commencement: { basis: 'nor_accepted' } },
      warnings: ['snapshot warning'],
      engineVersion: 'laytime-engine-v1',
    } as LaytimeCalculation;
    calculations.findOne.mockResolvedValue(calculation);

    await expect(service.finalize(calculation.id)).resolves.toEqual(
      expect.objectContaining({ status: 'Final' }),
    );
    expect(calculations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Final',
        allowedLaytime: '2 days 00:00:00',
        usedLaytime: '2 days 01:00:00',
        demurrageAmount: '500.00',
        despatchAmount: '0.00',
        inputSnapshot: { norDocuments: [{ id: 'nor-1' }] },
        decisionSnapshot: { commencement: { basis: 'nor_accepted' } },
        warnings: ['snapshot warning'],
        engineVersion: 'laytime-engine-v1',
      }),
    );
  });

  it('rejects finalizing an already final calculation', async () => {
    const { service, calculations } = buildService();
    calculations.findOne.mockResolvedValue({ id: 'final-calculation', status: 'Final' });

    await expect(service.finalize('final-calculation')).rejects.toThrow(
      ConflictException,
    );
    expect(calculations.save).not.toHaveBeenCalled();
  });
});
