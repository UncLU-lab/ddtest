import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { BulkDisputesService } from './bulk-disputes.service';

const VOYAGE_ID = 'b66f8c53-5e31-4f5c-803e-387763ea95ba';
const DEMURRAGE_TYPE = 'demurrage_counter';
const DESPATCH_TYPE = 'despatch_claim';

function buildService(existingActiveDispute: Partial<DisputeCaseBulk> | null) {
  const disputes = {
    findOne: jest.fn().mockResolvedValue(existingActiveDispute),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue(undefined),
  };
  const tenantContext = {
    getOrganizationId: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
  };
  const calculations = {
    findOne: jest.fn().mockResolvedValue({
      id: 'reversible-calculation',
      voyageId: VOYAGE_ID,
      status: 'Final',
      currency: 'USD',
      decisionSnapshot: {
        reversibleSettlement: {
          settlementStatus: 'FINAL_AUTHORITATIVE',
          demurrageAmount: 2086.81,
          despatchAmount: 2086.81,
        },
      },
    }),
  };

  return {
    service: new BulkDisputesService(
      disputes as unknown as Repository<DisputeCaseBulk>,
      voyagesService as unknown as VoyagesService,
      tenantContext as unknown as TenantContextService,
      calculations as unknown as Repository<LaytimeCalculation>,
    ),
    disputes,
    voyagesService,
    tenantContext,
    calculations,
  };
}

describe('BulkDisputesService.create duplicate protection', () => {
  it('rejects a second active claim for the same voyage and claim type', async () => {
    const { service, disputes, voyagesService } = buildService({
      id: 'existing-active-claim',
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE,
      status: 'Open',
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE as 'demurrage_counter' | 'despatch_claim',
        amountDisputed: 2086.81,
        status: 'Open',
      }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE as 'demurrage_counter' | 'despatch_claim',
        amountDisputed: 2086.81,
        status: 'Open',
      }),
    ).rejects.toThrow(
      'An active claim already exists for this voyage and claim type.',
    );

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(disputes.findOne).toHaveBeenCalledWith({
      where: [
        { voyageId: VOYAGE_ID, type: DEMURRAGE_TYPE, status: 'Open' },
        {
          voyageId: VOYAGE_ID,
          type: DEMURRAGE_TYPE,
          status: 'Evidence Submitted',
        },
        {
          voyageId: VOYAGE_ID,
          type: DEMURRAGE_TYPE,
          status: 'In Negotiation',
        },
      ],
    });
    expect(disputes.save).not.toHaveBeenCalled();
  });

  it('allows creating a new claim when only a resolved claim exists', async () => {
    const { service, disputes, voyagesService } = buildService(null);

    disputes.findOne.mockResolvedValueOnce(null);

    const result = await service.create({
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE as 'demurrage_counter' | 'despatch_claim',
      amountDisputed: 2086.81,
      status: 'Open',
    });

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(disputes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
  });

  it('allows a different claim type for the same voyage', async () => {
    const { service, disputes, voyagesService } = buildService({
      id: 'existing-active-claim',
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE,
      status: 'Open',
    });

    disputes.findOne.mockResolvedValueOnce(null);

    const result = await service.create({
      voyageId: VOYAGE_ID,
      type: DESPATCH_TYPE as 'demurrage_counter' | 'despatch_claim',
      amountDisputed: 2086.81,
      status: 'Open',
    });

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(disputes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DESPATCH_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DESPATCH_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
  });

  it('rejects a dispute that belongs to another organization', async () => {
    const { service, disputes, voyagesService } = buildService(null);
    disputes.findOne.mockResolvedValueOnce({
      id: 'foreign-dispute',
      voyageId: 'foreign-voyage',
    });
    voyagesService.ensureExists.mockRejectedValueOnce(new Error('Voyage not found'));

    await expect(service.findOne('foreign-dispute')).rejects.toThrow(
      'Voyage not found',
    );
  });
});

