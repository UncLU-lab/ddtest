import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { LaytimeStatement } from '../entities/laytime-statement.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { Voyage } from '../entities/voyage.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { LaytimeStatementsService } from './laytime-statements.service';

const CALCULATION_ID = '11111111-1111-4111-8111-111111111111';
const VOYAGE_ID = '22222222-2222-4222-8222-222222222222';
const SOF_ID = '33333333-3333-4333-8333-333333333333';

function buildCalculation(overrides: Partial<LaytimeCalculation> = {}) {
  return {
    id: CALCULATION_ID,
    voyageId: VOYAGE_ID,
    parentCalculationId: null,
    version: 4,
    status: 'Final' as const,
    settlementAuthorityStatus: 'FINAL_AUTHORITATIVE' as const,
    currency: 'USD' as const,
    calculatedAt: new Date('2026-08-31T07:35:30Z'),
    allowedLaytime: '6 days',
    usedLaytime: '6 days',
    demurrageAmount: '0.00',
    despatchAmount: '0.00',
    engineVersion: 'laytime-engine-v1',
    inputSnapshot: {
      sofDocumentSelection: { includedDocumentIds: [SOF_ID] },
      sofDocuments: [{ id: SOF_ID }],
      norDocuments: [],
      norTenderLocationEvidence: { observations: [] },
      sofEvents: [],
    },
    decisionSnapshot: {
      commencement: { commencedAt: '2026-08-25T00:00:00.000Z' },
      reversibleSettlement: {
        version: 1,
        settlementStatus: 'FINAL_AUTHORITATIVE',
        reasonCode: 'SETTLED',
        combinedAllowedSeconds: 518400,
        combinedUsedSeconds: 518400,
        combinedOverrunSeconds: 0,
        combinedSavedSeconds: 0,
        loadingChildCalculationId: 'loading-child',
        dischargeChildCalculationId: 'discharge-child',
        demurrageAmount: 0,
        despatchAmount: 0,
      },
      reversibleLaytimeAnalysis: {
        pool: { transferableSurplusSeconds: 86400 },
      },
    },
    ...overrides,
  } as LaytimeCalculation;
}

function buildService(calculation = buildCalculation()) {
  const statement = {
    id: 'statement-1',
    version: 1,
    sourceCalculationId: CALCULATION_ID,
  } as LaytimeStatement;
  const statements = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(statement),
  };
  const calculations = {
    findOne: jest.fn().mockResolvedValue(calculation),
    find: jest.fn().mockResolvedValue([
      {
        id: 'loading-child',
        parentCalculationId: CALCULATION_ID,
        operation: 'Loading',
        version: calculation.version,
        allowedLaytime: '3 days',
        usedLaytime: '2 days',
        currency: 'USD',
        inputSnapshot: {},
        decisionSnapshot: {},
      },
      {
        id: 'discharge-child',
        parentCalculationId: CALCULATION_ID,
        operation: 'Discharge',
        version: calculation.version,
        allowedLaytime: '3 days',
        usedLaytime: '4 days',
        currency: 'USD',
        inputSnapshot: {},
        decisionSnapshot: {},
      },
    ]),
  };
  const voyage = {
    id: VOYAGE_ID,
    organizationId: 'org-1',
    reference: 'STAGE-REV-002',
    vessel: { name: 'MV Stage' },
    charterPartyId: 'cp-1',
    cargoType: 'Coal',
    cargoQuantity: '50000.00',
    cargoQuantityUnit: 'MT',
    loadPort: 'SGSIN',
    dischargePort: 'AUSYD',
  } as unknown as Voyage;
  const voyagesService = {
    findOne: jest.fn().mockResolvedValue(voyage),
    ensureExists: jest.fn().mockResolvedValue(voyage),
  };
  const charterParties = {
    findOne: jest.fn().mockResolvedValue({
      id: 'cp-1',
      laytimeOperationScope: 'LoadingAndDischarge',
      settlementCurrency: 'USD',
      clauses: [],
    }),
  };
  const sofDocuments = {
    findBy: jest.fn().mockResolvedValue([
      {
        id: SOF_ID,
        filePath: 'statement-of-facts.pdf',
        status: 'Final',
        uploadDate: new Date('2026-08-30T00:00:00Z'),
        operation: null,
      },
    ]),
  };
  const tenantContext = {
    getUserId: jest.fn().mockReturnValue('user-1'),
  };

  return {
    service: new LaytimeStatementsService(
      statements as unknown as Repository<LaytimeStatement>,
      calculations as unknown as Repository<LaytimeCalculation>,
      {} as Repository<Voyage>,
      charterParties as unknown as Repository<CharterParty>,
      sofDocuments as unknown as Repository<SofDocument>,
      voyagesService as unknown as VoyagesService,
      tenantContext as unknown as TenantContextService,
    ),
    statements,
    calculations,
    voyage,
  };
}

describe('LaytimeStatementsService', () => {
  it('creates a zero-value statement from one authoritative parent and snapshots child references', async () => {
    const { service, statements } = buildService();

    const result = await service.create(CALCULATION_ID);

    expect(statements.create).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        sourceCalculationId: CALCULATION_ID,
        currency: 'USD',
        settlementAuthorityStatus: 'FINAL_AUTHORITATIVE',
        authoritativeSofDocumentIds: [SOF_ID],
        statementSnapshot: expect.objectContaining({
          calculation: expect.objectContaining({
            settlement: expect.objectContaining({ demurrageAmount: 0 }),
          }),
        }),
      }),
    );
    expect(result.id).toBe('statement-1');
  });

  it.each([
    ['PROVISIONAL', 'Final'],
    ['NONAUTHORITATIVE', 'Final'],
    ['LEGACY', 'Final'],
    ['FINAL_AUTHORITATIVE', 'Draft'],
  ] as const)(
    'blocks %s authority/lifecycle source',
    async (authority, status) => {
      const { service } = buildService(
        buildCalculation({
          settlementAuthorityStatus: authority,
          status,
        } as Partial<LaytimeCalculation>),
      );

      await expect(service.create(CALCULATION_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );

  it('returns the existing statement when the same calculation is submitted again', async () => {
    const { service, statements } = buildService();
    statements.findOne.mockResolvedValue({
      id: 'existing',
      sourceCalculationId: CALCULATION_ID,
    });

    await expect(service.create(CALCULATION_ID)).resolves.toMatchObject({
      id: 'existing',
    });
    expect(statements.create).not.toHaveBeenCalled();
  });

  it('blocks a calculation without authoritative currency', async () => {
    const { service } = buildService(buildCalculation({ currency: null }));
    await expect(service.create(CALCULATION_ID)).rejects.toThrow(
      'authoritative settlement currency',
    );
  });
});
