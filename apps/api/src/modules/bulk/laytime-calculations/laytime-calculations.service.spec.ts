import { ConflictException } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { normalizeCommercialTermsToClauses } from '../charter-party-terms';
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
  options?: Partial<{
    cargoQuantity: string;
    laytimeOperation: 'Loading' | 'Discharge';
    sofDocuments: Array<{
      id: string;
      status: 'Draft' | 'Final';
      uploadDate: Date;
      operation?: 'Loading' | 'Discharge' | null;
    }>;
    norDocuments: Array<{
      id: string;
      tenderTime: Date;
      acceptedTime?: Date | null;
    }>;
    sofEvents: Array<{
      id: string;
      sofId: string;
      eventTime: Date;
      eventType: string;
      operation?: 'Loading' | 'Discharge' | null;
      isManualOverride: boolean;
    }>;
  }>,
) {
  const calculations = {
    findOne: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    save: jest.fn(async (calculation) => calculation),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
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
      parentCalculationId: null,
      operation: null,
      periods: [],
    }),
  };
  const dataSource = {
    transaction: jest.fn((work) => work(manager)),
  };
  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue({
      id: VOYAGE_ID,
      cargoQuantity: options?.cargoQuantity ?? '20000.00',
      laytimeOperation: options?.laytimeOperation ?? 'Discharge',
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
    find: jest.fn().mockResolvedValue(
      options?.norDocuments ?? [
        {
          id: 'nor-1',
          tenderTime: new Date('2026-03-04T00:00:00Z'),
          acceptedTime: new Date('2026-03-04T00:00:00Z'),
        },
      ],
    ),
  };
  const sofDocuments = {
    find: jest.fn().mockResolvedValue(
      options?.sofDocuments ?? [
        {
          id: 'sof-1',
          status: 'Final',
          uploadDate: new Date('2026-03-03T00:00:00Z'),
          operation: options?.laytimeOperation ?? 'Discharge',
        },
      ],
    ),
  };
  const sofEvents = {
    find: jest.fn().mockResolvedValue(
      options?.sofEvents ?? [
        {
          id: 'completion-1',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-06T06:00:00Z'),
          eventType: 'CARGO_COMPLETED',
          operation: null,
          isManualOverride: false,
        },
      ],
    ),
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
  const mixedOperationWarning =
    'SOF contains both Loading and Discharge operation-specific completion events. Calculation used the voyage laytimeOperation to select the applicable completion evidence.';

  it('persists a new draft calculation at MAX(version) + 1 without updating prior versions', async () => {
    const { service, calculations, manager } = buildService(4);

    const result = await service.calculate(VOYAGE_ID);

    expect(result.calculation.version).toBe(5);
    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        parentCalculationId: null,
        operation: null,
        version: 5,
        status: 'Draft',
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('finds only parent calculations when listing voyage laytime calculations', async () => {
    const { service, calculations } = buildService();
    const parentCalculation = {
      id: 'parent-calculation',
      voyageId: VOYAGE_ID,
      parentCalculationId: null,
      operation: null,
      version: 3,
    } as LaytimeCalculation;
    calculations.findAndCount.mockResolvedValue([[parentCalculation], 1]);

    const result = await service.findForVoyage(
      VOYAGE_ID,
      { skip: 0, limit: 10, page: 1 } as never,
    );

    expect(calculations.findAndCount).toHaveBeenCalledWith({
      where: { voyageId: VOYAGE_ID, parentCalculationId: IsNull() },
      order: { version: 'DESC' },
      skip: 0,
      take: 10,
    });
    expect(result.data).toEqual([parentCalculation]);
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
          voyage: expect.objectContaining({
            laytimeOperation: 'Discharge',
          }),
          norDocuments: [
            expect.objectContaining({
              id: 'nor-1',
              tenderTime: '2026-03-04T00:00:00.000Z',
              acceptedTime: '2026-03-04T00:00:00.000Z',
            }),
          ],
          sofEvents: [
            expect.objectContaining({
              id: 'completion-1',
              eventType: 'CARGO_COMPLETED',
              operation: null,
              operationClassification: 'global',
            }),
          ],
          calculationEventSelection: expect.objectContaining({
            rule: 'exclude-explicit-mismatched-operation-completion-events',
            includedEventIds: ['completion-1'],
            excludedEventIds: [],
          }),
          operationSelection: expect.objectContaining({
            voyageLaytimeOperation: 'Discharge',
            hasLoadingCompletion: false,
            hasDischargeCompletion: false,
            mixedOperationEvidence: false,
            includedCompletionEventIds: [],
            excludedCompletionEventIds: [],
          }),
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

  it.each([
    {
      voyageOperation: 'Loading' as const,
      matchingDocumentOperation: 'Loading' as const,
      oppositeDocumentOperation: 'Discharge' as const,
    },
    {
      voyageOperation: 'Discharge' as const,
      matchingDocumentOperation: 'Discharge' as const,
      oppositeDocumentOperation: 'Loading' as const,
    },
  ])(
    'includes matching and legacy-null documents while excluding opposite-operation documents for voyage operation = %s',
    async ({
      voyageOperation,
      matchingDocumentOperation,
      oppositeDocumentOperation,
    }) => {
      const { service, manager } = buildServiceWithCharterParty(
        0,
        undefined,
        {
          laytimeOperation: voyageOperation,
          sofDocuments: [
            {
              id: 'matching-doc',
              status: 'Final',
              uploadDate: new Date('2026-03-03T00:00:00Z'),
              operation: matchingDocumentOperation,
            },
            {
              id: 'legacy-doc',
              status: 'Final',
              uploadDate: new Date('2026-03-03T01:00:00Z'),
              operation: null,
            },
            {
              id: 'opposite-doc',
              status: 'Final',
              uploadDate: new Date('2026-03-03T02:00:00Z'),
              operation: oppositeDocumentOperation,
            },
          ],
          sofEvents: [
            {
              id: 'matching-completion',
              sofId: 'matching-doc',
              eventTime: new Date('2026-03-05T00:00:00Z'),
              eventType:
                voyageOperation === 'Loading'
                  ? 'LOADING_COMPLETED'
                  : 'DISCHARGE_COMPLETED',
              operation: voyageOperation,
              isManualOverride: false,
            },
            {
              id: 'legacy-completion',
              sofId: 'legacy-doc',
              eventTime: new Date('2026-03-05T06:00:00Z'),
              eventType:
                voyageOperation === 'Loading'
                  ? 'DISCHARGE_COMPLETED'
                  : 'LOADING_COMPLETED',
              operation: null,
              isManualOverride: false,
            },
            {
              id: 'opposite-completion',
              sofId: 'opposite-doc',
              eventTime: new Date('2026-03-05T12:00:00Z'),
              eventType:
                voyageOperation === 'Loading'
                  ? 'DISCHARGE_COMPLETED'
                  : 'LOADING_COMPLETED',
              operation: oppositeDocumentOperation,
              isManualOverride: false,
            },
          ],
        },
      );

      await service.calculate(VOYAGE_ID);

      const created = manager.create.mock.calls.find(
        ([entity]) => entity === LaytimeCalculation,
      )?.[1] as LaytimeCalculation;

      expect(created.warnings).not.toContain(
        'Legacy unscoped SOF evidence was used because no operation-matching SOF document existed for the voyage laytime operation.',
      );
      expect(created.inputSnapshot).toEqual(
        expect.objectContaining({
          sofDocumentSelection: expect.objectContaining({
            voyageLaytimeOperation: voyageOperation,
            candidateDocumentIds: ['matching-doc', 'legacy-doc', 'opposite-doc'],
            includedDocumentIds: ['matching-doc', 'legacy-doc'],
            excludedDocumentIds: ['opposite-doc'],
            matchingDocumentIds: ['matching-doc'],
            legacyNullDocumentIds: ['legacy-doc'],
            oppositeOperationDocumentIds: ['opposite-doc'],
            rule: 'matching-operation-plus-legacy-null',
          }),
          sofDocuments: [
            expect.objectContaining({ id: 'matching-doc', operation: voyageOperation }),
            expect.objectContaining({ id: 'legacy-doc', operation: null }),
            expect.objectContaining({ id: 'opposite-doc', operation: oppositeDocumentOperation }),
          ],
          sofEvents: [
            expect.objectContaining({ id: 'matching-completion' }),
            expect.objectContaining({ id: 'legacy-completion' }),
          ],
        }),
      );
    },
  );

  it('uses legacy null documents with a warning when no operation-matching document exists', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      undefined,
      {
        laytimeOperation: 'Loading',
        sofDocuments: [
          {
            id: 'legacy-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: null,
          },
        ],
        sofEvents: [
          {
            id: 'legacy-completion',
            sofId: 'legacy-doc',
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const created = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(created.warnings).toContain(
      'Legacy unscoped SOF evidence was used because no operation-matching SOF document existed for the voyage laytime operation.',
    );
    expect((created.inputSnapshot as Record<string, any>).sofDocumentSelection).toEqual(
      expect.objectContaining({
        voyageLaytimeOperation: 'Loading',
        matchingDocumentIds: [],
        legacyNullDocumentIds: ['legacy-doc'],
        oppositeOperationDocumentIds: [],
        includedDocumentIds: ['legacy-doc'],
      }),
    );
  });

  it('fails when only opposite-operation documents exist', async () => {
    const { service } = buildServiceWithCharterParty(
      0,
      undefined,
      {
        laytimeOperation: 'Loading',
        sofDocuments: [
          {
            id: 'opposite-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Discharge',
          },
        ],
      },
    );

    await expect(service.calculate(VOYAGE_ID)).rejects.toThrow(
      'No applicable SOF document exists for voyage laytime operation Loading',
    );
  });

  it('keeps Final precedence even when a Draft document matches the voyage operation', async () => {
    const { service } = buildServiceWithCharterParty(
      0,
      undefined,
      {
        laytimeOperation: 'Loading',
        sofDocuments: [
          {
            id: 'draft-match',
            status: 'Draft',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'final-opposite',
            status: 'Final',
            uploadDate: new Date('2026-03-04T00:00:00Z'),
            operation: 'Discharge',
          },
        ],
      },
    );

    await expect(service.calculate(VOYAGE_ID)).rejects.toThrow(
      'No applicable SOF document exists for voyage laytime operation Loading',
    );
  });

  it.each([
    {
      voyageOperation: 'Loading' as const,
      matchingEventType: 'LOADING_COMPLETED',
      mismatchedEventType: 'DISCHARGE_COMPLETED',
    },
    {
      voyageOperation: 'Discharge' as const,
      matchingEventType: 'DISCHARGE_COMPLETED',
      mismatchedEventType: 'LOADING_COMPLETED',
    },
  ])(
    'classifies SOF events for voyage operation = %s without filtering the engine input',
    async ({ voyageOperation, matchingEventType, mismatchedEventType }) => {
      const sofEvents = [
        {
          id: 'global-nor',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T00:00:00Z'),
          eventType: 'NOR_TENDERED',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'global-weather',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T06:00:00Z'),
          eventType: 'RAIN_STOPPAGE',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'legacy-null-completion',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T12:00:00Z'),
          eventType: voyageOperation === 'Loading' ? 'DISCHARGE_COMPLETED' : 'LOADING_COMPLETED',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'matching-op',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-05T00:00:00Z'),
          eventType: matchingEventType,
          operation: voyageOperation,
          isManualOverride: false,
        },
        {
          id: 'mismatched-op',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-05T12:00:00Z'),
          eventType: mismatchedEventType,
          operation: voyageOperation === 'Loading' ? 'Discharge' : 'Loading',
          isManualOverride: false,
        },
      ] as const;

      const { service, manager } = buildServiceWithCharterParty(
        0,
        {
          laytimeAllowed: 48,
          demurrageRate: '12000.00',
          dispatchRate: null,
          timeCountingBasis: null,
          norNoticePeriod: '6 hours',
        },
        {
          laytimeOperation: voyageOperation,
          sofEvents: sofEvents as unknown as Array<{
            id: string;
            sofId: string;
            eventTime: Date;
            eventType: string;
            operation?: 'Loading' | 'Discharge' | null;
            isManualOverride: boolean;
          }>,
        },
      );

      const result = await service.calculate(VOYAGE_ID);

      const created = manager.create.mock.calls.find(
        ([entity]) => entity === LaytimeCalculation,
      )?.[1] as LaytimeCalculation;
      const snapshotEvents = (created.inputSnapshot as Record<string, any>).sofEvents;

      expect(snapshotEvents).toEqual([
        expect.objectContaining({
          id: 'global-nor',
          operationClassification: 'global',
        }),
        expect.objectContaining({
          id: 'global-weather',
          operationClassification: 'global',
        }),
        expect.objectContaining({
          id: 'legacy-null-completion',
          operationClassification: 'legacy-null',
        }),
        expect.objectContaining({
          id: 'matching-op',
          operationClassification: 'matching-operation',
        }),
        expect.objectContaining({
          id: 'mismatched-op',
          operationClassification: 'mismatched-operation',
        }),
      ]);
      expect(snapshotEvents).toHaveLength(5);
      expect(created.inputSnapshot).toEqual(
        expect.objectContaining({
          calculationEventSelection: expect.objectContaining({
            rule: 'exclude-explicit-mismatched-operation-completion-events',
            includedEventIds: [
              'global-nor',
              'global-weather',
              'legacy-null-completion',
              'matching-op',
            ],
            excludedEventIds: ['mismatched-op'],
          }),
          operationSelection: expect.objectContaining({
            voyageLaytimeOperation: voyageOperation,
            hasLoadingCompletion: true,
            hasDischargeCompletion: true,
            mixedOperationEvidence: true,
            includedCompletionEventIds: ['matching-op'],
            excludedCompletionEventIds: ['mismatched-op'],
          }),
        }),
      );
      expect(created.usedLaytime).toBe('0 days 18:00:00');
      expect(created.demurrageAmount).toBe('0.00');
      expect(created.warnings).toContain(mixedOperationWarning);
      expect(
        (created.decisionSnapshot as Record<string, any>).cargoCompletion,
      ).toEqual(
        expect.objectContaining({
          eventId: 'matching-op',
          eventType: matchingEventType,
        }),
      );
      expect(result.calculation.periods).toHaveLength(0);
    },
  );

  it('preserves previous behavior when all completion rows are legacy null-operation events', async () => {
    const sofEvents = [
      {
        id: 'global-nor',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-04T00:00:00Z'),
        eventType: 'NOR_TENDERED',
        operation: null,
        isManualOverride: false,
      },
      {
        id: 'legacy-loading',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-05T00:00:00Z'),
        eventType: 'LOADING_COMPLETED',
        operation: null,
        isManualOverride: false,
      },
      {
        id: 'legacy-discharge',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'DISCHARGE_COMPLETED',
        operation: null,
        isManualOverride: false,
      },
    ] as const;

    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        laytimeAllowed: 48,
        demurrageRate: '12000.00',
        dispatchRate: null,
        timeCountingBasis: null,
        norNoticePeriod: '6 hours',
      },
      {
        laytimeOperation: 'Loading',
        sofEvents: sofEvents as unknown as Array<{
          id: string;
          sofId: string;
          eventTime: Date;
          eventType: string;
          operation?: 'Loading' | 'Discharge' | null;
          isManualOverride: boolean;
        }>,
      },
    );

    await service.calculate(VOYAGE_ID);

    const created = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;
    const snapshotEvents = (created.inputSnapshot as Record<string, any>).sofEvents;

    expect(snapshotEvents).toEqual([
      expect.objectContaining({ id: 'global-nor', operationClassification: 'global' }),
      expect.objectContaining({ id: 'legacy-loading', operationClassification: 'legacy-null' }),
      expect.objectContaining({ id: 'legacy-discharge', operationClassification: 'legacy-null' }),
    ]);
    expect((created.inputSnapshot as Record<string, any>).calculationEventSelection).toEqual(
      expect.objectContaining({
        includedEventIds: ['global-nor', 'legacy-loading', 'legacy-discharge'],
        excludedEventIds: [],
      }),
    );
    expect((created.inputSnapshot as Record<string, any>).operationSelection).toEqual(
      expect.objectContaining({
        voyageLaytimeOperation: 'Loading',
        hasLoadingCompletion: false,
        hasDischargeCompletion: false,
        mixedOperationEvidence: false,
        includedCompletionEventIds: [],
        excludedCompletionEventIds: [],
      }),
    );
  });

  it.each([
    {
      label: 'Loading only',
      voyageOperation: 'Loading' as const,
      completionEventType: 'LOADING_COMPLETED',
      completionOperation: 'Loading' as const,
    },
    {
      label: 'Discharge only',
      voyageOperation: 'Discharge' as const,
      completionEventType: 'DISCHARGE_COMPLETED',
      completionOperation: 'Discharge' as const,
    },
  ])('does not warn when only $label evidence is present', async ({
    voyageOperation,
    completionEventType,
    completionOperation,
  }) => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        laytimeAllowed: 48,
        demurrageRate: '12000.00',
        dispatchRate: null,
        timeCountingBasis: null,
        norNoticePeriod: '6 hours',
      },
      {
        laytimeOperation: voyageOperation,
        sofEvents: [
          {
            id: 'global-nor',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-04T00:00:00Z'),
            eventType: 'NOR_TENDERED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'explicit-completion',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: completionEventType,
            operation: completionOperation,
            isManualOverride: false,
          },
          {
            id: 'legacy-completion',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType:
              completionEventType === 'LOADING_COMPLETED'
                ? 'DISCHARGE_COMPLETED'
                : 'LOADING_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ] as Array<{
          id: string;
          sofId: string;
          eventTime: Date;
          eventType: string;
          operation?: 'Loading' | 'Discharge' | null;
          isManualOverride: boolean;
        }>,
      },
    );

    await service.calculate(VOYAGE_ID);

    const created = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(created.warnings).not.toContain(mixedOperationWarning);
    expect((created.inputSnapshot as Record<string, any>).operationSelection).toEqual(
      expect.objectContaining({
        voyageLaytimeOperation: voyageOperation,
        hasLoadingCompletion:
          voyageOperation === 'Loading',
        hasDischargeCompletion:
          voyageOperation === 'Discharge',
        mixedOperationEvidence: false,
      }),
    );
  });

  it('prefers persisted clause rows over normalized charter-party commercial terms', async () => {
    const persistedClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
    ];

    const { service, charterParty, manager } = buildServiceWithCharterParty(0, {
      clauses: persistedClauses,
      laytimeAllowed: 72,
      demurrageRate: '15000.00',
      dispatchRate: '7500.00',
      timeCountingBasis: 'SHEX',
      norNoticePeriod: '6 hours',
    });

    await service.calculate(VOYAGE_ID);

    expect(charterParty.clauses).toEqual(persistedClauses);
    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          charterParty: expect.objectContaining({
            clauses: persistedClauses,
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          commencement: expect.objectContaining({
            noticeHours: 4,
            noticeSource: 'charter_party',
          }),
          allowedLaytime: expect.objectContaining({
            clauseParameters: { hours: 96, noticeHours: 4 },
          }),
          demurrage: expect.objectContaining({
            ratePerDay: 20000,
          }),
          despatch: expect.objectContaining({
            explicitRate: 10000,
            pricingBasis: 'explicit_rate',
          }),
        }),
      }),
    );
  });

  it('honours persisted WIBON across a Sunday without falling back to normalized charter-party terms', async () => {
    const weekendNorDocuments = [
      {
        id: 'nor-1',
        tenderTime: new Date('2026-03-06T00:00:00Z'),
        acceptedTime: new Date('2026-03-06T00:00:00Z'),
      },
    ];
    const weekendSofEvents = [
      {
        id: 'completion-1',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-09T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        isManualOverride: false,
      },
    ];
    const wibonClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-wibon',
        clauseType: 'wibon',
        rawText: 'WIBON enabled',
        parameters: { enabled: true },
      },
    ];
    const shexClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-shex',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHEX',
        parameters: { shex: true },
      },
    ];

    const wibon = buildServiceWithCharterParty(
      0,
      {
        clauses: wibonClauses,
        laytimeAllowed: 72,
        demurrageRate: '15000.00',
        dispatchRate: '7500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
      },
      {
        norDocuments: weekendNorDocuments,
        sofEvents: weekendSofEvents,
      },
    );

    await wibon.service.calculate(VOYAGE_ID);

    expect(wibon.charterParty.clauses).toEqual(wibonClauses);
    const wibonCreate = wibon.manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(wibonCreate).toEqual(
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          charterParty: expect.objectContaining({
            clauses: wibonClauses,
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          wibon: expect.objectContaining({
            clauseId: 'persisted-wibon',
            enabled: true,
            applied: true,
          }),
        }),
        usedLaytime: '3 days 02:00:00',
        demurrageAmount: '0.00',
      }),
    );
    expect(
      (wibonCreate.decisionSnapshot as Record<string, unknown>).periods as Array<{
        periodType: string;
      }>,
    ).toEqual([
      expect.objectContaining({ periodType: 'laytime' }),
    ]);

    const shex = buildServiceWithCharterParty(
      0,
      {
        clauses: shexClauses,
        laytimeAllowed: 72,
        demurrageRate: '15000.00',
        dispatchRate: '7500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
      },
      {
        norDocuments: weekendNorDocuments,
        sofEvents: weekendSofEvents,
      },
    );

    await shex.service.calculate(VOYAGE_ID);

    const shexCreate = shex.manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;
    expect(
      (shexCreate.decisionSnapshot as Record<string, unknown>).periods as Array<{
        periodType: string;
      }>,
    ).toEqual([
      expect.objectContaining({ periodType: 'laytime' }),
      expect.objectContaining({ periodType: 'exception' }),
      expect.objectContaining({ periodType: 'laytime' }),
    ]);
    expect(shexCreate.usedLaytime).toBe('2 days 02:00:00');
  });

  it('records persisted WIPON as a recognized no-op with a limitation note', async () => {
    const weekendNorDocuments = [
      {
        id: 'nor-1',
        tenderTime: new Date('2026-03-06T00:00:00Z'),
        acceptedTime: new Date('2026-03-06T00:00:00Z'),
      },
    ];
    const weekendSofEvents = [
      {
        id: 'completion-1',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-09T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        isManualOverride: false,
      },
    ];
    const wiponClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-wipon',
        clauseType: 'wipon',
        rawText: 'WIPON enabled',
        parameters: { enabled: true },
      },
    ];

    const wipon = buildServiceWithCharterParty(
      0,
      {
        clauses: wiponClauses,
        laytimeAllowed: 72,
        demurrageRate: '15000.00',
        dispatchRate: '7500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
      },
      {
        norDocuments: weekendNorDocuments,
        sofEvents: weekendSofEvents,
      },
    );

    await wipon.service.calculate(VOYAGE_ID);

    expect(wipon.charterParty.clauses).toEqual(wiponClauses);
    const wiponCreate = wipon.manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(wiponCreate).toEqual(
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          charterParty: expect.objectContaining({
            clauses: wiponClauses,
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          wipon: expect.objectContaining({
            clauseId: 'persisted-wipon',
            enabled: true,
            applied: true,
            limitation:
              'Port-limit status is not currently modeled; timing is unchanged.',
          }),
        }),
        usedLaytime: '3 days 02:00:00',
      }),
    );
  });

  it('records weather working day deductions in the decision snapshot when enabled', async () => {
    const weatherWorkingClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-weather-working',
        clauseType: 'weather_working',
        rawText: 'Weather working days enabled',
        parameters: { enabled: true },
      },
    ];

    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: weatherWorkingClauses,
        laytimeAllowed: 72,
        demurrageRate: '15000.00',
        dispatchRate: '7500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '4 hours',
      },
      {
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'weather-start',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-07T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
            isManualOverride: false,
          },
          {
            id: 'weather-end',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-07T12:00:00Z'),
            eventType: 'RAIN_STOPPED',
            isManualOverride: false,
          },
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-09T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const savedCalculation = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(savedCalculation).toEqual(
      expect.objectContaining({
        usedLaytime: '2 days 14:00:00',
        decisionSnapshot: expect.objectContaining({
          weatherWorking: expect.objectContaining({
            clauseId: 'persisted-weather-working',
            enabled: true,
            applied: true,
            totalWeatherTimeDeductedBeforeDemurrage: 43200,
          }),
        }),
      }),
    );
  });

  it('records when demurrage starts and which exceptions were ignored after that point', async () => {
    const weekendNorDocuments = [
      {
        id: 'nor-1',
        tenderTime: new Date('2026-03-06T00:00:00Z'),
        acceptedTime: new Date('2026-03-06T00:00:00Z'),
      },
    ];
    const weekendSofEvents = [
      {
        id: 'completion-1',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-09T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        isManualOverride: false,
      },
    ];
    const persistedClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 30h\nNOR notice: 6 hours',
        parameters: { hours: 30, noticeHours: 6 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-shex',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHEX',
        parameters: { shex: true },
      },
    ];

    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: persistedClauses,
        laytimeAllowed: 30,
        demurrageRate: '20000.00',
        dispatchRate: '10000.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
      },
      {
        norDocuments: weekendNorDocuments,
        sofEvents: weekendSofEvents,
      },
    );

    await service.calculate(VOYAGE_ID);

    const savedCalculation = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(savedCalculation).toEqual(
      expect.objectContaining({
        usedLaytime: '3 days 00:00:00',
        decisionSnapshot: expect.objectContaining({
          demurrage: expect.objectContaining({
            startedAt: '2026-03-07T12:00:00.000Z',
            ignoredExceptions: [
              expect.objectContaining({
                startTime: '2026-03-08T00:00:00.000Z',
                endTime: '2026-03-09T00:00:00.000Z',
                reason: 'already_on_demurrage',
              }),
            ],
          }),
        }),
      }),
    );
  });

  it('honours an explicit persisted SHINC clause across a Sunday and contrasts with SHEX', async () => {
    const weekendNorDocuments = [
      {
        id: 'nor-1',
        tenderTime: new Date('2026-03-06T00:00:00Z'),
        acceptedTime: new Date('2026-03-06T00:00:00Z'),
      },
    ];
    const weekendSofEvents = [
      {
        id: 'completion-1',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-09T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        isManualOverride: false,
      },
    ];
    const shincClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-shinc',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHINC',
        parameters: { shex: false },
      },
    ];
    const shexClauses = [
      {
        id: 'persisted-laytime',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 96h\nNOR notice: 4 hours',
        parameters: { hours: 96, noticeHours: 4 },
      },
      {
        id: 'persisted-demurrage',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $20,000/day',
        parameters: { rate: 20000 },
      },
      {
        id: 'persisted-despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $10,000/day',
        parameters: { rate: 10000 },
      },
      {
        id: 'persisted-shex',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHEX',
        parameters: { shex: true },
      },
    ];

    const shinc = buildServiceWithCharterParty(
      0,
      {
        clauses: shincClauses,
        laytimeAllowed: 72,
        demurrageRate: '15000.00',
        dispatchRate: '7500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
      },
      {
        norDocuments: weekendNorDocuments,
        sofEvents: weekendSofEvents,
      },
    );

    await shinc.service.calculate(VOYAGE_ID);

    expect(shinc.charterParty.clauses).toEqual(shincClauses);
    const shincCreate = shinc.manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(shincCreate).toEqual(
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          charterParty: expect.objectContaining({
            clauses: shincClauses,
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          commencement: expect.objectContaining({
            noticeHours: 4,
          }),
          allowedLaytime: expect.objectContaining({
            clauseParameters: { hours: 96, noticeHours: 4 },
          }),
        }),
        allowedLaytime: '4 days 00:00:00',
        usedLaytime: '3 days 02:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '9166.67',
      }),
    );
    expect(
      (shincCreate.decisionSnapshot as Record<string, unknown>).periods as Array<{
        periodType: string;
      }>,
    ).toEqual([
      expect.objectContaining({
        periodType: 'laytime',
      }),
    ]);

    const shex = buildServiceWithCharterParty(
      0,
      {
        clauses: shexClauses,
        laytimeAllowed: 72,
        demurrageRate: '15000.00',
        dispatchRate: '7500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '6 hours',
      },
      {
        norDocuments: weekendNorDocuments,
        sofEvents: weekendSofEvents,
      },
    );

    await shex.service.calculate(VOYAGE_ID);

    const shexCreate = shex.manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(shexCreate).toEqual(
      expect.objectContaining({
        usedLaytime: '2 days 02:00:00',
      }),
    );
    expect(
      (shexCreate.decisionSnapshot as Record<string, unknown>).periods as Array<{
        periodType: string;
      }>,
    ).toEqual([
      expect.objectContaining({ periodType: 'laytime' }),
      expect.objectContaining({ periodType: 'exception' }),
      expect.objectContaining({ periodType: 'laytime' }),
    ]);
  });

  it('reconstructs normalized commercial terms from charter-party columns when clause rows are absent', async () => {
    const { service, charterParty, manager } = buildServiceWithCharterParty(0, {
      clauses: [],
      laytimeAllowed: 72,
      demurrageRate: '2500.00',
      dispatchRate: '12500.00',
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '12 hours',
    });

    await service.calculate(VOYAGE_ID);

    expect(charterParty.clauses).toEqual([]);
    expect(manager.create).toHaveBeenCalledWith(
      LaytimeCalculation,
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          charterParty: expect.objectContaining({
            clauses: normalizeCommercialTermsToClauses({
              id: 'charter-party-1',
              laytimeAllowed: 72,
              demurrageRate: '2500.00',
              dispatchRate: '12500.00',
              timeCountingBasis: 'SHINC',
              norNoticePeriod: '12 hours',
            }),
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          allowedLaytime: expect.objectContaining({
            clauseParameters: { hours: 72, noticeHours: 12 },
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
      expect.objectContaining({
        version: 2,
        status: 'Draft',
        parentCalculationId: null,
        operation: null,
      }),
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