describe('BulkDisputesService reversible settlement claim safety', () => {
  it.each(['PROVISIONAL', 'NONAUTHORITATIVE', 'LEGACY'] as const)(
    'rejects a claim from a %s reversible settlement',
    async (settlementStatus) => {
      const { service, calculations, disputes } = buildService(null);
      calculations.findOne.mockResolvedValue({
        id: 'calculation-1',
        voyageId: VOYAGE_ID,
        status: 'Final',
        currency: 'USD',
        decisionSnapshot: {
          reversibleSettlement: { settlementStatus },
        },
      });

      await expect(
        service.create({
          voyageId: VOYAGE_ID,
          type: DEMURRAGE_TYPE,
          amountDisputed: 12000,
        }),
      ).rejects.toThrow('not final and authoritative');
      expect(disputes.save).not.toHaveBeenCalled();
    },
  );

  it('rejects a historical reversible calculation with no canonical settlement status', async () => {
    const { service, calculations } = buildService(null);
    calculations.findOne.mockResolvedValue({
      id: 'historical-calculation',
      voyageId: VOYAGE_ID,
      status: 'Final',
      currency: 'USD',
      decisionSnapshot: {
        reversibleLaytimeRule: { enabled: true },
      },
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: 12000,
      }),
    ).rejects.toThrow('LEGACY');
  });

  it('rejects a claim before a final authoritative calculation is finalized', async () => {
    const { service, calculations } = buildService(null);
    calculations.findOne.mockResolvedValue({
      id: 'calculation-1',
      voyageId: VOYAGE_ID,
      status: 'Draft',
      currency: 'USD',
      decisionSnapshot: {
        reversibleSettlement: {
          settlementStatus: 'FINAL_AUTHORITATIVE',
          demurrageAmount: 12000,
          despatchAmount: 0,
        },
      },
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: 12000,
      }),
    ).rejects.toThrow('must be finalized');
  });

  it('allows the snapshotted amount from a finalized authoritative settlement', async () => {
    const { service, calculations, disputes } = buildService(null);
    calculations.findOne.mockResolvedValue({
      id: 'calculation-1',
      voyageId: VOYAGE_ID,
      status: 'Final',
      currency: 'USD',
      decisionSnapshot: {
        reversibleSettlement: {
          settlementStatus: 'FINAL_AUTHORITATIVE',
          demurrageAmount: 12000,
          despatchAmount: 0,
        },
      },
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: 12000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ amountDisputed: '12000.00', currency: 'USD' }),
    );
    expect(disputes.save).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });
});

describe('BulkDisputesService non-reversible settlement claim safety', () => {
  it.each([
    ['Draft', 10_000],
    ['Final', 1],
  ] as const)(
    'blocks a %s V1 settlement even when the client submits amount %s',
    async (status, amountDisputed) => {
      const { service, calculations, disputes } = buildService(null);
      calculations.findOne.mockResolvedValue({
        id: 'non-reversible-calculation',
        voyageId: VOYAGE_ID,
        status,
        currency: 'USD',
        decisionSnapshot: {
          nonReversibleSettlement: {
            version: 1,
            settlementMode: 'separate_operation_results',
            settlementStatus:
              status === 'Final' ? 'FINAL_AUTHORITATIVE' : 'PROVISIONAL',
          },
        },
      });

      await expect(
        service.create({
          voyageId: VOYAGE_ID,
          type: DEMURRAGE_TYPE,
          amountDisputed,
        }),
      ).rejects.toThrow('LAYTIME_OPERATION_CLAIM_LINK_REQUIRED');
      expect(disputes.save).not.toHaveBeenCalled();
    },
  );

  it('blocks legacy ordinary non-reversible claims rather than trusting a client amount', async () => {
    const { service, calculations, disputes } = buildService(null);
    calculations.findOne.mockResolvedValue({
      id: 'legacy-non-reversible-calculation',
      voyageId: VOYAGE_ID,
      status: 'Final',
      decisionSnapshot: { reversibleLaytimeRule: { enabled: false } },
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: 999_999,
      }),
    ).rejects.toThrow('LAYTIME_CALCULATION_CURRENCY_REQUIRED');
    expect(disputes.save).not.toHaveBeenCalled();
  });

  it('reports the currency blocker before operation linkage when currency is absent', async () => {
    const { service, calculations } = buildService(null);
    calculations.findOne.mockResolvedValue({
      id: 'non-reversible-calculation',
      voyageId: VOYAGE_ID,
      status: 'Final',
      currency: null,
      decisionSnapshot: {
        nonReversibleSettlement: { version: 1 },
      },
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: 10_000,
      }),
    ).rejects.toThrow('LAYTIME_CALCULATION_CURRENCY_REQUIRED');
  });

  it('does not allow a client-supplied currency to override the calculation', async () => {
    const { service, disputes } = buildService(null);

    await service.create({
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE,
      amountDisputed: 2086.81,
      currency: 'EUR',
    } as any);

    expect(disputes.save).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });
});
