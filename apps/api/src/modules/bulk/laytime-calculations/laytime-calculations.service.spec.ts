import { ConflictException } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { NorTenderLocationEvidence } from '../entities/nor-tender-location-evidence.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { normalizeCommercialTermsToClauses } from '../charter-party-terms';
import { Voyage } from '../entities/voyage.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
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
    settlementCurrency: 'USD',
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
    laytimeOperationScope:
      | 'Loading'
      | 'Discharge'
      | 'LoadingAndDischarge'
      | null;
    settlementCurrency: 'USD' | 'EUR' | null;
  }>,
  options?: Partial<{
    cargoQuantity: string;
    laytimeOperation: 'Loading' | 'Discharge';
    bulkOperationType: 'dry_bulk' | 'tanker' | null;
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
    locationEvidence: Array<{
      id: string;
      voyageId: string;
      operation: 'Loading' | 'Discharge';
      evidenceTime: Date;
      portRelation: 'INSIDE_PORT_LIMITS' | 'OUTSIDE_PORT_LIMITS' | 'UNKNOWN';
      berthRelation: 'AT_BERTH' | 'NOT_AT_BERTH' | 'UNKNOWN';
      waitingPlace:
        | 'ANCHORAGE'
        | 'PILOT_STATION'
        | 'CUSTOMARY_WAITING_PLACE'
        | 'OTHER'
        | 'NONE'
        | 'UNKNOWN';
      source: 'MANUAL' | 'SOF' | 'OCR' | 'AIS';
      sofDocumentId?: string | null;
      sourceReference?: string | null;
      note?: string | null;
      norDocumentId?: string | null;
      norTenderedEventId?: string | null;
      createdByUserId: string;
      createdAt: Date;
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
    find: jest.fn(),
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
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
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
  const tenantContext = {
    getOrganizationId: jest
      .fn()
      .mockReturnValue('00000000-0000-0000-0000-000000000001'),
  };
  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue({
      id: VOYAGE_ID,
      cargoQuantity: options?.cargoQuantity ?? '20000.00',
      laytimeOperation: options?.laytimeOperation ?? 'Discharge',
      bulkOperationType:
        options?.bulkOperationType !== undefined
          ? options.bulkOperationType
          : null,
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
    settlementCurrency: 'USD',
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
  const locationEvidence = {
    find: jest.fn().mockResolvedValue(options?.locationEvidence ?? []),
  };

  return {
    service: new LaytimeCalculationsService(
      calculations as unknown as Repository<LaytimeCalculation>,
      {} as Repository<CalculationPeriod>,
      charterParties as unknown as Repository<CharterParty>,
      norDocuments as unknown as Repository<NorDocument>,
      sofDocuments as unknown as Repository<SofDocument>,
      sofEvents as unknown as Repository<SofEvent>,
      locationEvidence as unknown as Repository<NorTenderLocationEvidence>,
      voyagesService as unknown as VoyagesService,
      dataSource as unknown as TenantDatabaseContextService,
      tenantContext as unknown as TenantContextService,
    ),
    calculations,
    charterParty,
    charterParties,
    voyagesService,
    manager,
    locationEvidence,
  };
}

function getCreatedCalculations(manager: { create: jest.Mock }) {
  return manager.create.mock.calls
    .filter(([entity]) => entity === LaytimeCalculation)
    .map(([, value]) => value as LaytimeCalculation);
}

function cpClause(
  id: string,
  clauseType: string,
  parameters: Record<string, unknown>,
  rawText = `${clauseType} ${id}`,
) {
  const normalizedParameters =
    clauseType === 'reversible_laytime' &&
    parameters.enabled === true &&
    parameters.settlementVersion === undefined
      ? {
          ...parameters,
          settlementVersion: 1,
          allowanceMode: 'sum_operation_allowances',
        }
      : parameters;
  return {
    id,
    clauseType,
    rawText,
    parameters: normalizedParameters,
  };
}

function opClause(
  id: string,
  clauseType: string,
  operation: 'Loading' | 'Discharge',
  parameters: Record<string, unknown>,
  rawText = `${clauseType} ${operation} ${id}`,
) {
  return cpClause(id, clauseType, { ...parameters, operation }, rawText);
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
    expect(manager.save).toHaveBeenCalledTimes(4);
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

    const result = await service.findForVoyage(VOYAGE_ID, {
      skip: 0,
      limit: 10,
      page: 1,
    } as never);

    expect(calculations.findAndCount).toHaveBeenCalledWith({
      where: { voyageId: VOYAGE_ID, parentCalculationId: IsNull() },
      order: { version: 'DESC', calculatedAt: 'DESC', id: 'DESC' },
      skip: 0,
      take: 10,
    });
    expect(result.data).toEqual([parentCalculation]);
  });

  it('rejects a laytime calculation that belongs to another organization', async () => {
    const { service, calculations, voyagesService } = buildService();
    calculations.findOne.mockResolvedValueOnce({
      id: 'foreign-calculation',
      voyageId: 'foreign-voyage',
    } as LaytimeCalculation);
    voyagesService.ensureExists.mockRejectedValueOnce(
      new Error('Voyage not found'),
    );

    await expect(service.findOne('foreign-calculation')).rejects.toThrow(
      'Voyage not found',
    );
  });

  it('returns direct Loading and Discharge children in deterministic order', async () => {
    const { service, calculations } = buildService();
    calculations.findOne.mockResolvedValue({
      id: 'parent-calculation',
      voyageId: VOYAGE_ID,
      parentCalculationId: null,
    } as LaytimeCalculation);
    calculations.find.mockResolvedValue([
      {
        id: 'discharge-child',
        voyageId: VOYAGE_ID,
        parentCalculationId: 'parent-calculation',
        operation: 'Discharge',
        version: 3,
        allowedLaytime: '1 days 00:00:00',
        usedLaytime: '1 days 00:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '0.00',
        status: 'Draft',
        calculatedAt: new Date('2026-03-05T12:00:00Z'),
      },
      {
        id: 'loading-child',
        voyageId: VOYAGE_ID,
        parentCalculationId: 'parent-calculation',
        operation: 'Loading',
        version: 3,
        allowedLaytime: '1 days 00:00:00',
        usedLaytime: '1 days 00:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '0.00',
        status: 'Draft',
        calculatedAt: new Date('2026-03-05T06:00:00Z'),
      },
    ] as LaytimeCalculation[]);

    await expect(
      service.findOperationChildren('parent-calculation'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'loading-child',
        operation: 'Loading',
        parentCalculationId: 'parent-calculation',
      }),
      expect.objectContaining({
        id: 'discharge-child',
        operation: 'Discharge',
        parentCalculationId: 'parent-calculation',
      }),
    ]);

    expect(calculations.find).toHaveBeenCalledWith({
      where: { parentCalculationId: 'parent-calculation' },
    });
  });

  it('returns an empty list when a parent has no children', async () => {
    const { service, calculations } = buildService();
    calculations.findOne.mockResolvedValue({
      id: 'parent-calculation',
      voyageId: VOYAGE_ID,
      parentCalculationId: null,
    } as LaytimeCalculation);
    calculations.find.mockResolvedValue([]);

    await expect(
      service.findOperationChildren('parent-calculation'),
    ).resolves.toEqual([]);
  });

  it('rejects unknown calculation ids when looking up operation children', async () => {
    const { service, calculations } = buildService();
    calculations.findOne.mockResolvedValue(null);

    await expect(
      service.findOperationChildren('missing-calculation'),
    ).rejects.toThrow('Laytime calculation missing-calculation not found');

    expect(calculations.find).not.toHaveBeenCalled();
  });

  it('rejects child calculation ids when looking up operation children', async () => {
    const { service, calculations } = buildService();
    calculations.findOne.mockResolvedValue({
      id: 'child-calculation',
      voyageId: VOYAGE_ID,
      parentCalculationId: 'parent-calculation',
      operation: 'Loading',
    } as LaytimeCalculation);

    await expect(
      service.findOperationChildren('child-calculation'),
    ).rejects.toThrow(
      'Laytime calculation child-calculation is a child result and cannot be used as a parent',
    );

    expect(calculations.find).not.toHaveBeenCalled();
  });

  it('persists selected sources, decisions, warnings, and the engine version', async () => {
    const { service, manager } = buildService();

    await service.calculate(VOYAGE_ID);

    const createdCalculations = getCreatedCalculations(manager);
    const parentCalculation = createdCalculations[0];
    const childCalculation = createdCalculations[1];

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        engineVersion: 'laytime-engine-v1',
        warnings: [
          'Free-pratique qualification was not evaluated because grant evidence and an applicable WIFPON clause are missing.',
          'NOR location qualification is unavailable because no eligible candidate-associated location evidence exists.',
          'NOR validity was not evaluated because vessel-readiness evidence is missing.',
        ],
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
            noticeSource: 'noticeHours',
            commencedAt: '2026-03-04T06:00:00.000Z',
            readinessEventId: null,
            readinessTime: null,
            readinessSource: 'missing',
            validityStatus: 'unavailable',
            validityBasis: null,
          }),
          cargoCompletion: expect.objectContaining({
            eventId: 'completion-1',
            eventType: 'CARGO_COMPLETED',
            eventTime: '2026-03-06T06:00:00.000Z',
            selectedEventId: 'completion-1',
            selectedEventType: 'CARGO_COMPLETED',
            selectedTime: '2026-03-06T06:00:00.000Z',
            bulkOperationType: null,
            selectionBasis: 'legacy-completion-fallback',
          }),
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
    expect(childCalculation).toEqual(
      expect.objectContaining({
        parentCalculationId: 'new-calculation',
        operation: 'Discharge',
        voyageId: VOYAGE_ID,
        version: parentCalculation.version,
        status: parentCalculation.status,
        allowedLaytime: parentCalculation.allowedLaytime,
        usedLaytime: parentCalculation.usedLaytime,
        demurrageAmount: parentCalculation.demurrageAmount,
        despatchAmount: parentCalculation.despatchAmount,
        inputSnapshot: expect.objectContaining({
          voyage: expect.objectContaining({
            laytimeOperation: 'Discharge',
          }),
          operationResult: expect.objectContaining({
            operation: 'Discharge',
            source: 'operation-specific-child-calculation',
          }),
        }),
        decisionSnapshot: expect.objectContaining({
          operationResult: expect.objectContaining({
            operation: 'Discharge',
            source: 'operation-specific-child-calculation',
          }),
        }),
      }),
    );
    expect(parentCalculation.inputSnapshot).not.toEqual(
      expect.objectContaining({
        operationResult: expect.anything(),
      }),
    );
    expect(childCalculation.inputSnapshot).toEqual(
      expect.objectContaining({
        operationResult: expect.objectContaining({
          operation: 'Discharge',
          source: 'operation-specific-child-calculation',
        }),
      }),
    );
    expect(childCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        operationResult: expect.objectContaining({
          operation: 'Discharge',
          source: 'operation-specific-child-calculation',
        }),
      }),
    );
    expect(manager.save).toHaveBeenNthCalledWith(
      4,
      expect.arrayContaining([
        expect.objectContaining({
          calculationId: 'new-calculation',
        }),
      ]),
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'persists the exact readiness-valid NOR selected by the engine for a %s child',
    async (operation) => {
      const readinessId = `${operation.toLowerCase()}-ready`;
      const { service, manager } = buildServiceWithCharterParty(0, undefined, {
        laytimeOperation: operation,
        norDocuments: [
          {
            id: 'nor-before-readiness',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
          },
          {
            id: 'nor-after-readiness',
            tenderTime: new Date('2026-03-04T02:00:00Z'),
            acceptedTime: new Date('2026-03-04T03:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: readinessId,
            sofId: 'sof-1',
            eventTime: new Date('2026-03-04T01:00:00Z'),
            eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
            operation,
            isManualOverride: true,
          },
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-06T09:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      });

      await service.calculate(VOYAGE_ID);

      const [parent, child] = getCreatedCalculations(manager);
      for (const calculation of [parent, child]) {
        expect(calculation.decisionSnapshot).toEqual(
          expect.objectContaining({
            commencement: expect.objectContaining({
              basis: 'nor_accepted',
              norDocumentId: 'nor-after-readiness',
              readinessEventId: readinessId,
              readinessSource: 'operation-specific',
              validityStatus: 'valid',
              validityBasis: 'accepted',
              baseTime: '2026-03-04T03:00:00.000Z',
              commencedAt: '2026-03-04T09:00:00.000Z',
              rejectedNorCandidates: [
                expect.objectContaining({
                  norDocumentId: 'nor-before-readiness',
                  validityBasis: 'not-ready',
                }),
              ],
            }),
          }),
        );
      }
    },
  );

  it('retains free-pratique evidence without changing readiness or laytime results', async () => {
    const commonEvents = [
      {
        id: 'loading-ready',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-04T00:00:00Z'),
        eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
        operation: 'Loading' as const,
        isManualOverride: true,
      },
      {
        id: 'completion-1',
        sofId: 'sof-1',
        eventTime: new Date('2026-03-06T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
        isManualOverride: false,
      },
    ];
    const grantEvent = {
      id: 'loading-free-pratique',
      sofId: 'sof-1',
      eventTime: new Date('2026-03-03T23:17:23.450Z'),
      eventType: 'FREE_PRATIQUE_GRANTED',
      operation: 'Loading' as const,
      isManualOverride: true,
    };
    const options = {
      laytimeOperation: 'Loading' as const,
      norDocuments: [
        {
          id: 'nor-1',
          tenderTime: new Date('2026-03-04T00:00:00Z'),
          acceptedTime: new Date('2026-03-04T00:00:00Z'),
        },
      ],
    };
    const baseline = buildServiceWithCharterParty(0, undefined, {
      ...options,
      sofEvents: commonEvents,
    });
    const withGrant = buildServiceWithCharterParty(0, undefined, {
      ...options,
      sofEvents: [...commonEvents, grantEvent],
    });

    await baseline.service.calculate(VOYAGE_ID);
    await withGrant.service.calculate(VOYAGE_ID);

    const baselineParent = getCreatedCalculations(baseline.manager)[0];
    const grantParent = getCreatedCalculations(withGrant.manager)[0];
    expect(grantParent).toEqual(
      expect.objectContaining({
        allowedLaytime: baselineParent.allowedLaytime,
        usedLaytime: baselineParent.usedLaytime,
        demurrageAmount: baselineParent.demurrageAmount,
        despatchAmount: baselineParent.despatchAmount,
      }),
    );
    expect(grantParent.decisionSnapshot.commencement).toEqual(
      expect.objectContaining({
        readinessEventId: 'loading-ready',
        readinessTime: '2026-03-04T00:00:00.000Z',
        freePratique: expect.objectContaining({
          eventId: 'loading-free-pratique',
          grantedTime: '2026-03-03T23:17:23.450Z',
          source: 'operation-specific',
          status: 'granted-before-nor',
          valid: true,
          wifponEnabled: false,
          wifponApplied: false,
        }),
      }),
    );
    expect(grantParent.inputSnapshot).toEqual(
      expect.objectContaining({
        sofEvents: expect.arrayContaining([
          expect.objectContaining({
            id: 'loading-free-pratique',
            eventType: 'FREE_PRATIQUE_GRANTED',
            eventTime: '2026-03-03T23:17:23.450Z',
            operation: 'Loading',
            operationClassification: 'global',
          }),
        ]),
        calculationEventSelection: expect.objectContaining({
          includedEventIds: expect.arrayContaining(['loading-free-pratique']),
        }),
      }),
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'persists WIFPON qualification for the %s parent and child engine paths',
    async (operation) => {
      const clauseId = `wifpon-${operation.toLowerCase()}`;
      const { service, manager } = buildServiceWithCharterParty(
        0,
        {
          clauses: [
            cpClause('laytime-clause', 'laytime_rate', {
              hours: 48,
              noticeHours: 6,
            }),
            cpClause('demurrage-clause', 'demurrage_rate', { rate: 12_000 }),
            cpClause(clauseId, 'wifpon', { enabled: true, operation }),
          ],
        },
        {
          laytimeOperation: operation,
          norDocuments: [
            {
              id: 'wifpon-nor',
              tenderTime: new Date('2026-03-04T10:00:00Z'),
            },
          ],
          sofEvents: [
            {
              id: `ready-${operation.toLowerCase()}`,
              sofId: 'sof-1',
              eventTime: new Date('2026-03-04T09:00:00Z'),
              eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
              operation,
              isManualOverride: true,
            },
            {
              id: 'completion-1',
              sofId: 'sof-1',
              eventTime: new Date('2026-03-06T16:00:00Z'),
              eventType: 'CARGO_COMPLETED',
              operation: null,
              isManualOverride: false,
            },
          ],
        },
      );

      await service.calculate(VOYAGE_ID);

      const [parent, child] = getCreatedCalculations(manager);
      for (const calculation of [parent, child]) {
        expect(calculation.decisionSnapshot).toEqual(
          expect.objectContaining({
            commencement: expect.objectContaining({
              norDocumentId: 'wifpon-nor',
              freePratique: expect.objectContaining({
                eventId: null,
                grantedTime: null,
                source: 'missing',
                status: 'waived-by-wifpon',
                valid: true,
                wifponClauseId: clauseId,
                wifponEnabled: true,
                wifponApplied: true,
              }),
            }),
          }),
        );
      }
    },
  );

  it('persists rejected pre-grant NOR audit and the authoritative post-grant re-tender', async () => {
    const { service, manager } = buildServiceWithCharterParty(0, undefined, {
      laytimeOperation: 'Loading',
      norDocuments: [
        {
          id: 'nor-before-grant',
          tenderTime: new Date('2026-03-04T10:00:00Z'),
        },
        { id: 'nor-after-grant', tenderTime: new Date('2026-03-04T13:00:00Z') },
      ],
      sofEvents: [
        {
          id: 'loading-ready',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T09:00:00Z'),
          eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
          operation: 'Loading',
          isManualOverride: true,
        },
        {
          id: 'loading-free-pratique',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T12:00:00Z'),
          eventType: 'FREE_PRATIQUE_GRANTED',
          operation: 'Loading',
          isManualOverride: true,
        },
        {
          id: 'completion-1',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-06T19:00:00Z'),
          eventType: 'CARGO_COMPLETED',
          operation: null,
          isManualOverride: false,
        },
      ],
    });

    await service.calculate(VOYAGE_ID);

    const [parent, child] = getCreatedCalculations(manager);
    for (const calculation of [parent, child]) {
      expect(calculation.decisionSnapshot.commencement).toEqual(
        expect.objectContaining({
          norDocumentId: 'nor-after-grant',
          tenderTime: '2026-03-04T13:00:00.000Z',
          freePratique: expect.objectContaining({
            eventId: 'loading-free-pratique',
            grantedTime: '2026-03-04T12:00:00.000Z',
            status: 'granted-before-nor',
            valid: true,
          }),
          freePratiqueRejectedCandidates: [
            expect.objectContaining({
              norDocumentId: 'nor-before-grant',
              tenderTime: '2026-03-04T10:00:00.000Z',
              freePratique: expect.objectContaining({
                eventId: 'loading-free-pratique',
                grantedTime: '2026-03-04T12:00:00.000Z',
                status: 'granted-after-nor',
                valid: false,
              }),
            }),
          ],
        }),
      );
    }
  });

  it.each(['Loading', 'Discharge'] as const)(
    'persists the engine-selected office schedule decision for a %s calculation and child',
    async (operation) => {
      const readinessId = `${operation.toLowerCase()}-schedule-ready`;
      const { service, manager } = buildServiceWithCharterParty(
        0,
        {
          clauses: [
            {
              id: 'laytime-clause',
              clauseType: 'laytime_rate',
              rawText: '48 hours laytime',
              parameters: { hours: 48 },
            },
            {
              id: 'demurrage-clause',
              clauseType: 'demurrage_rate',
              rawText: 'USD 12,000 per day',
              parameters: { rate: 12000 },
            },
            {
              id: 'schedule-clause',
              clauseType: 'nor_commencement_schedule',
              rawText: 'Before noon, 13:00; otherwise next working day 08:00',
              parameters: {
                cutoffReference: 'acceptedTime',
                tenderCutoffTime: '12:00',
                sameDayCommencementTime: '13:00',
                nextWorkingDayCommencementTime: '08:00',
                workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
                timeZone: 'UTC',
              },
            },
          ],
        },
        {
          laytimeOperation: operation,
          norDocuments: [
            {
              id: 'schedule-nor',
              tenderTime: new Date('2026-03-02T10:30:00Z'),
              acceptedTime: new Date('2026-03-02T11:00:00Z'),
            },
          ],
          sofEvents: [
            {
              id: readinessId,
              sofId: 'sof-1',
              eventTime: new Date('2026-03-02T10:00:00Z'),
              eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
              operation,
              isManualOverride: true,
            },
            {
              id: 'completion-1',
              sofId: 'sof-1',
              eventTime: new Date('2026-03-04T13:00:00Z'),
              eventType: 'CARGO_COMPLETED',
              operation: null,
              isManualOverride: false,
            },
          ],
        },
      );

      await service.calculate(VOYAGE_ID);

      const [parent, child] = getCreatedCalculations(manager);
      for (const calculation of [parent, child]) {
        expect(calculation.decisionSnapshot).toEqual(
          expect.objectContaining({
            commencement: expect.objectContaining({
              commencementRule: 'office-schedule',
              basis: 'nor_accepted',
              norDocumentId: 'schedule-nor',
              readinessEventId: readinessId,
              validityStatus: 'valid',
              validityBasis: 'accepted',
              baseTime: '2026-03-02T11:00:00.000Z',
              noticeHours: null,
              noticeSource: null,
              scheduleClauseId: 'schedule-clause',
              scheduleBasis: 'same-day',
              scheduleCutoffReference: 'acceptedTime',
              scheduleGoverningTime: '2026-03-02T11:00:00.000Z',
              scheduleCutoffTime: '12:00',
              scheduleLegacyCompatibilityUsed: false,
              scheduleTimeZone: 'UTC',
              scheduleWorkingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
              scheduleLocalNorDate: '2026-03-02',
              scheduleLocalNorTime: '11:00:00',
              scheduleSelectedWorkingDate: '2026-03-02',
              scheduleSelectedLocalCommencementTime: '13:00',
              scheduleSkippedDates: [],
              commencedAt: '2026-03-02T13:00:00.000Z',
            }),
          }),
        );
      }
    },
  );

  it('returns explicit child calculations from findOne without altering child rows', async () => {
    const { service, calculations } = buildService();
    calculations.findOne.mockResolvedValue({
      id: 'child-calculation',
      voyageId: VOYAGE_ID,
      parentCalculationId: 'parent-calculation',
      operation: 'Discharge',
      version: 8,
      status: 'Draft',
    } as LaytimeCalculation);

    await expect(service.findOne('child-calculation')).resolves.toEqual(
      expect.objectContaining({
        id: 'child-calculation',
        parentCalculationId: 'parent-calculation',
        operation: 'Discharge',
      }),
    );
  });

  it.each([
    {
      title:
        'persists enabled ATUTC audit evidence when SHEX overlap is restored',
      clauses: [
        cpClause('laytime-clause', 'laytime_rate', {
          hours: 120,
          noticeHours: 6,
        }),
        cpClause('demurrage-clause', 'demurrage_rate', { rate: 12000 }),
        cpClause('despatch-clause', 'despatch', { rate: 6000 }),
        cpClause('shex-clause', 'shex_shinc', { shex: true }),
        cpClause('atutc-clause', 'atutc', { enabled: true }),
      ],
      laytimeOperation: 'Loading' as const,
      sofEvents: [
        {
          id: 'loading-start',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-08T08:00:00Z'),
          eventType: 'CARGO_STARTED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
        {
          id: 'loading-duplicate-start',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-08T09:00:00Z'),
          eventType: 'CARGO_STARTED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
        {
          id: 'loading-completion',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-09T06:00:00Z'),
          eventType: 'LOADING_COMPLETED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
      ],
      expectedAtutc: expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 57_600,
        restoredIntervals: [
          {
            startTime: '2026-03-08T08:00:00.000Z',
            endTime: '2026-03-09T00:00:00.000Z',
          },
        ],
      }),
      expectedWarning:
        'Duplicate CARGO_STARTED event was ignored while the Loading operation was already working.',
    },
    {
      title:
        'persists enabled ATUTC audit evidence with no qualifying SHEX overlap',
      clauses: [
        cpClause('laytime-clause', 'laytime_rate', {
          hours: 120,
          noticeHours: 6,
        }),
        cpClause('demurrage-clause', 'demurrage_rate', { rate: 12000 }),
        cpClause('despatch-clause', 'despatch', { rate: 6000 }),
        cpClause('shex-clause', 'shex_shinc', { shex: true }),
        cpClause('atutc-clause', 'atutc', { enabled: true }),
      ],
      laytimeOperation: 'Loading' as const,
      sofEvents: [
        {
          id: 'loading-start',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-09T00:00:00Z'),
          eventType: 'CARGO_STARTED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
        {
          id: 'loading-completion',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-09T06:00:00Z'),
          eventType: 'LOADING_COMPLETED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
      ],
      expectedAtutc: expect.objectContaining({
        enabled: true,
        applied: false,
        restoredSeconds: 0,
        restoredIntervals: [],
      }),
      expectedWarning: null,
    },
    {
      title: 'persists disabled ATUTC audit evidence when no clause exists',
      clauses: [
        cpClause('laytime-clause', 'laytime_rate', {
          hours: 120,
          noticeHours: 6,
        }),
        cpClause('demurrage-clause', 'demurrage_rate', { rate: 12000 }),
        cpClause('despatch-clause', 'despatch', { rate: 6000 }),
        cpClause('shex-clause', 'shex_shinc', { shex: true }),
      ],
      laytimeOperation: 'Loading' as const,
      sofEvents: [
        {
          id: 'loading-start',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-09T00:00:00Z'),
          eventType: 'CARGO_STARTED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
        {
          id: 'loading-completion',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-09T06:00:00Z'),
          eventType: 'LOADING_COMPLETED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
      ],
      expectedAtutc: expect.objectContaining({
        enabled: false,
        applied: false,
        restoredSeconds: 0,
        restoredIntervals: [],
      }),
      expectedWarning: null,
    },
  ])(
    '$title',
    async ({
      clauses,
      laytimeOperation,
      sofEvents,
      expectedAtutc,
      expectedWarning,
    }) => {
      const { service, manager } = buildServiceWithCharterParty(
        0,
        {
          clauses,
          laytimeAllowed: 120,
          demurrageRate: '12000.00',
          dispatchRate: '6000.00',
          timeCountingBasis: 'SHEX',
          norNoticePeriod: '6 hours',
        },
        {
          laytimeOperation,
          sofDocuments: [
            {
              id: 'sof-1',
              status: 'Final',
              uploadDate: new Date('2026-03-03T00:00:00Z'),
              operation: laytimeOperation,
            },
          ],
          sofEvents,
        },
      );

      await service.calculate(VOYAGE_ID);

      const parentCalculation = getCreatedCalculations(manager).find(
        (calculation) => calculation.parentCalculationId === null,
      ) as LaytimeCalculation;

      expect(parentCalculation.decisionSnapshot).toEqual(
        expect.objectContaining({
          atutc: expectedAtutc,
        }),
      );
      expect(parentCalculation.allowedLaytime).toBe('5 days 00:00:00');

      if (expectedWarning) {
        expect(parentCalculation.warnings).toContain(expectedWarning);
      } else {
        expect(parentCalculation.warnings).toEqual(expect.any(Array));
      }
    },
  );

  it('uses loading-specific clauses for the loading child while keeping the parent on global clauses', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 48 }),
      cpClause('loading-laytime', 'laytime_rate', {
        hours: 24,
        operation: 'Loading',
      }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('loading-demurrage', 'demurrage_rate', {
        rate: 20_000,
        operation: 'Loading',
      }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
      cpClause('loading-despatch', 'despatch', {
        rate: 7_500,
        operation: 'Loading',
        timeBasis: 'working_time_saved',
      }),
      cpClause('global-shex', 'shex_shinc', { shex: false }),
      cpClause('loading-shex', 'shex_shinc', {
        shex: true,
        calendarVersion: 1,
        timeZone: 'Australia/Sydney',
        holidayDates: ['2026-12-25'],
        saturdayExcepted: false,
        operation: 'Loading',
      }),
      cpClause('discharge-laytime', 'laytime_rate', {
        hours: 12,
        operation: 'Discharge',
      }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      {
        laytimeOperation: 'Loading',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation, childCalculation] =
      getCreatedCalculations(manager);

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '2 days 00:00:00',
        demurrageAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          allowedLaytime: expect.objectContaining({
            clauseId: 'global-laytime',
          }),
          demurrage: expect.objectContaining({
            clauseId: 'global-demurrage',
          }),
          despatch: expect.objectContaining({
            clauseId: 'global-despatch',
            timeBasis: {
              requestedTimeBasis: null,
              effectiveTimeBasis: 'all_time_saved',
              source: 'legacy-default',
              workingTimeSavedSeconds: 64_800,
              selectedSavedSeconds: 64_800,
              theoreticalExpiry: new Date('2026-03-06T06:00:00Z'),
              projectedExceptedIntervals: [],
            },
          }),
        }),
      }),
    );
    expect(childCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '1 days 00:00:00',
        demurrageAmount: '5000.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          allowedLaytime: expect.objectContaining({
            clauseId: 'loading-laytime',
          }),
          demurrage: expect.objectContaining({
            clauseId: 'loading-demurrage',
          }),
          despatch: expect.objectContaining({
            clauseId: 'loading-despatch',
            timeBasis: {
              requestedTimeBasis: 'working_time_saved',
              effectiveTimeBasis: 'working_time_saved',
              source: 'explicit',
              workingTimeSavedSeconds: 0,
              selectedSavedSeconds: 0,
              theoreticalExpiry: null,
              projectedExceptedIntervals: [],
            },
          }),
          shexCalendar: expect.objectContaining({
            clauseId: 'loading-shex',
            calendarVersion: 1,
            operation: 'Loading',
            timeZone: 'Australia/Sydney',
            holidayDates: ['2026-12-25'],
          }),
          operationResult: expect.objectContaining({
            operation: 'Loading',
            source: 'operation-specific-child-calculation',
            clauseSelection: expect.objectContaining({
              selectedClauseIds: expect.arrayContaining([
                'loading-laytime',
                'loading-demurrage',
                'loading-despatch',
                'loading-shex',
              ]),
              selectedClauses: expect.arrayContaining([
                expect.objectContaining({
                  id: 'loading-laytime',
                  clauseType: 'laytime_rate',
                  source: 'operation-specific',
                }),
                expect.objectContaining({
                  id: 'loading-demurrage',
                  clauseType: 'demurrage_rate',
                  source: 'operation-specific',
                }),
                expect.objectContaining({
                  id: 'loading-despatch',
                  clauseType: 'despatch',
                  source: 'operation-specific',
                }),
                expect.objectContaining({
                  id: 'loading-shex',
                  clauseType: 'shex_shinc',
                  source: 'operation-specific',
                }),
              ]),
            }),
          }),
        }),
      }),
    );
    expect(
      (childCalculation.inputSnapshot as Record<string, any>).operationResult
        .clauseSelection.selectedClauseIds,
    ).not.toContain('discharge-laytime');
  });

  it('uses discharge-specific laytime clauses for the discharge child', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 48 }),
      cpClause('discharge-laytime', 'laytime_rate', {
        hours: 24,
        operation: 'Discharge',
      }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
      cpClause('global-shex', 'shex_shinc', {
        shex: true,
        calendarVersion: 1,
        timeZone: 'UTC',
        holidayDates: [],
        saturdayExcepted: false,
      }),
      cpClause('discharge-shex', 'shex_shinc', {
        shex: true,
        calendarVersion: 1,
        timeZone: 'America/New_York',
        holidayDates: ['2026-07-04'],
        saturdayExcepted: true,
        operation: 'Discharge',
      }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      {
        laytimeOperation: 'Discharge',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation, childCalculation] =
      getCreatedCalculations(manager);

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '2 days 00:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '3750.00',
        decisionSnapshot: expect.objectContaining({
          allowedLaytime: expect.objectContaining({
            clauseId: 'global-laytime',
          }),
          demurrage: expect.objectContaining({
            clauseId: 'global-demurrage',
          }),
          despatch: expect.objectContaining({
            clauseId: 'global-despatch',
          }),
        }),
      }),
    );
    expect(childCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '1 days 00:00:00',
        demurrageAmount: '2500.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          allowedLaytime: expect.objectContaining({
            clauseId: 'discharge-laytime',
          }),
          demurrage: expect.objectContaining({
            clauseId: 'global-demurrage',
          }),
          despatch: expect.objectContaining({
            clauseId: 'global-despatch',
          }),
          shexCalendar: expect.objectContaining({
            clauseId: 'discharge-shex',
            operation: 'Discharge',
            timeZone: 'America/New_York',
            holidayDates: ['2026-07-04'],
            saturdayExcepted: true,
          }),
        }),
      }),
    );
  });

  it('falls back to the global laytime clause when no operation-specific laytime exists', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 48 }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
      cpClause('global-shex', 'shex_shinc', {
        shex: true,
        calendarVersion: 1,
        timeZone: 'Europe/London',
        holidayDates: [],
        saturdayExcepted: false,
      }),
      cpClause('loading-demurrage', 'demurrage_rate', {
        rate: 20_000,
        operation: 'Loading',
      }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      {
        laytimeOperation: 'Discharge',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation, childCalculation] =
      getCreatedCalculations(manager);

    expect(parentCalculation.allowedLaytime).toBe('2 days 00:00:00');
    expect(childCalculation.allowedLaytime).toBe('2 days 00:00:00');
    expect(
      (childCalculation.inputSnapshot as Record<string, any>).operationResult
        .clauseSelection.selectedClauses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'global-laytime',
          clauseType: 'laytime_rate',
          source: 'global-fallback',
        }),
        expect.objectContaining({
          id: 'global-shex',
          clauseType: 'shex_shinc',
          source: 'global-fallback',
        }),
      ]),
    );
  });

  it('uses operation-specific demurrage rates for the loading child', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 24 }),
      cpClause('loading-laytime', 'laytime_rate', {
        hours: 24,
        operation: 'Loading',
      }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('loading-demurrage', 'demurrage_rate', {
        rate: 20_000,
        operation: 'Loading',
      }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      {
        laytimeOperation: 'Loading',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation, childCalculation] =
      getCreatedCalculations(manager);

    expect(parentCalculation.demurrageAmount).toBe('2500.00');
    expect(childCalculation.demurrageAmount).toBe('5000.00');
    expect(
      (childCalculation.decisionSnapshot as Record<string, any>).operationResult
        .clauseSelection.selectedClauses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'loading-demurrage',
          clauseType: 'demurrage_rate',
          source: 'operation-specific',
        }),
      ]),
    );
  });

  it('uses operation-specific despatch rates for the discharge child', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 24 }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
      cpClause('discharge-despatch', 'despatch', {
        rate: 10_000,
        operation: 'Discharge',
        timeBasis: 'working_time_saved',
      }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      {
        laytimeOperation: 'Discharge',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-04T18:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation, childCalculation] =
      getCreatedCalculations(manager);

    expect(parentCalculation.despatchAmount).toBe('2500.00');
    expect(childCalculation.despatchAmount).toBe('5000.00');
    expect(
      (childCalculation.decisionSnapshot as Record<string, any>).despatch
        .timeBasis,
    ).toEqual(
      expect.objectContaining({
        effectiveTimeBasis: 'working_time_saved',
        selectedSavedSeconds: 43_200,
      }),
    );
    expect(
      (childCalculation.decisionSnapshot as Record<string, any>).operationResult
        .clauseSelection.selectedClauses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'discharge-despatch',
          clauseType: 'despatch',
          source: 'operation-specific',
        }),
      ]),
    );
  });

  it('applies operation-specific weather working terms to the child calculation only', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 24 }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
      cpClause('global-weather', 'weather_working', { enabled: false }),
      cpClause('loading-weather', 'weather_working', {
        enabled: true,
        operation: 'Loading',
      }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      {
        laytimeOperation: 'Loading',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'rain-start',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-04T12:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'rain-end',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'RAIN_STOPPED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: null,
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation, childCalculation] =
      getCreatedCalculations(manager);

    expect(parentCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        weatherWorking: expect.objectContaining({
          clauseId: 'global-weather',
          enabled: false,
          applied: false,
        }),
      }),
    );
    expect(childCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        weatherWorking: expect.objectContaining({
          clauseId: 'loading-weather',
          enabled: true,
          applied: true,
          totalWeatherTimeDeductedBeforeDemurrage: 43200,
        }),
        operationResult: expect.objectContaining({
          clauseSelection: expect.objectContaining({
            selectedClauses: expect.arrayContaining([
              expect.objectContaining({
                id: 'loading-weather',
                clauseType: 'weather_working',
                source: 'operation-specific',
              }),
            ]),
          }),
        }),
      }),
    );
    expect(childCalculation.usedLaytime).not.toBe(
      parentCalculation.usedLaytime,
    );
  });

  it('records duplicate same-operation warnings in the child snapshot', async () => {
    const clauses = [
      cpClause('global-laytime', 'laytime_rate', { hours: 48 }),
      cpClause('loading-laytime-1', 'laytime_rate', {
        hours: 24,
        operation: 'Loading',
      }),
      cpClause('loading-laytime-2', 'laytime_rate', {
        hours: 30,
        operation: 'Loading',
      }),
      cpClause('global-demurrage', 'demurrage_rate', { rate: 10_000 }),
      cpClause('global-despatch', 'despatch', { rate: 5_000 }),
    ];
    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      { laytimeOperation: 'Loading' },
    );

    await service.calculate(VOYAGE_ID);

    const [, childCalculation] = getCreatedCalculations(manager);

    expect(childCalculation.warnings).toContain(
      'Multiple "laytime_rate" clauses found for operation "Loading"; the first one was used.',
    );
    expect(
      (childCalculation.inputSnapshot as Record<string, any>).operationResult
        .clauseSelection.duplicateWarnings,
    ).toEqual(
      expect.arrayContaining([
        'Multiple "laytime_rate" clauses found for operation "Loading"; the first one was used.',
        'Legacy unscoped SOF evidence was used because no operation-matching child completion event existed for the voyage laytime operation.',
      ]),
    );
  });

  it.each([
    {
      voyageOperation: 'Loading' as const,
      childOperation: 'Loading' as const,
    },
    {
      voyageOperation: 'Discharge' as const,
      childOperation: 'Discharge' as const,
    },
  ])(
    'creates one %s child and no opposite child',
    async ({ voyageOperation, childOperation }) => {
      const { service, manager } = buildServiceWithCharterParty(0, undefined, {
        laytimeOperation: voyageOperation,
      });

      const result = await service.calculate(VOYAGE_ID);

      const createdCalculations = getCreatedCalculations(manager);
      const parentCalculation = createdCalculations[0];
      const childCalculation = createdCalculations[1];

      expect(result.calculation).toEqual(
        expect.objectContaining({
          parentCalculationId: null,
          operation: null,
        }),
      );
      expect(createdCalculations).toHaveLength(2);
      expect(parentCalculation).toEqual(
        expect.objectContaining({
          parentCalculationId: null,
          operation: null,
        }),
      );
      expect(childCalculation).toEqual(
        expect.objectContaining({
          parentCalculationId: 'new-calculation',
          operation: childOperation,
        }),
      );
      expect(
        createdCalculations.some(
          (calculation) =>
            calculation.operation !== null &&
            calculation.operation !== childOperation,
        ),
      ).toBe(false);
      expect(manager.save).toHaveBeenCalledTimes(4);
      expect(manager.save).toHaveBeenNthCalledWith(
        4,
        expect.arrayContaining([
          expect.objectContaining({
            calculationId: 'new-calculation',
          }),
        ]),
      );
    },
  );

  it('rolls back the calculation if child persistence fails', async () => {
    const { service, manager } = buildServiceWithCharterParty(0, undefined, {
      laytimeOperation: 'Discharge',
    });

    manager.save
      .mockImplementationOnce(async (value) =>
        Array.isArray(value) ? value : { ...value, id: 'new-calculation' },
      )
      .mockImplementationOnce(async (value) => value)
      .mockImplementationOnce(async () => {
        throw new Error('child persistence failed');
      });

    await expect(service.calculate(VOYAGE_ID)).rejects.toThrow(
      'child persistence failed',
    );
    expect(manager.findOneOrFail).not.toHaveBeenCalled();
  });

  it('runs a separate child engine pass and prefers explicit matching completion evidence over later global completion evidence', async () => {
    const { service, manager } = buildServiceWithCharterParty(0, undefined, {
      laytimeOperation: 'Discharge',
      sofDocuments: [
        {
          id: 'matching-doc',
          status: 'Final',
          uploadDate: new Date('2026-03-03T00:00:00Z'),
          operation: 'Discharge',
        },
      ],
      sofEvents: [
        {
          id: 'nor',
          sofId: 'matching-doc',
          eventTime: new Date('2026-03-04T00:00:00Z'),
          eventType: 'NOR_TENDERED',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'rain-start',
          sofId: 'matching-doc',
          eventTime: new Date('2026-03-04T06:00:00Z'),
          eventType: 'RAIN_STOPPAGE',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'rain-end',
          sofId: 'matching-doc',
          eventTime: new Date('2026-03-04T12:00:00Z'),
          eventType: 'RAIN_STOPPED',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'matching-completion',
          sofId: 'matching-doc',
          eventTime: new Date('2026-03-05T00:00:00Z'),
          eventType: 'DISCHARGE_COMPLETED',
          operation: 'Discharge',
          isManualOverride: false,
        },
        {
          id: 'global-completion',
          sofId: 'matching-doc',
          eventTime: new Date('2026-03-05T12:00:00Z'),
          eventType: 'CARGO_COMPLETED',
          operation: null,
          isManualOverride: false,
        },
      ],
    });

    await service.calculate(VOYAGE_ID);

    const createdCalculations = getCreatedCalculations(manager);
    const parentCalculation = createdCalculations[0];
    const childCalculation = createdCalculations[1];

    expect(parentCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        cargoCompletion: expect.objectContaining({
          eventType: 'CARGO_COMPLETED',
          eventTime: '2026-03-05T12:00:00.000Z',
        }),
      }),
    );
    expect(childCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        cargoCompletion: expect.objectContaining({
          eventType: 'DISCHARGE_COMPLETED',
          eventTime: '2026-03-05T00:00:00.000Z',
        }),
        operationResult: expect.objectContaining({
          operation: 'Discharge',
          source: 'operation-specific-child-calculation',
        }),
      }),
    );
    expect(childCalculation.usedLaytime).not.toBe(
      parentCalculation.usedLaytime,
    );
    expect(
      (childCalculation.inputSnapshot as Record<string, any>).operationResult,
    ).toEqual(
      expect.objectContaining({
        operation: 'Discharge',
        source: 'operation-specific-child-calculation',
        documentSelection: expect.objectContaining({
          includedDocumentIds: ['matching-doc'],
          excludedDocumentIds: [],
          usedLegacyFallback: false,
        }),
        eventSelection: expect.objectContaining({
          candidateEventIds: expect.arrayContaining([
            'nor',
            'rain-start',
            'rain-end',
            'matching-completion',
            'global-completion',
          ]),
          includedEventIds: expect.arrayContaining([
            'nor',
            'rain-start',
            'rain-end',
            'matching-completion',
          ]),
          excludedEventIds: ['global-completion'],
          matchingCompletionEventId: 'matching-completion',
          selectedCompletionEventId: 'matching-completion',
          usedLegacyFallback: false,
        }),
      }),
    );
    expect(
      (parentCalculation.inputSnapshot as Record<string, any>).operationResult,
    ).toBeUndefined();
  });

  it('isolates tanker completion evidence per operation for reversible V1 without counting the sailing gap', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        laytimeOperationScope: 'LoadingAndDischarge',
        settlementCurrency: 'USD',
        clauses: [
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
            rate: 20000,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
            rate: 20000,
          }),
          cpClause('reversible-laytime', 'reversible_laytime', {
            enabled: true,
            settlementVersion: 1,
            allowanceMode: 'sum_operation_allowances',
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        bulkOperationType: 'tanker',
        norDocuments: [],
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-09-28T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-10-02T00:00:00Z'),
            operation: 'Discharge',
          },
          {
            id: 'shared-completion-doc',
            status: 'Final',
            uploadDate: new Date('2026-09-30T14:30:00Z'),
            operation: null,
          },
        ],
        sofEvents: [
          {
            id: 'loading-nor',
            sofId: 'loading-doc',
            eventTime: new Date('2026-09-28T08:30:00Z'),
            eventType: 'NOR_TENDERED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-nor',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-10-02T08:30:00Z'),
            eventType: 'NOR_TENDERED',
            operation: 'Discharge',
            isManualOverride: false,
          },
          {
            id: 'loading-completed',
            sofId: 'shared-completion-doc',
            eventTime: new Date('2026-09-30T14:30:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'loading-hoses-disconnected',
            sofId: 'shared-completion-doc',
            eventTime: new Date('2026-09-30T14:30:00Z'),
            eventType: 'HOSES_DISCONNECTED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completed',
            sofId: 'shared-completion-doc',
            eventTime: new Date('2026-10-06T14:30:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
          {
            id: 'discharge-hoses-disconnected',
            sofId: 'shared-completion-doc',
            eventTime: new Date('2026-10-06T14:30:00Z'),
            eventType: 'HOSES_DISCONNECTED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parent, loading, discharge] = getCreatedCalculations(manager);
    const loadingSnapshot = loading.decisionSnapshot as Record<string, any>;
    const dischargeSnapshot = discharge.decisionSnapshot as Record<string, any>;
    const settlement = (parent.decisionSnapshot as Record<string, any>)
      .reversibleSettlement;

    expect(loading.operation).toBe('Loading');
    expect(loadingSnapshot.commencement).toEqual(
      expect.objectContaining({
        norTenderedEventId: 'loading-nor',
        commencedAt: '2026-09-28T14:30:00.000Z',
      }),
    );
    expect(loadingSnapshot.cargoCompletion).toEqual(
      expect.objectContaining({
        selectedEventId: 'loading-hoses-disconnected',
        selectedEventType: 'HOSES_DISCONNECTED',
        eventTime: '2026-09-30T14:30:00.000Z',
      }),
    );
    expect(loading.allowedLaytime).toBe('3 days 00:00:00');
    expect(loading.usedLaytime).toBe('2 days 00:00:00');

    expect(discharge.operation).toBe('Discharge');
    expect(dischargeSnapshot.commencement).toEqual(
      expect.objectContaining({
        norTenderedEventId: 'discharge-nor',
        commencedAt: '2026-10-02T14:30:00.000Z',
      }),
    );
    expect(dischargeSnapshot.cargoCompletion).toEqual(
      expect.objectContaining({
        selectedEventId: 'discharge-hoses-disconnected',
        selectedEventType: 'HOSES_DISCONNECTED',
        eventTime: '2026-10-06T14:30:00.000Z',
      }),
    );
    expect(discharge.allowedLaytime).toBe('3 days 00:00:00');
    expect(discharge.usedLaytime).toBe('4 days 00:00:00');

    expect(settlement).toEqual(
      expect.objectContaining({
        combinedAllowedSeconds: 144 * 3600,
        combinedUsedSeconds: 144 * 3600,
        combinedOverrunSeconds: 0,
        combinedSavedSeconds: 0,
        currency: 'USD',
        demurrageAmount: 0,
        despatchAmount: 0,
      }),
    );
    expect(
      settlement.timeline.reduce(
        (total: number, segment: { countedSeconds: number }) =>
          total + segment.countedSeconds,
        0,
      ),
    ).toBe(144 * 3600);
  });

  it('falls back to legacy null child documents and events when no explicit operation-specific evidence exists', async () => {
    const { service, manager } = buildServiceWithCharterParty(0, undefined, {
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
          id: 'nor',
          sofId: 'legacy-doc',
          eventTime: new Date('2026-03-04T00:00:00Z'),
          eventType: 'NOR_TENDERED',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'legacy-completion',
          sofId: 'legacy-doc',
          eventTime: new Date('2026-03-05T00:00:00Z'),
          eventType: 'LOADING_COMPLETED',
          operation: null,
          isManualOverride: false,
        },
      ],
    });

    await service.calculate(VOYAGE_ID);

    const createdCalculations = getCreatedCalculations(manager);
    const childCalculation = createdCalculations[1];

    expect(
      (childCalculation.inputSnapshot as Record<string, any>).operationResult,
    ).toEqual(
      expect.objectContaining({
        operation: 'Loading',
        source: 'operation-specific-child-calculation',
        documentSelection: expect.objectContaining({
          includedDocumentIds: ['legacy-doc'],
          usedLegacyFallback: true,
        }),
        eventSelection: expect.objectContaining({
          includedEventIds: expect.arrayContaining([
            'nor',
            'legacy-completion',
          ]),
          matchingCompletionEventId: null,
          selectedCompletionEventId: 'legacy-completion',
          usedLegacyFallback: true,
        }),
      }),
    );
    expect(childCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        cargoCompletion: expect.objectContaining({
          eventType: 'LOADING_COMPLETED',
          eventTime: '2026-03-05T00:00:00.000Z',
        }),
      }),
    );
    expect(createdCalculations).toHaveLength(2);
  });

  it('creates both Loading and Discharge child calculations when both operations have explicit evidence', async () => {
    const { service, manager, calculations } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          cpClause('global-laytime', 'laytime_rate', {
            hours: 48,
            noticeHours: 6,
          }),
          cpClause('global-demurrage', 'demurrage_rate', { rate: 12000 }),
          cpClause('global-shex', 'shex_shinc', { shex: true }),
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
            rate: 10000,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 24,
            noticeHours: 6,
          }),
          opClause('discharge-despatch', 'despatch', 'Discharge', {
            rate: 5000,
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        norDocuments: [],
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
          {
            id: 'legacy-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T02:00:00Z'),
            operation: null,
          },
        ],
        sofEvents: [
          {
            id: 'legacy-nor',
            sofId: 'legacy-doc',
            eventTime: new Date('2026-03-03T00:00:00Z'),
            eventType: 'NOR_TENDERED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'legacy-rain-start',
            sofId: 'legacy-doc',
            eventTime: new Date('2026-03-03T12:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'legacy-rain-end',
            sofId: 'legacy-doc',
            eventTime: new Date('2026-03-03T18:00:00Z'),
            eventType: 'RAIN_STOPPED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'loading-work-stop',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-04T08:00:00Z'),
            eventType: 'WORK_STOPPED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'loading-work-resume',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-04T12:00:00Z'),
            eventType: 'WORK_RESUMED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-06T00:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-breakdown',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-04T22:00:00Z'),
            eventType: 'BREAKDOWN',
            operation: 'Discharge',
            isManualOverride: false,
          },
          {
            id: 'discharge-repair',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-05T02:00:00Z'),
            eventType: 'BREAKDOWN_REPAIRED',
            operation: 'Discharge',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-04T00:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    const versionQueue = [{ maximum: 0 }, { maximum: 1 }];
    manager.createQueryBuilder.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue(versionQueue.shift() ?? { maximum: 1 }),
    }));

    const savedParents: LaytimeCalculation[] = [];
    const savedChildren: LaytimeCalculation[] = [];
    const savedPeriods: Array<{ calculationId: string }> = [];
    let parentPersistCount = 0;
    let loadingPersistCount = 0;
    let dischargePersistCount = 0;
    let latestParent: LaytimeCalculation | null = null;

    manager.save.mockImplementation(async (value) => {
      if (Array.isArray(value)) {
        savedPeriods.push(...(value as Array<{ calculationId: string }>));
        return value;
      }

      if (
        value.parentCalculationId === null ||
        value.parentCalculationId === undefined
      ) {
        parentPersistCount += 1;
        const saved = {
          ...value,
          id: `parent-calculation-${parentPersistCount}`,
        } as LaytimeCalculation;
        latestParent = {
          ...saved,
          periods: [],
        };
        savedParents.push(saved);
        return saved;
      }

      if (value.operation === 'Loading') {
        loadingPersistCount += 1;
        const saved = {
          ...value,
          id: `loading-child-${loadingPersistCount}`,
        } as LaytimeCalculation;
        savedChildren.push(saved);
        return saved;
      }

      if (value.operation === 'Discharge') {
        dischargePersistCount += 1;
        const saved = {
          ...value,
          id: `discharge-child-${dischargePersistCount}`,
        } as LaytimeCalculation;
        savedChildren.push(saved);
        return saved;
      }

      return {
        ...value,
        id: 'saved-unknown',
      };
    });

    manager.findOneOrFail.mockImplementation(async () => {
      if (!latestParent) {
        throw new Error('parent calculation was not saved');
      }

      return {
        ...latestParent,
        periods: latestParent.periods ?? [],
      };
    });

    const firstResult = await service.calculate(VOYAGE_ID);
    const secondResult = await service.calculate(VOYAGE_ID);

    expect(firstResult.calculation.version).toBe(1);
    expect(secondResult.calculation.version).toBe(2);

    expect(savedParents).toHaveLength(2);
    expect(savedChildren).toHaveLength(4);
    expect(savedPeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ calculationId: 'parent-calculation-1' }),
        expect.objectContaining({ calculationId: 'loading-child-1' }),
        expect.objectContaining({ calculationId: 'discharge-child-1' }),
        expect.objectContaining({ calculationId: 'parent-calculation-2' }),
        expect.objectContaining({ calculationId: 'loading-child-2' }),
        expect.objectContaining({ calculationId: 'discharge-child-2' }),
      ]),
    );

    const firstParent = savedParents.find(
      (calculation) => calculation.version === 1,
    ) as LaytimeCalculation;
    const secondParent = savedParents.find(
      (calculation) => calculation.version === 2,
    ) as LaytimeCalculation;
    const firstLoading = savedChildren.find(
      (calculation) =>
        calculation.parentCalculationId === 'parent-calculation-1' &&
        calculation.operation === 'Loading',
    ) as LaytimeCalculation;
    const firstDischarge = savedChildren.find(
      (calculation) =>
        calculation.parentCalculationId === 'parent-calculation-1' &&
        calculation.operation === 'Discharge',
    ) as LaytimeCalculation;
    const secondLoading = savedChildren.find(
      (calculation) =>
        calculation.parentCalculationId === 'parent-calculation-2' &&
        calculation.operation === 'Loading',
    ) as LaytimeCalculation;
    const secondDischarge = savedChildren.find(
      (calculation) =>
        calculation.parentCalculationId === 'parent-calculation-2' &&
        calculation.operation === 'Discharge',
    ) as LaytimeCalculation;

    expect(firstParent).toEqual(
      expect.objectContaining({
        parentCalculationId: null,
        operation: null,
        version: 1,
      }),
    );
    expect(secondParent).toEqual(
      expect.objectContaining({
        parentCalculationId: null,
        operation: null,
        version: 2,
      }),
    );
    expect(
      (firstParent.inputSnapshot as Record<string, any>).operationChildren,
    ).toEqual(
      expect.objectContaining({
        requestedOperations: ['Loading', 'Discharge'],
        createdOperations: ['Loading', 'Discharge'],
        skippedOperations: [],
      }),
    );
    expect(
      (firstParent.decisionSnapshot as Record<string, any>)
        .reversibleLaytimeAnalysis,
    ).toEqual(
      expect.objectContaining({
        status: 'available',
        mode: 'audit-only',
        contractRuleApplied: false,
      }),
    );
    expect(
      (secondParent.inputSnapshot as Record<string, any>).operationChildren,
    ).toEqual(
      expect.objectContaining({
        requestedOperations: ['Loading', 'Discharge'],
        createdOperations: ['Loading', 'Discharge'],
        skippedOperations: [],
      }),
    );
    expect(
      (secondParent.decisionSnapshot as Record<string, any>)
        .reversibleLaytimeAnalysis,
    ).toEqual(
      expect.objectContaining({
        status: 'available',
        mode: 'audit-only',
        contractRuleApplied: false,
      }),
    );

    expect(firstLoading).toEqual(
      expect.objectContaining({
        parentCalculationId: 'parent-calculation-1',
        operation: 'Loading',
        version: 1,
      }),
    );
    expect(firstDischarge).toEqual(
      expect.objectContaining({
        parentCalculationId: 'parent-calculation-1',
        operation: 'Discharge',
        version: 1,
      }),
    );
    expect(secondLoading).toEqual(
      expect.objectContaining({
        parentCalculationId: 'parent-calculation-2',
        operation: 'Loading',
        version: 2,
      }),
    );
    expect(secondDischarge).toEqual(
      expect.objectContaining({
        parentCalculationId: 'parent-calculation-2',
        operation: 'Discharge',
        version: 2,
      }),
    );
    expect(
      (firstLoading.inputSnapshot as Record<string, any>).operationResult,
    ).toEqual(
      expect.objectContaining({
        operation: 'Loading',
        source: 'operation-specific-child-calculation',
        documentSelection: expect.objectContaining({
          matchingDocumentIds: ['loading-doc'],
          legacyNullDocumentIds: ['legacy-doc'],
          usedLegacyFallback: false,
        }),
        eventSelection: expect.objectContaining({
          matchingCompletionEventId: 'loading-completion',
          selectedCompletionEventId: 'loading-completion',
          legacyNullEventIds: expect.arrayContaining([
            'legacy-nor',
            'legacy-rain-start',
            'legacy-rain-end',
          ]),
          usedLegacyFallback: false,
        }),
      }),
    );
    expect(
      (firstDischarge.inputSnapshot as Record<string, any>).operationResult,
    ).toEqual(
      expect.objectContaining({
        operation: 'Discharge',
        source: 'operation-specific-child-calculation',
        documentSelection: expect.objectContaining({
          matchingDocumentIds: ['discharge-doc'],
          legacyNullDocumentIds: ['legacy-doc'],
          usedLegacyFallback: false,
        }),
        eventSelection: expect.objectContaining({
          matchingCompletionEventId: 'discharge-completion',
          selectedCompletionEventId: 'discharge-completion',
          legacyNullEventIds: expect.arrayContaining([
            'legacy-nor',
            'legacy-rain-start',
            'legacy-rain-end',
          ]),
          usedLegacyFallback: false,
        }),
      }),
    );
    expect(
      (firstLoading.decisionSnapshot as Record<string, any>).operationResult
        .clauseSelection.selectedClauses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'loading-laytime',
          clauseType: 'laytime_rate',
          source: 'operation-specific',
        }),
        expect.objectContaining({
          id: 'loading-demurrage',
          clauseType: 'demurrage_rate',
          source: 'operation-specific',
        }),
        expect.objectContaining({
          id: 'global-shex',
          clauseType: 'shex_shinc',
          source: 'global-fallback',
        }),
      ]),
    );
    expect(
      (firstDischarge.decisionSnapshot as Record<string, any>).operationResult
        .clauseSelection.selectedClauses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'discharge-laytime',
          clauseType: 'laytime_rate',
          source: 'operation-specific',
        }),
        expect.objectContaining({
          id: 'discharge-despatch',
          clauseType: 'despatch',
          source: 'operation-specific',
        }),
        expect.objectContaining({
          id: 'global-shex',
          clauseType: 'shex_shinc',
          source: 'global-fallback',
        }),
      ]),
    );
    expect(firstLoading.allowedLaytime).not.toBe(firstDischarge.allowedLaytime);
    expect(secondLoading.allowedLaytime).not.toBe(
      secondDischarge.allowedLaytime,
    );

    calculations.findOne.mockImplementation(async ({ where }) => {
      if (where.id === savedParents[0].id) {
        return savedParents[0];
      }
      if (where.id === savedParents[1].id) {
        return savedParents[1];
      }
      return null;
    });
    calculations.find.mockImplementation(async ({ where }) => {
      if (where.parentCalculationId === savedParents[0].id) {
        return [firstDischarge, firstLoading];
      }
      if (where.parentCalculationId === savedParents[1].id) {
        return [secondDischarge, secondLoading];
      }
      return [];
    });
    calculations.findAndCount.mockResolvedValue([
      [savedParents[1], savedParents[0]],
      2,
    ]);

    await expect(
      service.findOperationChildren(savedParents[0].id),
    ).resolves.toEqual([
      expect.objectContaining({ operation: 'Loading' }),
      expect.objectContaining({ operation: 'Discharge' }),
    ]);

    await expect(
      service.findForVoyage(VOYAGE_ID, {
        skip: 0,
        limit: 10,
        page: 1,
      } as never),
    ).resolves.toEqual(
      expect.objectContaining({
        data: [savedParents[1], savedParents[0]],
      }),
    );
    expect(
      (firstParent.inputSnapshot as Record<string, any>).operationResult,
    ).toBeUndefined();
    expect(
      (secondParent.inputSnapshot as Record<string, any>).operationResult,
    ).toBeUndefined();
  });

  it('orchestrates both reversible children when legacy SOF documents contain explicit operation events', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        laytimeOperationScope: 'LoadingAndDischarge',
        settlementCurrency: 'USD',
        clauses: [
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
            rate: 20000,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
            rate: 20000,
          }),
          cpClause('reversible-laytime', 'reversible_laytime', {
            enabled: true,
            settlementVersion: 1,
            allowanceMode: 'sum_operation_allowances',
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        norDocuments: [],
        sofDocuments: [
          {
            id: 'legacy-sof',
            status: 'Draft',
            uploadDate: new Date('2026-10-01T00:00:00Z'),
            operation: null,
          },
        ],
        sofEvents: [
          {
            id: 'loading-nor',
            sofId: 'legacy-sof',
            eventTime: new Date('2026-10-10T00:30:00Z'),
            eventType: 'NOR_TENDERED',
            operation: 'Loading',
            isManualOverride: true,
          },
          {
            id: 'loading-completion',
            sofId: 'legacy-sof',
            eventTime: new Date('2026-10-12T06:30:00Z'),
            eventType: 'HOSES_DISCONNECTED',
            operation: 'Loading',
            isManualOverride: true,
          },
          {
            id: 'discharge-nor',
            sofId: 'legacy-sof',
            eventTime: new Date('2026-10-14T00:30:00Z'),
            eventType: 'NOR_TENDERED',
            operation: 'Discharge',
            isManualOverride: true,
          },
          {
            id: 'discharge-completion',
            sofId: 'legacy-sof',
            eventTime: new Date('2026-10-18T06:30:00Z'),
            eventType: 'HOSES_DISCONNECTED',
            operation: 'Discharge',
            isManualOverride: true,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const created = getCreatedCalculations(manager);
    const parent = created.find(
      (calculation) => calculation.operation === null,
    );
    const loading = created.find(
      (calculation) => calculation.operation === 'Loading',
    );
    const discharge = created.find(
      (calculation) => calculation.operation === 'Discharge',
    );

    expect(loading).toEqual(
      expect.objectContaining({
        operation: 'Loading',
        allowedLaytime: '3 days 00:00:00',
        usedLaytime: '2 days 00:00:00',
      }),
    );
    expect(discharge).toEqual(
      expect.objectContaining({
        operation: 'Discharge',
        allowedLaytime: '3 days 00:00:00',
        usedLaytime: '4 days 00:00:00',
      }),
    );
    expect(parent).toEqual(
      expect.objectContaining({
        allowedLaytime: '6 days 00:00:00',
        usedLaytime: '6 days 00:00:00',
        demurrageAmount: '0.00',
      }),
    );
    expect(
      (parent?.inputSnapshot as Record<string, any>).operationChildren,
    ).toEqual(
      expect.objectContaining({
        requestedOperations: ['Loading', 'Discharge'],
        createdOperations: ['Loading', 'Discharge'],
        skippedOperations: [],
      }),
    );
  });

  it('records a contract-aware reversible laytime analysis when the clause is enabled', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          cpClause('global-laytime', 'laytime_rate', {
            hours: 48,
            noticeHours: 6,
          }),
          cpClause('global-demurrage', 'demurrage_rate', { rate: 12000 }),
          cpClause('reversible-laytime', 'reversible_laytime', {
            enabled: true,
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-06T00:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);

    expect(parentCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        reversibleLaytimeRule: expect.objectContaining({
          clauseId: 'reversible-laytime',
          clauseType: 'reversible_laytime',
          enabled: true,
          clauseParameters: expect.objectContaining({
            enabled: true,
            settlementVersion: 1,
            allowanceMode: 'sum_operation_allowances',
          }),
        }),
        reversibleLaytimeAnalysis: expect.objectContaining({
          status: 'available',
          mode: 'contract-enabled',
          contractRuleApplied: true,
          pool: expect.objectContaining({
            totalAllowedSeconds: expect.any(Number),
            totalUsedSeconds: expect.any(Number),
          }),
        }),
        reversibleSettlement: expect.objectContaining({
          settlementStatus: 'NONAUTHORITATIVE',
          reasonCode: 'REVERSIBLE_EXPLICIT_OPERATION_ALLOWANCES_REQUIRED',
          combinedAllowedSeconds: null,
        }),
      }),
    );
  });

  it.each(['absent', 'disabled'] as const)(
    'keeps the parent result unchanged when reversible laytime is %s',
    async (state) => {
      const clauses = [
        opClause('loading-laytime', 'laytime_rate', 'Loading', {
          hours: 48,
          noticeHours: 6,
        }),
        opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
          rate: 12000,
        }),
        opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
          hours: 60,
          noticeHours: 6,
        }),
        opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
          rate: 12000,
        }),
      ];
      const options = {
        laytimeOperation: 'Discharge' as const,
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading' as const,
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge' as const,
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-06T18:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading' as const,
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge' as const,
            isManualOverride: false,
          },
        ],
      };
      const baseline = buildServiceWithCharterParty(0, { clauses }, options);
      await baseline.service.calculate(VOYAGE_ID);
      const baselineParent = getCreatedCalculations(baseline.manager)[0];

      const reversibleClause =
        state === 'disabled'
          ? cpClause('reversible-laytime', 'reversible_laytime', {
              enabled: false,
            })
          : null;
      const { service, manager } = buildServiceWithCharterParty(
        0,
        {
          clauses: reversibleClause ? [...clauses, reversibleClause] : clauses,
        },
        options,
      );

      await service.calculate(VOYAGE_ID);

      const parentCalculation = getCreatedCalculations(manager)[0];
      expect(parentCalculation).toEqual(
        expect.objectContaining({
          allowedLaytime: baselineParent.allowedLaytime,
          usedLaytime: baselineParent.usedLaytime,
          demurrageAmount: baselineParent.demurrageAmount,
          despatchAmount: baselineParent.despatchAmount,
          decisionSnapshot: expect.objectContaining({
            reversibleSettlement: null,
          }),
        }),
      );
    },
  );

  it('marks an enabled-only historical reversible clause as legacy without applying V1', async () => {
    const { service, manager } = buildServiceWithCharterParty(0, {
      clauses: [
        cpClause('laytime', 'laytime_rate', { hours: 48, noticeHours: 6 }),
        cpClause('demurrage', 'demurrage_rate', { rate: 12000 }),
        {
          id: 'legacy-reversible',
          clauseType: 'reversible_laytime',
          rawText: 'Historical reversible term',
          parameters: { enabled: true },
        },
      ],
    });

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);
    expect(parentCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        reversibleSettlement: expect.objectContaining({
          settlementStatus: 'LEGACY',
          reasonCode: 'LEGACY_REVERSIBLE_CONTRACT',
        }),
      }),
    );
  });

  it('marks a V1 calculation provisional when one operation is incomplete', async () => {
    const { service, manager } = buildServiceWithCharterParty(0, {
      clauses: [
        opClause('loading-laytime', 'laytime_rate', 'Loading', { hours: 72 }),
        opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
          hours: 48,
        }),
        cpClause('reversible', 'reversible_laytime', { enabled: true }),
      ],
    });

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);
    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '5 days 00:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          reversibleSettlement: expect.objectContaining({
            settlementStatus: 'PROVISIONAL',
            reasonCode: 'REVERSIBLE_OPERATION_INCOMPLETE',
            combinedAllowedSeconds: 120 * 3600,
          }),
        }),
      }),
    );
  });

  it('derives both operation allowances from the snapshotted Voyage cargo quantity', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          opClause('loading-rate', 'laytime_rate', 'Loading', { rate: 10000 }),
          opClause('discharge-rate', 'laytime_rate', 'Discharge', {
            rate: 5000,
          }),
          cpClause('reversible', 'reversible_laytime', { enabled: true }),
        ],
      },
      { cargoQuantity: '20000.00' },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);
    expect(parentCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        reversibleSettlement: expect.objectContaining({
          cargoQuantity: 20000,
          cargoQuantityBasis: 'voyage_cargo_quantity',
          combinedAllowedSeconds: 6 * 86400,
          loadingAllowance: expect.objectContaining({
            mechanism: 'rate',
            allowedSeconds: 2 * 86400,
          }),
          dischargeAllowance: expect.objectContaining({
            mechanism: 'rate',
            allowedSeconds: 4 * 86400,
          }),
        }),
      }),
    );
  });

  it('applies balanced reversible pooling authoritatively when the pooled result nets to zero', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 48,
            noticeHours: 6,
          }),
          opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
            rate: 12000,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 60,
            noticeHours: 6,
          }),
          opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
            rate: 12000,
          }),
          cpClause('reversible-laytime', 'reversible_laytime', {
            enabled: true,
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-06T18:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '4 days 12:00:00',
        usedLaytime: '4 days 12:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          reversibleSettlement: expect.objectContaining({
            version: 1,
            allowanceMode: 'sum_operation_allowances',
            cargoQuantityBasis: 'voyage_cargo_quantity',
            thresholdMode: 'combined_pool',
            cargoQuantity: 20000,
            settlementStatus: 'FINAL_AUTHORITATIVE',
            reasonCode: 'SETTLED',
            currency: 'USD',
            currencySource: 'charter_party_settlement_currency',
            currencyAuthorityStatus: 'AVAILABLE',
            loadingDemurrage: expect.objectContaining({
              rate: 12000,
              rateBasis: 'per_day',
              currency: 'USD',
            }),
            dischargeDemurrage: expect.objectContaining({
              rate: 12000,
              rateBasis: 'per_day',
              currency: 'USD',
            }),
            loadingChildCalculationId: expect.any(String),
            dischargeChildCalculationId: expect.any(String),
            loadingAllowance: expect.objectContaining({
              clauseId: 'loading-laytime',
              source: 'operation-specific',
            }),
            dischargeAllowance: expect.objectContaining({
              clauseId: 'discharge-laytime',
              source: 'operation-specific',
            }),
            combinedAllowedSeconds: 108 * 3600,
            combinedUsedSeconds: 108 * 3600,
            combinedOverrunSeconds: 0,
            combinedSavedSeconds: 0,
          }),
        }),
      }),
    );
    const settlement = (
      parentCalculation.decisionSnapshot as Record<string, any>
    ).reversibleSettlement;
    expect(manager.save.mock.calls[1][0]).toEqual([]);
    expect(
      settlement.timeline.reduce(
        (total: number, segment: { countedSeconds: number }) =>
          total + segment.countedSeconds,
        0,
      ),
    ).toBe(settlement.combinedUsedSeconds);
  });

  it.each([
    {
      sofStatus: 'Final' as const,
      expectedAuthority: 'FINAL_AUTHORITATIVE' as const,
      expectedReason: 'SETTLED' as const,
    },
    {
      sofStatus: 'Draft' as const,
      expectedAuthority: 'PROVISIONAL' as const,
      expectedReason: 'DRAFT_SOF_EVIDENCE' as const,
    },
  ])(
    'settles a reversible voyage with Loading allowed=72h used=48h and Discharge allowed=72h used=96h to net zero pooled demurrage/despatch from $sofStatus SOF evidence',
    async ({ sofStatus, expectedAuthority, expectedReason }) => {
      const { service, manager } = buildServiceWithCharterParty(
        0,
        {
          settlementCurrency: 'USD',
          laytimeOperationScope: 'LoadingAndDischarge',
          clauses: [
            opClause('loading-laytime', 'laytime_rate', 'Loading', {
              hours: 72,
              noticeHours: 0,
            }),
            opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
              rate: 15000,
            }),
            opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
              hours: 72,
              noticeHours: 0,
            }),
            opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
              rate: 15000,
            }),
            cpClause('reversible-laytime', 'reversible_laytime', {
              enabled: true,
            }),
          ],
        },
        {
          laytimeOperation: 'Discharge',
          norDocuments: [
            {
              id: 'nor-1',
              tenderTime: new Date('2026-03-01T00:00:00Z'),
              acceptedTime: new Date('2026-03-01T00:00:00Z'),
            },
          ],
          sofDocuments: [
            {
              id: 'loading-doc',
              status: sofStatus,
              uploadDate: new Date('2026-03-01T00:00:00Z'),
              operation: 'Loading',
            },
            {
              id: 'discharge-doc',
              status: sofStatus,
              uploadDate: new Date('2026-03-01T01:00:00Z'),
              operation: 'Discharge',
            },
          ],
          sofEvents: [
            {
              id: 'loading-completion',
              sofId: 'loading-doc',
              eventTime: new Date('2026-03-03T00:00:00Z'), // 48h used from 2026-03-01 00:00
              eventType: 'LOADING_COMPLETED',
              operation: 'Loading',
              isManualOverride: false,
            },
            {
              id: 'discharge-completion',
              sofId: 'discharge-doc',
              eventTime: new Date('2026-03-05T00:00:00Z'), // 96h used from 2026-03-01 00:00
              eventType: 'DISCHARGE_COMPLETED',
              operation: 'Discharge',
              isManualOverride: false,
            },
          ],
        },
      );

      await service.calculate(VOYAGE_ID);

      const [parentCalculation] = getCreatedCalculations(manager);

      expect(parentCalculation).toEqual(
        expect.objectContaining({
          allowedLaytime: '6 days 00:00:00',
          usedLaytime: '6 days 00:00:00',
          demurrageAmount: '0.00',
          despatchAmount: '0.00',
          currency: 'USD',
          decisionSnapshot: expect.objectContaining({
            reversibleLaytimeAnalysis: expect.objectContaining({
              contractRuleApplied: true,
            }),
            reversibleSettlement: expect.objectContaining({
              version: 1,
              allowanceMode: 'sum_operation_allowances',
              cargoQuantityBasis: 'voyage_cargo_quantity',
              thresholdMode: 'combined_pool',
              settlementStatus: expectedAuthority,
              reasonCode: expectedReason,
              currency: 'USD',
              currencyAuthorityStatus: 'AVAILABLE',
              combinedAllowedSeconds: 144 * 3600,
              combinedUsedSeconds: 144 * 3600,
              combinedOverrunSeconds: 0,
              combinedSavedSeconds: 0,
              demurrageAmount: 0,
              despatchAmount: 0,
            }),
          }),
        }),
      );
      const [, loadingChild, dischargeChild] = getCreatedCalculations(manager);
      expect(parentCalculation.settlementAuthorityStatus).toBe(
        expectedAuthority,
      );
      expect(loadingChild.settlementAuthorityStatus).toBe(expectedAuthority);
      expect(dischargeChild.settlementAuthorityStatus).toBe(expectedAuthority);
      if (sofStatus === 'Draft') {
        expect(parentCalculation.warnings).toContain(
          'No finalised Statement of Facts was available; the calculation used draft SOF events.',
        );
        expect(parentCalculation.decisionSnapshot).toEqual(
          expect.objectContaining({
            reversibleSettlement: expect.objectContaining({
              reason:
                'No finalised Statement of Facts was available; the calculation used draft SOF events.',
            }),
          }),
        );
      }
    },
  );

  it('applies pooled demurrage authoritatively when the child demurrage rates are compatible', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 48,
            noticeHours: 6,
          }),
          opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
            rate: 12000,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 48,
            noticeHours: 6,
          }),
          opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
            rate: 12000,
          }),
          cpClause('reversible-laytime', 'reversible_laytime', {
            enabled: true,
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-06T18:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-07T06:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '4 days 00:00:00',
        usedLaytime: '5 days 12:00:00',
        demurrageAmount: '18000.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          reversibleSettlement: expect.objectContaining({
            settlementStatus: 'FINAL_AUTHORITATIVE',
            reasonCode: 'SETTLED',
            demurrageRate: 12000,
            despatchRate: null,
            combinedAllowedSeconds: 96 * 3600,
            combinedUsedSeconds: 132 * 3600,
            combinedOverrunSeconds: 36 * 3600,
            combinedSavedSeconds: 0,
          }),
        }),
      }),
    );
  });

  it('pools timelines resolved under independent operation-specific SHEX calendars', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 120,
            noticeHours: 0,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 120,
            noticeHours: 0,
          }),
          opClause('loading-shex', 'shex_shinc', 'Loading', {
            shex: true,
            calendarVersion: 1,
            timeZone: 'Australia/Sydney',
            holidayDates: [],
            saturdayExcepted: false,
          }),
          opClause('discharge-shex', 'shex_shinc', 'Discharge', {
            shex: true,
            calendarVersion: 1,
            timeZone: 'America/New_York',
            holidayDates: [],
            saturdayExcepted: false,
          }),
          cpClause('reversible', 'reversible_laytime', { enabled: true }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-07-04T12:00:00Z'),
            acceptedTime: new Date('2026-07-04T12:00:00Z'),
          },
        ],
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-07-04T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-07-04T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-07-05T18:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-07-06T18:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const calculations = getCreatedCalculations(manager);
    const parent = calculations.find((calculation) => !calculation.operation)!;
    const loading = calculations.find(
      (calculation) => calculation.operation === 'Loading',
    )!;
    const discharge = calculations.find(
      (calculation) => calculation.operation === 'Discharge',
    )!;
    const settlement = (parent.decisionSnapshot as Record<string, any>)
      .reversibleSettlement;

    expect(
      (loading.decisionSnapshot as Record<string, any>).shexCalendar,
    ).toEqual(
      expect.objectContaining({
        clauseId: 'loading-shex',
        timeZone: 'Australia/Sydney',
      }),
    );
    expect(
      (discharge.decisionSnapshot as Record<string, any>).shexCalendar,
    ).toEqual(
      expect.objectContaining({
        clauseId: 'discharge-shex',
        timeZone: 'America/New_York',
      }),
    );
    expect(settlement).toEqual(
      expect.objectContaining({
        settlementStatus: 'FINAL_AUTHORITATIVE',
        combinedUsedSeconds:
          settlement.loadingCountableInputSeconds +
          settlement.dischargeCountableInputSeconds,
      }),
    );
  });

  it('applies pooled despatch authoritatively when the child despatch basis is compatible', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 60,
            noticeHours: 6,
          }),
          opClause('loading-despatch', 'despatch', 'Loading', {
            rate: 6000,
            timeBasis: 'working_time_saved',
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('discharge-despatch', 'despatch', 'Discharge', {
            rate: 6000,
            timeBasis: 'working_time_saved',
          }),
          cpClause('reversible-laytime', 'reversible_laytime', {
            enabled: true,
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parentCalculation] = getCreatedCalculations(manager);

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '5 days 12:00:00',
        usedLaytime: '3 days 00:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '15000.00',
        decisionSnapshot: expect.objectContaining({
          reversibleSettlement: expect.objectContaining({
            settlementStatus: 'FINAL_AUTHORITATIVE',
            reasonCode: 'SETTLED',
            demurrageRate: null,
            despatchRate: 6000,
            despatchTimeBasis: 'working_time_saved',
            combinedAllowedSeconds: 132 * 3600,
            combinedUsedSeconds: 72 * 3600,
            combinedOverrunSeconds: 0,
            combinedSavedSeconds: 60 * 3600,
          }),
        }),
      }),
    );
  });

  it('suppresses parent money when reversible demurrage pricing is incompatible', async () => {
    const clauses = [
      opClause('loading-laytime', 'laytime_rate', 'Loading', {
        hours: 48,
        noticeHours: 6,
      }),
      opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
        rate: 12000,
      }),
      opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
        hours: 48,
        noticeHours: 6,
      }),
      opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
        rate: 15000,
      }),
      cpClause('reversible-laytime', 'reversible_laytime', { enabled: true }),
    ];
    const options = {
      laytimeOperation: 'Discharge' as const,
      sofDocuments: [
        {
          id: 'loading-doc',
          status: 'Final',
          uploadDate: new Date('2026-03-03T00:00:00Z'),
          operation: 'Loading' as const,
        },
        {
          id: 'discharge-doc',
          status: 'Final',
          uploadDate: new Date('2026-03-03T01:00:00Z'),
          operation: 'Discharge' as const,
        },
      ],
      sofEvents: [
        {
          id: 'loading-completion',
          sofId: 'loading-doc',
          eventTime: new Date('2026-03-06T18:00:00Z'),
          eventType: 'LOADING_COMPLETED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
        {
          id: 'discharge-completion',
          sofId: 'discharge-doc',
          eventTime: new Date('2026-03-07T06:00:00Z'),
          eventType: 'DISCHARGE_COMPLETED',
          operation: 'Discharge' as const,
          isManualOverride: false,
        },
      ],
    };
    const baseline = buildServiceWithCharterParty(
      0,
      { clauses: clauses.slice(0, -1) },
      options,
    );
    await baseline.service.calculate(VOYAGE_ID);
    const baselineParent = getCreatedCalculations(baseline.manager)[0];

    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      options,
    );
    await service.calculate(VOYAGE_ID);
    const parentCalculation = getCreatedCalculations(manager)[0];

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '4 days 00:00:00',
        usedLaytime: '5 days 12:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          reversibleSettlement: expect.objectContaining({
            settlementStatus: 'NONAUTHORITATIVE',
            reasonCode: 'REVERSIBLE_DEMURRAGE_RATE_MISMATCH',
          }),
        }),
      }),
    );
  });

  it('suppresses parent money when reversible despatch timing is incompatible', async () => {
    const clauses = [
      opClause('loading-laytime', 'laytime_rate', 'Loading', {
        hours: 60,
        noticeHours: 6,
      }),
      opClause('loading-despatch', 'despatch', 'Loading', {
        rate: 6000,
        timeBasis: 'working_time_saved',
      }),
      opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
        hours: 72,
        noticeHours: 6,
      }),
      opClause('discharge-despatch', 'despatch', 'Discharge', {
        rate: 6000,
        timeBasis: 'all_time_saved',
      }),
      cpClause('reversible-laytime', 'reversible_laytime', { enabled: true }),
    ];
    const options = {
      laytimeOperation: 'Discharge' as const,
      sofDocuments: [
        {
          id: 'loading-doc',
          status: 'Final',
          uploadDate: new Date('2026-03-03T00:00:00Z'),
          operation: 'Loading' as const,
        },
        {
          id: 'discharge-doc',
          status: 'Final',
          uploadDate: new Date('2026-03-03T01:00:00Z'),
          operation: 'Discharge' as const,
        },
      ],
      sofEvents: [
        {
          id: 'loading-completion',
          sofId: 'loading-doc',
          eventTime: new Date('2026-03-06T06:00:00Z'),
          eventType: 'LOADING_COMPLETED',
          operation: 'Loading' as const,
          isManualOverride: false,
        },
        {
          id: 'discharge-completion',
          sofId: 'discharge-doc',
          eventTime: new Date('2026-03-05T06:00:00Z'),
          eventType: 'DISCHARGE_COMPLETED',
          operation: 'Discharge' as const,
          isManualOverride: false,
        },
      ],
    };
    const baseline = buildServiceWithCharterParty(
      0,
      { clauses: clauses.slice(0, -1) },
      options,
    );
    await baseline.service.calculate(VOYAGE_ID);
    const baselineParent = getCreatedCalculations(baseline.manager)[0];

    const { service, manager } = buildServiceWithCharterParty(
      0,
      { clauses },
      options,
    );
    await service.calculate(VOYAGE_ID);
    const parentCalculation = getCreatedCalculations(manager)[0];

    expect(parentCalculation).toEqual(
      expect.objectContaining({
        allowedLaytime: '5 days 12:00:00',
        usedLaytime: '3 days 00:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '0.00',
        decisionSnapshot: expect.objectContaining({
          reversibleSettlement: expect.objectContaining({
            settlementStatus: 'NONAUTHORITATIVE',
            reasonCode: 'REVERSIBLE_DESPATCH_TERMS_MISMATCH',
          }),
        }),
      }),
    );
  });

  it.each([
    {
      voyageOperation: 'Loading' as const,
      createdOperation: 'Loading' as const,
      skippedOperation: 'Discharge' as const,
      createdDocumentId: 'loading-doc',
      createdCompletionId: 'loading-completion',
      skippedDocumentId: 'discharge-doc',
      skippedNorEventId: 'discharge-nor',
      skippedWorkStartId: 'discharge-work-stop',
      skippedWorkEndId: 'discharge-work-resume',
      skippedReason:
        'No cargo completion event exists for the Discharge child calculation.',
    },
    {
      voyageOperation: 'Discharge' as const,
      createdOperation: 'Discharge' as const,
      skippedOperation: 'Loading' as const,
      createdDocumentId: 'discharge-doc',
      createdCompletionId: 'discharge-completion',
      skippedDocumentId: 'loading-doc',
      skippedNorEventId: 'loading-nor',
      skippedWorkStartId: 'loading-work-stop',
      skippedWorkEndId: 'loading-work-resume',
      skippedReason:
        'No cargo completion event exists for the Loading child calculation.',
    },
  ])(
    'creates only the %s child when the opposite operation is missing completion evidence',
    async ({
      voyageOperation,
      createdOperation,
      skippedOperation,
      createdDocumentId,
      createdCompletionId,
      skippedDocumentId,
      skippedNorEventId,
      skippedWorkStartId,
      skippedWorkEndId,
      skippedReason,
    }) => {
      const { service, calculations, manager } = buildServiceWithCharterParty(
        0,
        {
          clauses: [
            cpClause('global-laytime', 'laytime_rate', {
              hours: 48,
              noticeHours: 6,
            }),
            cpClause('global-demurrage', 'demurrage_rate', { rate: 12000 }),
            cpClause('global-shex', 'shex_shinc', { shex: true }),
            opClause('loading-laytime', 'laytime_rate', 'Loading', {
              hours: 72,
              noticeHours: 6,
            }),
            opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
              rate: 10000,
            }),
            opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
              hours: 24,
              noticeHours: 6,
            }),
            opClause('discharge-despatch', 'despatch', 'Discharge', {
              rate: 5000,
            }),
          ],
        },
        {
          laytimeOperation: voyageOperation,
          sofDocuments: [
            {
              id: 'loading-doc',
              status: 'Final',
              uploadDate: new Date('2026-03-03T00:00:00Z'),
              operation: 'Loading',
            },
            {
              id: 'discharge-doc',
              status: 'Final',
              uploadDate: new Date('2026-03-03T01:00:00Z'),
              operation: 'Discharge',
            },
            {
              id: 'legacy-doc',
              status: 'Final',
              uploadDate: new Date('2026-03-03T02:00:00Z'),
              operation: null,
            },
          ],
          sofEvents: [
            {
              id: 'legacy-nor',
              sofId: 'legacy-doc',
              eventTime: new Date('2026-03-03T00:00:00Z'),
              eventType: 'NOR_TENDERED',
              operation: null,
              isManualOverride: false,
            },
            {
              id: 'legacy-rain-start',
              sofId: 'legacy-doc',
              eventTime: new Date('2026-03-03T12:00:00Z'),
              eventType: 'RAIN_STOPPAGE',
              operation: null,
              isManualOverride: false,
            },
            {
              id: 'legacy-rain-end',
              sofId: 'legacy-doc',
              eventTime: new Date('2026-03-03T18:00:00Z'),
              eventType: 'RAIN_STOPPED',
              operation: null,
              isManualOverride: false,
            },
            {
              id: skippedNorEventId,
              sofId: skippedDocumentId,
              eventTime: new Date('2026-03-04T00:00:00Z'),
              eventType: 'NOR_TENDERED',
              operation: null,
              isManualOverride: false,
            },
            {
              id: skippedWorkStartId,
              sofId: skippedDocumentId,
              eventTime: new Date('2026-03-04T08:00:00Z'),
              eventType: 'WORK_STOPPED',
              operation: skippedOperation,
              isManualOverride: false,
            },
            {
              id: skippedWorkEndId,
              sofId: skippedDocumentId,
              eventTime: new Date('2026-03-04T12:00:00Z'),
              eventType: 'WORK_RESUMED',
              operation: skippedOperation,
              isManualOverride: false,
            },
            {
              id: createdCompletionId,
              sofId: createdDocumentId,
              eventTime: new Date('2026-03-05T00:00:00Z'),
              eventType:
                createdOperation === 'Loading'
                  ? 'LOADING_COMPLETED'
                  : 'DISCHARGE_COMPLETED',
              operation: createdOperation,
              isManualOverride: false,
            },
          ],
        },
      );

      const versionQueue = [{ maximum: 0 }, { maximum: 1 }];
      manager.createQueryBuilder.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest
          .fn()
          .mockResolvedValue(versionQueue.shift() ?? { maximum: 1 }),
      }));

      const savedParents: LaytimeCalculation[] = [];
      const savedChildren: LaytimeCalculation[] = [];
      const savedPeriods: Array<{ calculationId: string }> = [];
      let parentPersistCount = 0;
      let childPersistCount = 0;
      let latestParent: LaytimeCalculation | null = null;

      manager.save.mockImplementation(async (value) => {
        if (Array.isArray(value)) {
          savedPeriods.push(...(value as Array<{ calculationId: string }>));
          return value;
        }

        if (
          value.parentCalculationId === null ||
          value.parentCalculationId === undefined
        ) {
          parentPersistCount += 1;
          const saved = {
            ...value,
            id: `parent-calculation-${parentPersistCount}`,
          } as LaytimeCalculation;
          latestParent = {
            ...saved,
            periods: [],
          };
          savedParents.push(saved);
          return saved;
        }

        childPersistCount += 1;
        const saved = {
          ...value,
          id: `${value.operation?.toLowerCase() ?? 'child'}-child-${childPersistCount}`,
        } as LaytimeCalculation;
        savedChildren.push(saved);
        return saved;
      });

      manager.findOneOrFail.mockImplementation(async () => {
        if (!latestParent) {
          throw new Error('parent calculation was not saved');
        }

        return {
          ...latestParent,
          periods: latestParent.periods ?? [],
        };
      });

      const firstResult = await service.calculate(VOYAGE_ID);
      const secondResult = await service.calculate(VOYAGE_ID);

      expect(firstResult.calculation.version).toBe(1);
      expect(secondResult.calculation.version).toBe(2);

      expect(savedParents).toHaveLength(2);
      expect(savedChildren).toHaveLength(2);
      expect(savedPeriods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ calculationId: 'parent-calculation-1' }),
          expect.objectContaining({
            calculationId: `${createdOperation.toLowerCase()}-child-1`,
          }),
          expect.objectContaining({ calculationId: 'parent-calculation-2' }),
          expect.objectContaining({
            calculationId: `${createdOperation.toLowerCase()}-child-2`,
          }),
        ]),
      );

      const firstParent = savedParents.find(
        (calculation) => calculation.version === 1,
      ) as LaytimeCalculation;
      const secondParent = savedParents.find(
        (calculation) => calculation.version === 2,
      ) as LaytimeCalculation;
      const firstChild = savedChildren.find(
        (calculation) =>
          calculation.parentCalculationId === 'parent-calculation-1',
      ) as LaytimeCalculation;
      const secondChild = savedChildren.find(
        (calculation) =>
          calculation.parentCalculationId === 'parent-calculation-2',
      ) as LaytimeCalculation;

      expect(firstParent.inputSnapshot).toEqual(
        expect.objectContaining({
          operationChildren: expect.objectContaining({
            requestedOperations: ['Loading', 'Discharge'],
            createdOperations: [createdOperation],
            skippedOperations: [
              expect.objectContaining({
                operation: skippedOperation,
                reason: skippedReason,
              }),
            ],
          }),
        }),
      );
      expect(firstParent.decisionSnapshot).toEqual(
        expect.objectContaining({
          reversibleLaytimeAnalysis: expect.objectContaining({
            status: 'not-available',
            mode: 'audit-only',
            contractRuleApplied: false,
            reason: expect.stringContaining(skippedOperation),
          }),
        }),
      );
      expect(secondParent.inputSnapshot).toEqual(
        expect.objectContaining({
          operationChildren: expect.objectContaining({
            requestedOperations: ['Loading', 'Discharge'],
            createdOperations: [createdOperation],
            skippedOperations: [
              expect.objectContaining({
                operation: skippedOperation,
                reason: skippedReason,
              }),
            ],
          }),
        }),
      );
      expect(secondParent.decisionSnapshot).toEqual(
        expect.objectContaining({
          reversibleLaytimeAnalysis: expect.objectContaining({
            status: 'not-available',
            mode: 'audit-only',
            contractRuleApplied: false,
            reason: expect.stringContaining(skippedOperation),
          }),
        }),
      );

      expect(firstChild.operation).toBe(createdOperation);
      expect(secondChild.operation).toBe(createdOperation);
      expect(firstChild.parentCalculationId).toBe('parent-calculation-1');
      expect(secondChild.parentCalculationId).toBe('parent-calculation-2');

      calculations.findOne.mockImplementation(async ({ where }) => {
        if (where.id === firstParent.id) {
          return firstParent;
        }
        if (where.id === secondParent.id) {
          return secondParent;
        }
        return null;
      });
      calculations.find.mockImplementation(async ({ where }) => {
        if (where.parentCalculationId === firstParent.id) {
          return [firstChild];
        }
        if (where.parentCalculationId === secondParent.id) {
          return [secondChild];
        }
        return [];
      });
      calculations.findAndCount.mockResolvedValue([
        [secondParent, firstParent],
        2,
      ]);

      await expect(
        service.findOperationChildren(firstParent.id),
      ).resolves.toEqual([
        expect.objectContaining({ operation: createdOperation }),
      ]);

      await expect(
        service.findForVoyage(VOYAGE_ID, {
          skip: 0,
          limit: 10,
          page: 1,
        } as never),
      ).resolves.toEqual(
        expect.objectContaining({
          data: [secondParent, firstParent],
        }),
      );
      expect(
        (firstChild.inputSnapshot as Record<string, any>).operationResult,
      ).toEqual(
        expect.objectContaining({
          operation: createdOperation,
          source: 'operation-specific-child-calculation',
          documentSelection: expect.objectContaining({
            matchingDocumentIds: [createdDocumentId],
            legacyNullDocumentIds: ['legacy-doc'],
            usedLegacyFallback: false,
          }),
          eventSelection: expect.objectContaining({
            selectedCompletionEventId: createdCompletionId,
            legacyNullEventIds: expect.arrayContaining([
              'legacy-nor',
              'legacy-rain-start',
              'legacy-rain-end',
            ]),
            usedLegacyFallback: false,
          }),
        }),
      );
    },
  );

  it('rolls back the parent and first child when the second child persistence fails', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          cpClause('global-laytime', 'laytime_rate', {
            hours: 48,
            noticeHours: 6,
          }),
          cpClause('global-demurrage', 'demurrage_rate', { rate: 12000 }),
          opClause('loading-laytime', 'laytime_rate', 'Loading', {
            hours: 72,
            noticeHours: 6,
          }),
          opClause('loading-demurrage', 'demurrage_rate', 'Loading', {
            rate: 10000,
          }),
          opClause('discharge-laytime', 'laytime_rate', 'Discharge', {
            hours: 24,
            noticeHours: 6,
          }),
          opClause('discharge-demurrage', 'demurrage_rate', 'Discharge', {
            rate: 15000,
          }),
        ],
      },
      {
        laytimeOperation: 'Discharge',
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-nor',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-04T00:00:00Z'),
            eventType: 'NOR_TENDERED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-nor',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-04T00:00:00Z'),
            eventType: 'NOR_TENDERED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-06T00:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    manager.save
      .mockImplementationOnce(async (value) =>
        Array.isArray(value) ? value : { ...value, id: 'new-calculation' },
      )
      .mockImplementationOnce(async (value) => value)
      .mockImplementationOnce(async (value) =>
        Array.isArray(value) ? value : { ...value, id: 'loading-child' },
      )
      .mockImplementationOnce(async (value) => value)
      .mockImplementationOnce(async () => {
        throw new Error('discharge child persistence failed');
      });

    await expect(service.calculate(VOYAGE_ID)).rejects.toThrow(
      'discharge child persistence failed',
    );
    expect(manager.findOneOrFail).not.toHaveBeenCalled();
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
      const { service, manager } = buildServiceWithCharterParty(0, undefined, {
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
      });

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
            candidateDocumentIds: [
              'matching-doc',
              'legacy-doc',
              'opposite-doc',
            ],
            includedDocumentIds: ['matching-doc', 'legacy-doc'],
            excludedDocumentIds: ['opposite-doc'],
            matchingDocumentIds: ['matching-doc'],
            legacyNullDocumentIds: ['legacy-doc'],
            oppositeOperationDocumentIds: ['opposite-doc'],
            rule: 'matching-operation-plus-legacy-null',
          }),
          sofDocuments: [
            expect.objectContaining({
              id: 'matching-doc',
              operation: voyageOperation,
            }),
            expect.objectContaining({ id: 'legacy-doc', operation: null }),
            expect.objectContaining({
              id: 'opposite-doc',
              operation: oppositeDocumentOperation,
            }),
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
    const { service, manager } = buildServiceWithCharterParty(0, undefined, {
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
    });

    await service.calculate(VOYAGE_ID);

    const created = manager.create.mock.calls.find(
      ([entity]) => entity === LaytimeCalculation,
    )?.[1] as LaytimeCalculation;

    expect(created.warnings).toContain(
      'Legacy unscoped SOF evidence was used because no operation-matching SOF document existed for the voyage laytime operation.',
    );
    expect(
      (created.inputSnapshot as Record<string, any>).sofDocumentSelection,
    ).toEqual(
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
    const { service } = buildServiceWithCharterParty(0, undefined, {
      laytimeOperation: 'Loading',
      sofDocuments: [
        {
          id: 'opposite-doc',
          status: 'Final',
          uploadDate: new Date('2026-03-03T00:00:00Z'),
          operation: 'Discharge',
        },
      ],
    });

    await expect(service.calculate(VOYAGE_ID)).rejects.toThrow(
      'No applicable SOF document exists for voyage laytime operation Loading',
    );
  });

  it('keeps Final precedence even when a Draft document matches the voyage operation', async () => {
    const { service } = buildServiceWithCharterParty(0, undefined, {
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
    });

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
          id: 'global-readiness',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-03T23:00:00Z'),
          eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
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
          id: 'global-cargo-started',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T09:00:00Z'),
          eventType: 'CARGO_STARTED',
          operation: null,
          isManualOverride: false,
        },
        {
          id: 'legacy-null-completion',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T12:00:00Z'),
          eventType:
            voyageOperation === 'Loading'
              ? 'DISCHARGE_COMPLETED'
              : 'LOADING_COMPLETED',
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
      const snapshotEvents = (created.inputSnapshot as Record<string, any>)
        .sofEvents;

      expect(snapshotEvents).toEqual([
        expect.objectContaining({
          id: 'global-nor',
          operationClassification: 'global',
        }),
        expect.objectContaining({
          id: 'global-readiness',
          eventTime: '2026-03-03T23:00:00.000Z',
          operationClassification: 'global',
        }),
        expect.objectContaining({
          id: 'global-weather',
          operationClassification: 'global',
        }),
        expect.objectContaining({
          id: 'global-cargo-started',
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
      expect(snapshotEvents).toHaveLength(7);
      expect(created.inputSnapshot).toEqual(
        expect.objectContaining({
          calculationEventSelection: expect.objectContaining({
            rule: 'exclude-explicit-mismatched-operation-completion-events',
            includedEventIds: [
              'global-nor',
              'global-readiness',
              'global-weather',
              'global-cargo-started',
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
    const snapshotEvents = (created.inputSnapshot as Record<string, any>)
      .sofEvents;

    expect(snapshotEvents).toEqual([
      expect.objectContaining({
        id: 'global-nor',
        operationClassification: 'global',
      }),
      expect.objectContaining({
        id: 'legacy-loading',
        operationClassification: 'legacy-null',
      }),
      expect.objectContaining({
        id: 'legacy-discharge',
        operationClassification: 'legacy-null',
      }),
    ]);
    expect(
      (created.inputSnapshot as Record<string, any>).calculationEventSelection,
    ).toEqual(
      expect.objectContaining({
        includedEventIds: ['global-nor', 'legacy-loading', 'legacy-discharge'],
        excludedEventIds: [],
      }),
    );
    expect(
      (created.inputSnapshot as Record<string, any>).operationSelection,
    ).toEqual(
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
    ['dry_bulk', 'dry_bulk'],
    ['tanker', 'tanker'],
    ['legacy null', null],
  ] as const)(
    'retains the voyage bulk operation type in parent and child input snapshots for %s',
    async (_label, bulkOperationType) => {
      const { service, manager } = buildServiceWithCharterParty(0, undefined, {
        laytimeOperation: 'Loading',
        bulkOperationType,
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T01:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-completion',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-completion',
            sofId: 'discharge-doc',
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      });

      await service.calculate(VOYAGE_ID);

      const createdCalculations = getCreatedCalculations(manager);
      const parentCalculation = createdCalculations[0];
      const loadingChild = createdCalculations.find(
        (calculation) => calculation.operation === 'Loading',
      );
      const dischargeChild = createdCalculations.find(
        (calculation) => calculation.operation === 'Discharge',
      );

      expect(
        (parentCalculation.inputSnapshot as Record<string, any>).voyage,
      ).toEqual(
        expect.objectContaining({
          bulkOperationType,
        }),
      );
      expect(
        (loadingChild?.inputSnapshot as Record<string, any>).voyage,
      ).toEqual(
        expect.objectContaining({
          bulkOperationType,
        }),
      );
      expect(
        (dischargeChild?.inputSnapshot as Record<string, any>).voyage,
      ).toEqual(
        expect.objectContaining({
          bulkOperationType,
        }),
      );
    },
  );

  it('selects dry-bulk hatches-closed completion and persists the completion audit', async () => {
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
        bulkOperationType: 'dry_bulk',
        sofDocuments: [
          {
            id: 'loading-doc',
            status: 'Final',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
            operation: 'Loading',
          },
        ],
        sofEvents: [
          {
            id: 'global-nor',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-04T00:00:00Z'),
            eventType: 'NOR_TENDERED',
            operation: null,
            isManualOverride: false,
          },
          {
            id: 'cargo-completed',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-05T16:00:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'hatches-closed',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-05T16:30:00Z'),
            eventType: 'HATCHES_CLOSED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'cargo-secured',
            sofId: 'loading-doc',
            eventTime: new Date('2026-03-05T16:45:00Z'),
            eventType: 'CARGO_SECURED',
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
    const snapshotEvents = (created.inputSnapshot as Record<string, any>)
      .sofEvents;

    expect(snapshotEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'hatches-closed',
          eventType: 'HATCHES_CLOSED',
          eventTime: '2026-03-05T16:30:00.000Z',
          operation: 'Loading',
          operationClassification: 'matching-operation',
        }),
        expect.objectContaining({
          id: 'cargo-secured',
          eventType: 'CARGO_SECURED',
          eventTime: '2026-03-05T16:45:00.000Z',
          operation: null,
          operationClassification: 'legacy-null',
        }),
      ]),
    );
    expect(
      (created.decisionSnapshot as Record<string, any>).cargoCompletion,
    ).toEqual(
      expect.objectContaining({
        eventId: 'hatches-closed',
        eventType: 'HATCHES_CLOSED',
        eventTime: '2026-03-05T16:30:00.000Z',
        selectedEventId: 'hatches-closed',
        selectedEventType: 'HATCHES_CLOSED',
        selectedTime: '2026-03-05T16:30:00.000Z',
        bulkOperationType: 'dry_bulk',
        selectionBasis: 'dry-bulk-hatches-closed',
        candidateEventIds: [
          'global-nor',
          'cargo-completed',
          'hatches-closed',
          'cargo-secured',
        ],
        excludedEventIds: ['global-nor', 'cargo-completed', 'cargo-secured'],
      }),
    );
    expect(created.usedLaytime).toBe('1 days 10:30:00');
    expect(created.demurrageAmount).toBe('0.00');
    expect(created.despatchAmount).toBe('0.00');
    expect(created.warnings).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Dry-bulk completion evidence did not include HATCHES_CLOSED',
        ),
      ]),
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
  ])(
    'does not warn when only $label evidence is present',
    async ({ voyageOperation, completionEventType, completionOperation }) => {
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
      expect(
        (created.inputSnapshot as Record<string, any>).operationSelection,
      ).toEqual(
        expect.objectContaining({
          voyageLaytimeOperation: voyageOperation,
          hasLoadingCompletion: voyageOperation === 'Loading',
          hasDischargeCompletion: voyageOperation === 'Discharge',
          mixedOperationEvidence: false,
        }),
      );
    },
  );

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
            noticeSource: 'noticeHours',
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
            configured: true,
            applied: false,
            evaluationStatus: 'UNAVAILABLE',
            reason: 'NO_ASSOCIATED_LOCATION_EVIDENCE',
          }),
        }),
        usedLaytime: '3 days 02:00:00',
        demurrageAmount: '0.00',
      }),
    );
    expect(
      (wibonCreate.decisionSnapshot as Record<string, unknown>)
        .periods as Array<{
        periodType: string;
      }>,
    ).toEqual([expect.objectContaining({ periodType: 'laytime' })]);

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
      (shexCreate.decisionSnapshot as Record<string, unknown>)
        .periods as Array<{
        periodType: string;
      }>,
    ).toEqual([
      expect.objectContaining({ periodType: 'laytime' }),
      expect.objectContaining({ periodType: 'exception' }),
      expect.objectContaining({ periodType: 'laytime' }),
    ]);
    expect(shexCreate.usedLaytime).toBe('2 days 02:00:00');
  });

  it('records persisted WIPON as configured but unapplied without evidence', async () => {
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
            configured: true,
            applied: false,
            evaluationStatus: 'UNAVAILABLE',
            reason: 'NO_ASSOCIATED_LOCATION_EVIDENCE',
          }),
        }),
        usedLaytime: '3 days 02:00:00',
      }),
    );
  });

  it('snapshots location observations and their candidate-associated validity input', async () => {
    const observation = {
      id: 'location-evidence-1',
      voyageId: VOYAGE_ID,
      operation: 'Discharge' as const,
      evidenceTime: new Date('2026-03-04T00:00:00Z'),
      portRelation: 'INSIDE_PORT_LIMITS' as const,
      berthRelation: 'AT_BERTH' as const,
      waitingPlace: 'ANCHORAGE' as const,
      source: 'MANUAL' as const,
      sofDocumentId: null,
      sourceReference: 'Agent email 42',
      note: 'Agent confirmed berth occupied',
      norDocumentId: 'nor-1',
      norTenderedEventId: null,
      createdByUserId: 'user-1',
      createdAt: new Date('2026-03-04T01:00:00Z'),
    };
    const { service, manager, locationEvidence } = buildServiceWithCharterParty(
      0,
      undefined,
      {
        locationEvidence: [observation],
      },
    );

    await service.calculate(VOYAGE_ID);

    expect(locationEvidence.find).toHaveBeenCalledWith({
      where: { voyageId: VOYAGE_ID },
      order: { evidenceTime: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
    const calculation = getCreatedCalculations(manager).find(
      (entry) => entry.parentCalculationId === null,
    ) as LaytimeCalculation;
    expect(calculation.inputSnapshot).toEqual(
      expect.objectContaining({
        norTenderLocationEvidence: {
          availability: 'available',
          validityEvaluation: 'candidate-associated-v1',
          observations: [
            {
              id: observation.id,
              voyageId: VOYAGE_ID,
              operation: 'Discharge',
              evidenceTime: '2026-03-04T00:00:00.000Z',
              sourceTimeZone: null,
              portRelation: 'INSIDE_PORT_LIMITS',
              berthRelation: 'AT_BERTH',
              waitingPlace: 'ANCHORAGE',
              source: 'MANUAL',
              sofDocumentId: null,
              sourceReference: 'Agent email 42',
              note: 'Agent confirmed berth occupied',
              norDocumentId: 'nor-1',
              norTenderedEventId: null,
              associationBasis: 'explicit-nor-document',
              createdByUserId: 'user-1',
              createdAt: '2026-03-04T01:00:00.000Z',
            },
          ],
        },
      }),
    );
    expect(calculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        commencement: expect.objectContaining({
          location: expect.objectContaining({
            overallStatus: 'PASS',
            associationBasis: 'explicit-nor-document',
            selectedEvidence: expect.objectContaining({
              id: observation.id,
              evidenceTime: '2026-03-04T00:00:00.000Z',
            }),
            berth: expect.objectContaining({
              status: 'PASS',
              reason: 'BERTH_REQUIREMENT_SATISFIED',
            }),
            port: expect.objectContaining({
              status: 'PASS',
              reason: 'PORT_REQUIREMENT_SATISFIED',
            }),
          }),
        }),
      }),
    );
  });

  it('records unavailable location evidence without inferring a location result', async () => {
    const { service, manager } = buildService();

    await service.calculate(VOYAGE_ID);

    const calculation = getCreatedCalculations(manager).find(
      (entry) => entry.parentCalculationId === null,
    ) as LaytimeCalculation;
    expect(calculation.inputSnapshot).toEqual(
      expect.objectContaining({
        norTenderLocationEvidence: {
          availability: 'unavailable',
          validityEvaluation: 'candidate-associated-v1',
          observations: [],
        },
      }),
    );
  });

  it('snapshots location rejection reasons while selecting a valid retender', async () => {
    const baseEvidence = {
      voyageId: VOYAGE_ID,
      operation: 'Discharge' as const,
      portRelation: 'INSIDE_PORT_LIMITS' as const,
      waitingPlace: 'NONE' as const,
      source: 'MANUAL' as const,
      sofDocumentId: null,
      sourceReference: null,
      note: null,
      norTenderedEventId: null,
      createdByUserId: 'user-1',
      createdAt: new Date('2026-03-04T14:00:00Z'),
    };
    const { service, manager } = buildServiceWithCharterParty(0, undefined, {
      norDocuments: [
        {
          id: 'nor-location-invalid',
          tenderTime: new Date('2026-03-04T10:00:00Z'),
        },
        {
          id: 'nor-location-retender',
          tenderTime: new Date('2026-03-04T12:00:00Z'),
        },
      ],
      locationEvidence: [
        {
          ...baseEvidence,
          id: 'evidence-location-invalid',
          evidenceTime: new Date('2026-03-04T10:00:00Z'),
          berthRelation: 'NOT_AT_BERTH',
          norDocumentId: 'nor-location-invalid',
        },
        {
          ...baseEvidence,
          id: 'evidence-location-retender',
          evidenceTime: new Date('2026-03-04T12:00:00Z'),
          berthRelation: 'AT_BERTH',
          norDocumentId: 'nor-location-retender',
        },
      ],
      sofEvents: [
        {
          id: 'ready-location',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-04T09:00:00Z'),
          eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
          operation: 'Discharge',
          isManualOverride: false,
        },
        {
          id: 'completion-location',
          sofId: 'sof-1',
          eventTime: new Date('2026-03-06T06:00:00Z'),
          eventType: 'CARGO_COMPLETED',
          operation: 'Discharge',
          isManualOverride: false,
        },
      ],
    });

    await service.calculate(VOYAGE_ID);

    const calculation = getCreatedCalculations(manager).find(
      (entry) => entry.parentCalculationId === null,
    ) as LaytimeCalculation;
    expect(calculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        commencement: expect.objectContaining({
          norDocumentId: 'nor-location-retender',
          location: expect.objectContaining({
            overallStatus: 'PASS',
            selectedEvidence: expect.objectContaining({
              id: 'evidence-location-retender',
            }),
          }),
          locationRejectedCandidates: [
            expect.objectContaining({
              norDocumentId: 'nor-location-invalid',
              rejectionReasons: ['NOR_LOCATION_NOT_AT_BERTH'],
              location: expect.objectContaining({
                overallStatus: 'INVALID',
                selectedEvidence: expect.objectContaining({
                  id: 'evidence-location-invalid',
                }),
              }),
            }),
          ],
        }),
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

  it('snapshots versioned SHEX inputs and resolved local calendar intervals', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        clauses: [
          {
            id: 'persisted-laytime',
            clauseType: 'laytime_rate',
            rawText: 'Laytime allowed: 120h',
            parameters: { hours: 120, noticeHours: 0 },
          },
          {
            id: 'persisted-demurrage',
            clauseType: 'demurrage_rate',
            rawText: 'Demurrage: $20,000/day',
            parameters: { rate: 20000 },
          },
          {
            id: 'persisted-shex-v1',
            clauseType: 'shex_shinc',
            rawText: 'Sydney SHEX calendar',
            parameters: {
              shex: true,
              calendarVersion: 1,
              timeZone: 'Australia/Sydney',
              holidayDates: [],
              saturdayExcepted: false,
            },
          },
        ],
      },
      {
        norDocuments: [
          {
            id: 'nor-1',
            tenderTime: new Date('2026-07-04T12:00:00Z'),
            acceptedTime: new Date('2026-07-04T12:00:00Z'),
          },
        ],
        sofEvents: [
          {
            id: 'completion-1',
            sofId: 'sof-1',
            eventTime: new Date('2026-07-05T18:00:00Z'),
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
    expect(savedCalculation.decisionSnapshot).toEqual(
      expect.objectContaining({
        shexCalendar: {
          clauseId: 'persisted-shex-v1',
          calendarVersion: 1,
          operation: null,
          shex: true,
          timeZone: 'Australia/Sydney',
          saturdayExcepted: false,
          holidayDates: [],
          sourceType: 'explicit-contractual-dates',
          legacyCompatibilityUsed: false,
          generatedIntervals: [
            {
              startTime: '2026-07-04T14:00:00.000Z',
              endTime: '2026-07-05T14:00:00.000Z',
              localDate: '2026-07-05',
              reasons: ['sunday'],
            },
          ],
        },
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
      (shincCreate.decisionSnapshot as Record<string, unknown>)
        .periods as Array<{
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
      (shexCreate.decisionSnapshot as Record<string, unknown>)
        .periods as Array<{
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
            expect.objectContaining({
              parameters: { hours: 48, noticeHours: 6 },
            }),
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

  it.each([
    { operation: 'Loading' as const, childId: 'loading-child' },
    { operation: 'Discharge' as const, childId: 'discharge-child' },
  ])(
    'creates a %s child calculation with persisted periods',
    async ({ operation }) => {
      const { service, manager } = buildService();
      const parentCalculation = {
        id: 'parent-calculation',
        voyageId: VOYAGE_ID,
        version: 7,
        status: 'Draft' as const,
      };

      const child = await (
        service as unknown as {
          createOperationChildResult: (input: {
            parentCalculation: typeof parentCalculation;
            operation: 'Loading' | 'Discharge';
            allowedLaytime: string;
            usedLaytime: string;
            demurrageAmount: string;
            despatchAmount: string;
            inputSnapshot: Record<string, unknown>;
            decisionSnapshot: Record<string, unknown>;
            warnings: string[];
            engineVersion: string | null;
            periods: Array<{
              startTime: Date;
              endTime: Date;
              periodType: string;
              appliedClauseId: string | null;
            }>;
            calculatedAt?: Date;
          }) => Promise<LaytimeCalculation>;
        }
      ).createOperationChildResult({
        parentCalculation,
        operation,
        allowedLaytime: '2 days 00:00:00',
        usedLaytime: '1 days 12:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '1500.00',
        inputSnapshot: { child: true },
        decisionSnapshot: { child: true },
        warnings: ['child warning'],
        engineVersion: 'laytime-engine-v1',
        calculatedAt: new Date('2026-03-05T12:00:00Z'),
        periods: [
          {
            startTime: new Date('2026-03-05T00:00:00Z'),
            endTime: new Date('2026-03-05T06:00:00Z'),
            periodType: 'laytime',
            appliedClauseId: null,
          },
          {
            startTime: new Date('2026-03-05T06:00:00Z'),
            endTime: new Date('2026-03-05T12:00:00Z'),
            periodType: 'exception',
            appliedClauseId: 'clause-1',
          },
        ],
      });

      expect(child).toEqual(
        expect.objectContaining({
          voyageId: VOYAGE_ID,
          parentCalculationId: parentCalculation.id,
          operation,
          version: parentCalculation.version,
          status: parentCalculation.status,
          allowedLaytime: '2 days 00:00:00',
          usedLaytime: '1 days 12:00:00',
          demurrageAmount: '0.00',
          despatchAmount: '1500.00',
          inputSnapshot: { child: true },
          decisionSnapshot: { child: true },
          warnings: ['child warning'],
          engineVersion: 'laytime-engine-v1',
          calculatedAt: new Date('2026-03-05T12:00:00Z'),
          periods: [
            expect.objectContaining({
              calculationId: 'new-calculation',
              periodType: 'laytime',
            }),
            expect.objectContaining({
              calculationId: 'new-calculation',
              periodType: 'exception',
            }),
          ],
        }),
      );

      expect(manager.findOne).toHaveBeenCalledWith(LaytimeCalculation, {
        where: {
          parentCalculationId: parentCalculation.id,
          operation,
        },
      });
      expect(manager.create).toHaveBeenCalledWith(
        LaytimeCalculation,
        expect.objectContaining({
          voyageId: VOYAGE_ID,
          parentCalculationId: parentCalculation.id,
          operation,
          version: parentCalculation.version,
          status: parentCalculation.status,
          calculatedAt: new Date('2026-03-05T12:00:00Z'),
        }),
      );
      expect(manager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          parentCalculationId: parentCalculation.id,
          operation,
        }),
      );
      expect(manager.save).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([
          expect.objectContaining({
            calculationId: 'new-calculation',
            periodType: 'laytime',
          }),
          expect.objectContaining({
            calculationId: 'new-calculation',
            periodType: 'exception',
          }),
        ]),
      );
      expect(parentCalculation).toEqual({
        id: 'parent-calculation',
        voyageId: VOYAGE_ID,
        version: 7,
        status: 'Draft',
      });
    },
  );

  it.each(['Loading', 'Discharge'] as const)(
    'rejects duplicate %s child calculations for the same parent',
    async (operation) => {
      const { service, manager } = buildService();
      manager.findOne.mockResolvedValueOnce({
        id: `${operation.toLowerCase()}-child`,
        parentCalculationId: 'parent-calculation',
        operation,
      });

      await expect(
        (
          service as unknown as {
            createOperationChildResult: (input: {
              parentCalculation: {
                id: string;
                voyageId: string;
                version: number;
                status: 'Draft' | 'Final';
              };
              operation: 'Loading' | 'Discharge';
              allowedLaytime: string;
              usedLaytime: string;
              demurrageAmount: string;
              despatchAmount: string;
              inputSnapshot: Record<string, unknown>;
              decisionSnapshot: Record<string, unknown>;
              warnings: string[];
              engineVersion: string | null;
              periods: Array<{
                startTime: Date;
                endTime: Date;
                periodType: string;
                appliedClauseId: string | null;
              }>;
              calculatedAt?: Date;
            }) => Promise<LaytimeCalculation>;
          }
        ).createOperationChildResult({
          parentCalculation: {
            id: 'parent-calculation',
            voyageId: VOYAGE_ID,
            version: 7,
            status: 'Draft',
          },
          operation,
          allowedLaytime: '2 days 00:00:00',
          usedLaytime: '1 days 12:00:00',
          demurrageAmount: '0.00',
          despatchAmount: '1500.00',
          inputSnapshot: { child: true },
          decisionSnapshot: { child: true },
          warnings: [],
          engineVersion: 'laytime-engine-v1',
          periods: [],
        }),
      ).rejects.toThrow(
        `Laytime calculation parent-calculation already has a ${operation} child result`,
      );

      expect(manager.save).not.toHaveBeenCalled();
    },
  );

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

  it('persists an explicitly scoped non-reversible V1 parent as a summary only', async () => {
    const { service, manager, voyagesService } = buildServiceWithCharterParty(
      0,
      {
        laytimeOperationScope: 'LoadingAndDischarge',
        clauses: [
          cpClause('loading-allowance', 'laytime_rate', {
            operation: 'Loading',
            hours: 72,
          }),
          cpClause('discharge-allowance', 'laytime_rate', {
            operation: 'Discharge',
            hours: 48,
          }),
          cpClause('demurrage', 'demurrage_rate', { rate: 12000 }),
        ],
      },
      {
        sofDocuments: [
          {
            id: 'loading-sof',
            status: 'Final',
            uploadDate: new Date('2026-03-01T00:00:00Z'),
            operation: 'Loading',
          },
          {
            id: 'discharge-sof',
            status: 'Final',
            uploadDate: new Date('2026-03-10T00:00:00Z'),
            operation: 'Discharge',
          },
        ],
        sofEvents: [
          {
            id: 'loading-complete',
            sofId: 'loading-sof',
            eventTime: new Date('2026-03-06T00:00:00Z'),
            eventType: 'LOADING_COMPLETED',
            operation: 'Loading',
            isManualOverride: false,
          },
          {
            id: 'discharge-complete',
            sofId: 'discharge-sof',
            eventTime: new Date('2026-03-14T00:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
            isManualOverride: false,
          },
        ],
      },
    );

    await service.calculate(VOYAGE_ID);

    const [parent, loading, discharge] = getCreatedCalculations(manager);
    expect(parent).toEqual(
      expect.objectContaining({
        allowedLaytime: null,
        usedLaytime: null,
        demurrageAmount: null,
        despatchAmount: null,
        settlementAuthorityStatus: 'PROVISIONAL',
      }),
    );
    expect(parent.decisionSnapshot?.nonReversibleSettlement).toEqual(
      expect.objectContaining({
        version: 1,
        settlementMode: 'separate_operation_results',
        expectedOperations: ['Loading', 'Discharge'],
        parentVersion: 1,
        settlementStatus: 'PROVISIONAL',
        monetaryAggregation: expect.objectContaining({
          status: 'AVAILABLE',
          currency: 'USD',
          legalNetting: false,
          claimableAsAggregate: false,
        }),
      }),
    );
    expect(loading.operation).toBe('Loading');
    expect(discharge.operation).toBe('Discharge');
    expect(loading.version).toBe(parent.version);
    expect(discharge.version).toBe(parent.version);
    expect(manager.save).toHaveBeenCalledWith([]);

    const firstSettlement = parent.decisionSnapshot
      ?.nonReversibleSettlement as any;
    voyagesService.ensureExists.mockResolvedValue({
      id: VOYAGE_ID,
      cargoQuantity: '20000.00',
      laytimeOperation: 'Loading',
      bulkOperationType: null,
    });
    await service.calculate(VOYAGE_ID);
    const secondParent = getCreatedCalculations(manager)[3];
    const secondSettlement = secondParent.decisionSnapshot
      ?.nonReversibleSettlement as any;
    const withoutGeneratedId = ({ childCalculationId: _id, ...summary }: any) =>
      summary;
    expect(withoutGeneratedId(secondSettlement.operations.Loading)).toEqual(
      withoutGeneratedId(firstSettlement.operations.Loading),
    );
    expect(withoutGeneratedId(secondSettlement.operations.Discharge)).toEqual(
      withoutGeneratedId(firstSettlement.operations.Discharge),
    );
    expect(secondSettlement.settlementStatus).toBe(
      firstSettlement.settlementStatus,
    );
  });

  it('atomically finalizes a V1 parent and its exact expected same-version children', async () => {
    const { service, calculations, manager } = buildService();
    const settlement = {
      version: 1,
      settlementMode: 'separate_operation_results',
      expectedOperationScope: 'LoadingAndDischarge',
      expectedOperations: ['Loading', 'Discharge'],
      settlementStatus: 'PROVISIONAL',
      finalizationEligible: true,
      finalizationBlockers: [],
      operations: {
        Loading: { childCalculationId: 'loading-child' },
        Discharge: { childCalculationId: 'discharge-child' },
      },
    };
    const parent = {
      id: 'summary-parent',
      voyageId: VOYAGE_ID,
      version: 3,
      status: 'Draft',
      currency: 'USD',
      parentCalculationId: null,
      decisionSnapshot: { nonReversibleSettlement: settlement },
    } as unknown as LaytimeCalculation;
    const children = [
      {
        id: 'loading-child',
        voyageId: VOYAGE_ID,
        parentCalculationId: parent.id,
        operation: 'Loading',
        version: 3,
        status: 'Draft',
        currency: 'USD',
      },
      {
        id: 'discharge-child',
        voyageId: VOYAGE_ID,
        parentCalculationId: parent.id,
        operation: 'Discharge',
        version: 3,
        status: 'Draft',
        currency: 'USD',
      },
    ] as LaytimeCalculation[];
    calculations.findOne.mockResolvedValue(parent);
    manager.findOneOrFail.mockResolvedValue(parent);
    manager.find.mockResolvedValue(children);

    await expect(service.finalize(parent.id)).resolves.toEqual(
      expect.objectContaining({
        status: 'Final',
        settlementAuthorityStatus: 'FINAL_AUTHORITATIVE',
      }),
    );
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'Final',
          settlementAuthorityStatus: 'FINAL_AUTHORITATIVE',
        }),
      ]),
    );
    expect(manager.save).toHaveBeenCalledWith(children);
  });

  it('does not finalize when an expected child is from another version', async () => {
    const { service, calculations, manager } = buildService();
    const parent = {
      id: 'summary-parent',
      voyageId: VOYAGE_ID,
      version: 3,
      status: 'Draft',
      currency: 'USD',
      parentCalculationId: null,
      decisionSnapshot: {
        nonReversibleSettlement: {
          version: 1,
          expectedOperations: ['Loading'],
          operations: { Loading: { childCalculationId: 'loading-child' } },
          finalizationEligible: true,
          finalizationBlockers: [],
        },
      },
    } as unknown as LaytimeCalculation;
    calculations.findOne.mockResolvedValue(parent);
    manager.findOneOrFail.mockResolvedValue(parent);
    manager.find.mockResolvedValue([
      {
        id: 'loading-child',
        parentCalculationId: parent.id,
        operation: 'Loading',
        version: 2,
        status: 'Draft',
        currency: 'USD',
      },
    ]);

    await expect(service.finalize(parent.id)).rejects.toThrow(
      'does not belong to this parent calculation version',
    );
    expect(parent.status).toBe('Draft');
  });

  it('finalizes only the status of a draft calculation', async () => {
    const { service, calculations } = buildService();
    const calculation = {
      id: 'draft-calculation',
      voyageId: VOYAGE_ID,
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
    calculations.findOne.mockResolvedValue({
      id: 'final-calculation',
      voyageId: VOYAGE_ID,
      status: 'Final',
    });

    await expect(service.finalize('final-calculation')).rejects.toThrow(
      ConflictException,
    );
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('captures one Charter Party currency on the parent, child, and monetary snapshots', async () => {
    const { service, manager } = buildService();

    await service.calculate(VOYAGE_ID);

    const [parent, childCalculation] = getCreatedCalculations(manager);
    expect(parent.currency).toBe('USD');
    expect(childCalculation.currency).toBe('USD');
    expect(parent.inputSnapshot).toMatchObject({
      charterParty: { settlementCurrency: 'USD' },
      currencyAuthority: {
        currency: 'USD',
        source: 'charter_party_settlement_currency',
        status: 'AVAILABLE',
      },
    });
    expect(childCalculation.decisionSnapshot).toMatchObject({
      calculationCurrency: {
        currency: 'USD',
        source: 'charter_party_settlement_currency',
        authorityStatus: 'AVAILABLE',
      },
      demurrage: {
        ratePerDay: 12000,
        rateBasis: 'per_day',
        currency: 'USD',
        amountCurrency: 'USD',
      },
      despatch: {
        rateCurrency: 'USD',
        amountCurrency: 'USD',
      },
    });
  });

  it('keeps time evidence but blocks V1 authority when currency is missing', async () => {
    const { service, manager } = buildServiceWithCharterParty(
      0,
      {
        laytimeOperationScope: 'Loading',
        settlementCurrency: null,
      },
      { laytimeOperation: 'Loading' },
    );

    await service.calculate(VOYAGE_ID);

    const [parent, loading] = getCreatedCalculations(manager);
    expect(parent).toMatchObject({
      currency: null,
      settlementAuthorityStatus: 'NONAUTHORITATIVE',
      allowedLaytime: null,
      usedLaytime: null,
    });
    expect(loading.allowedLaytime).not.toBeNull();
    expect(loading.usedLaytime).not.toBeNull();
    expect(parent.decisionSnapshot?.nonReversibleSettlement).toMatchObject({
      reasonCode: 'CURRENCY_AUTHORITY_REQUIRED',
      finalizationEligible: false,
      monetaryAggregation: {
        status: 'CURRENCY_AUTHORITY_REQUIRED',
        currency: null,
      },
    });
  });

  it('blocks otherwise authoritative reversible money when currency is missing', () => {
    const { service } = buildService();
    const settlement = {
      version: 1,
      settlementStatus: 'FINAL_AUTHORITATIVE',
      reasonCode: 'SETTLED',
      reason: 'Settled.',
      demurrageAmount: 12_000,
      despatchAmount: 0,
      loadingDemurrage: { clauseId: 'loading-rate', rate: 12_000 },
      dischargeDemurrage: { clauseId: 'discharge-rate', rate: 12_000 },
      loadingDespatch: null,
      dischargeDespatch: null,
      warnings: [],
    };

    const result = (service as any).applyReversibleCurrencyAuthority(
      settlement,
      null,
    );

    expect(result).toMatchObject({
      settlementStatus: 'NONAUTHORITATIVE',
      reasonCode: 'CURRENCY_AUTHORITY_REQUIRED',
      currency: null,
      currencyAuthorityStatus: 'CURRENCY_AUTHORITY_REQUIRED',
      demurrageAmount: 12_000,
      loadingDemurrage: { currency: null, rateBasis: 'per_day' },
    });
  });

  it('refuses V1 finalization when the calculation version has no currency', async () => {
    const { service, calculations, manager } = buildService();
    const parent = {
      id: 'currencyless-parent',
      voyageId: VOYAGE_ID,
      version: 1,
      status: 'Draft',
      currency: null,
      parentCalculationId: null,
      decisionSnapshot: {
        nonReversibleSettlement: {
          version: 1,
          expectedOperations: ['Loading'],
          operations: { Loading: { childCalculationId: 'loading-child' } },
          finalizationEligible: true,
          finalizationBlockers: [],
        },
      },
    } as unknown as LaytimeCalculation;
    calculations.findOne.mockResolvedValue(parent);
    manager.findOneOrFail.mockResolvedValue(parent);

    await expect(service.finalize(parent.id)).rejects.toThrow(
      'CURRENCY_AUTHORITY_REQUIRED',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('captures currency changes only on a new immutable calculation version', async () => {
    const { service, manager, charterParty, charterParties } = buildService();

    await service.calculate(VOYAGE_ID);
    const firstParent = getCreatedCalculations(manager)[0];
    charterParty.settlementCurrency = 'EUR';
    charterParties.findOne.mockResolvedValue({ ...charterParty });
    await service.calculate(VOYAGE_ID);
    const calculations = getCreatedCalculations(manager);
    const secondParent = calculations[2];

    expect(firstParent.currency).toBe('USD');
    expect(firstParent.inputSnapshot).toMatchObject({
      charterParty: { settlementCurrency: 'USD' },
    });
    expect(secondParent.currency).toBe('EUR');
    expect(secondParent.inputSnapshot).toMatchObject({
      charterParty: { settlementCurrency: 'EUR' },
    });
  });
});
