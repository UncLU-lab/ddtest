import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { buildVoyageSummary, VoyageSummaryInput } from './voyage-summary';

function buildInput(
  overrides: Partial<VoyageSummaryInput> = {},
): VoyageSummaryInput {
  return {
    voyage: {
      id: 'voyage-1',
      status: 'Active',
      laycanEnd: '2026-12-31',
    } as VoyageSummaryInput['voyage'],
    charterParty: {
      id: 'charter-party-1',
      clauses: [{ id: 'clause-1' }],
    } as VoyageSummaryInput['charterParty'],
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
    ] as VoyageSummaryInput['counterpartyLinks'],
    sofDocuments: [
      {
        id: 'sof-1',
        status: 'Final',
        uploadDate: new Date('2026-03-01T00:00:00Z'),
      },
    ] as VoyageSummaryInput['sofDocuments'],
    norDocuments: [
      {
        id: 'nor-1',
        tenderTime: new Date('2026-03-01T00:00:00Z'),
      },
    ] as VoyageSummaryInput['norDocuments'],
    latestCalculation: {
      id: 'calculation-1',
      calculatedAt: new Date('2026-03-02T00:00:00Z'),
      demurrageAmount: '0.00',
      despatchAmount: '0.00',
    } as LaytimeCalculation,
    disputes: [],
    ...overrides,
  };
}

describe('buildVoyageSummary calculation staleness', () => {
  it('marks a calculation stale only when a SOF upload postdates it', () => {
    const stale = buildVoyageSummary(
      buildInput({
        sofDocuments: [
          {
            id: 'newer-sof',
            status: 'Draft',
            uploadDate: new Date('2026-03-03T00:00:00Z'),
          },
        ] as VoyageSummaryInput['sofDocuments'],
      }),
    );

    expect(stale.risk.calculationStale).toBe(true);
  });

  it('does not mark a calculation stale for changed NOR or charter-party values', () => {
    const summary = buildVoyageSummary(
      buildInput({
        norDocuments: [
          {
            id: 'changed-nor',
            tenderTime: new Date('2026-03-05T00:00:00Z'),
            acceptedTime: new Date('2026-03-05T06:00:00Z'),
          },
        ] as VoyageSummaryInput['norDocuments'],
        charterParty: {
          id: 'charter-party-1',
          clauses: [{ id: 'changed-rate', parameters: { rate: 25000 } }],
        } as VoyageSummaryInput['charterParty'],
      }),
    );

    expect(summary.risk.calculationStale).toBe(false);
  });

  it('reconstructs parties and commercial terms from persisted relations', () => {
    const summary = buildVoyageSummary(
      buildInput({
        charterParty: {
          id: 'charter-party-1',
          clauses: [{ id: 'clause-1' }],
          laytimeAllowed: 72,
          demurrageRate: '25000.00',
          dispatchRate: '12500.00',
          timeCountingBasis: '6h SHINC',
          norNoticePeriod: '12 hours',
        } as VoyageSummaryInput['charterParty'],
      }),
    );

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

  it('uses the persisted voyage laycanEnd directly when calculating expiry', () => {
    const summary = buildVoyageSummary(
      buildInput({
        voyage: {
          id: 'voyage-1',
          status: 'Planned',
          laycanEnd: '2026-01-01',
        } as VoyageSummaryInput['voyage'],
        charterParty: null,
        counterpartyLinks: [],
        sofDocuments: [],
        norDocuments: [],
        latestCalculation: null,
        disputes: [],
      }),
    );

    expect(summary.risk.laycanExpired).toBe(true);
  });
});
