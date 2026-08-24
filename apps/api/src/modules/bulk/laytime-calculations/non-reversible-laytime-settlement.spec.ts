import {
  resolveExpectedLaytimeOperations,
  resolveNonReversibleSettlement,
} from './non-reversible-laytime-settlement';

const child = (
  operation: 'Loading' | 'Discharge',
  values: Partial<{
    allowedSeconds: number;
    usedSeconds: number;
    demurrageAmount: number;
    despatchAmount: number;
    despatchBasis: 'all_time_saved' | 'working_time_saved' | null;
  }> = {},
) => ({
  operation,
  childCalculationId: `${operation.toLowerCase()}-calculation`,
  allowedSeconds: values.allowedSeconds ?? 72 * 3600,
  usedSeconds: values.usedSeconds ?? 72 * 3600,
  demurrageAmount: values.demurrageAmount ?? 0,
  despatchAmount: values.despatchAmount ?? 0,
  despatchBasis: values.despatchBasis ?? null,
  clauseIds: [`${operation.toLowerCase()}-clause`],
  currency: 'USD',
});

describe('Non-Reversible Laytime Settlement V1', () => {
  it.each([
    ['Loading', ['Loading']],
    ['Discharge', ['Discharge']],
    ['LoadingAndDischarge', ['Loading', 'Discharge']],
  ] as const)(
    'expands %s into explicit expected operations',
    (scope, expected) => {
      expect(resolveExpectedLaytimeOperations(scope)).toEqual(expected);
    },
  );

  it('is non-authoritative when expected operation scope is unresolved', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: null,
      settlementCurrency: 'USD',
      children: [child('Loading')],
    });

    expect(result).toMatchObject({
      version: 1,
      settlementMode: 'separate_operation_results',
      settlementStatus: 'NONAUTHORITATIVE',
      expectedOperations: [],
      reasonCode: 'NON_REVERSIBLE_EXPECTED_OPERATION_SCOPE_REQUIRED',
    });
  });

  it('is provisional and never treats a missing expected operation as zero', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: 'LoadingAndDischarge',
      settlementCurrency: 'USD',
      children: [child('Loading')],
    });

    expect(result.settlementStatus).toBe('PROVISIONAL');
    expect(result.missingOperations).toEqual(['Discharge']);
    expect(result.operations.Loading).toBeDefined();
    expect(result.operations.Discharge).toBeUndefined();
  });

  it('preserves mixed outcomes without time transfer or monetary netting', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: 'LoadingAndDischarge',
      settlementCurrency: 'USD',
      children: [
        child('Loading', {
          allowedSeconds: 72 * 3600,
          usedSeconds: 96 * 3600,
          demurrageAmount: 10_000,
        }),
        child('Discharge', {
          allowedSeconds: 48 * 3600,
          usedSeconds: 24 * 3600,
          despatchAmount: 4_000,
          despatchBasis: 'working_time_saved',
        }),
      ],
    });

    expect(result.operations.Loading).toMatchObject({
      balanceType: 'DEMURRAGE',
      excessSeconds: 24 * 3600,
      savedSeconds: 0,
      demurrageAmount: 10_000,
      despatchAmount: 0,
    });
    expect(result.operations.Discharge).toMatchObject({
      balanceType: 'DESPATCH',
      excessSeconds: 0,
      savedSeconds: 24 * 3600,
      demurrageAmount: 0,
      despatchAmount: 4_000,
    });
    expect(result.monetaryAggregation).toEqual(
      expect.objectContaining({
        status: 'AVAILABLE',
        currency: 'USD',
        grossDemurrage: 10_000,
        grossDespatch: 4_000,
        netExposure: 6_000,
        netDirection: 'NET_PAYABLE',
        legalNetting: false,
        claimableAsAggregate: false,
      }),
    );
  });

  it('retains a balanced expected operation in the summary', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: 'Loading',
      settlementCurrency: 'USD',
      children: [child('Loading')],
    });

    expect(result.missingOperations).toEqual([]);
    expect(result.operations.Loading).toMatchObject({
      balanceType: 'BALANCED',
      savedSeconds: 0,
      excessSeconds: 0,
      demurrageAmount: 0,
      despatchAmount: 0,
    });
  });

  it('does not require an uncontracted operation for a single-operation scope', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: 'Discharge',
      settlementCurrency: 'USD',
      children: [child('Discharge')],
    });

    expect(result.settlementStatus).toBe('PROVISIONAL');
    expect(result.finalizationEligible).toBe(true);
    expect(result.expectedOperations).toEqual(['Discharge']);
    expect(result.missingOperations).toEqual([]);
  });

  it.each([
    [10_000, 5_000, 15_000, 0, 15_000, 'NET_PAYABLE'],
    [2_000, 0, 2_000, 5_000, -3_000, 'NET_RECEIVABLE'],
    [4_000, 0, 4_000, 4_000, 0, 'BALANCED'],
  ] as const)(
    'builds a currency-safe informational monetary summary',
    (loadingDemurrage, loadingDespatch, grossDemurrage, grossDespatch, netExposure, netDirection) => {
      const result = resolveNonReversibleSettlement({
        expectedOperationScope: 'LoadingAndDischarge',
        settlementCurrency: 'USD',
        children: [
          child('Loading', {
            demurrageAmount: loadingDemurrage,
            despatchAmount: loadingDespatch,
          }),
          child('Discharge', {
            demurrageAmount: grossDemurrage - loadingDemurrage,
            despatchAmount: grossDespatch - loadingDespatch,
          }),
        ],
      });

      expect(result.monetaryAggregation).toMatchObject({
        status: 'AVAILABLE',
        currency: 'USD',
        grossDemurrage,
        grossDespatch,
        netExposure,
        netDirection,
        legalNetting: false,
        claimableAsAggregate: false,
      });
    },
  );

  it('blocks authority and aggregation when settlement currency is missing', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: 'LoadingAndDischarge',
      settlementCurrency: null,
      children: [
        { ...child('Loading'), currency: null },
        { ...child('Discharge'), currency: null },
      ],
    });

    expect(result).toMatchObject({
      settlementStatus: 'NONAUTHORITATIVE',
      finalizationEligible: false,
      reasonCode: 'CURRENCY_AUTHORITY_REQUIRED',
      monetaryAggregation: {
        status: 'CURRENCY_AUTHORITY_REQUIRED',
        currency: null,
        grossDemurrage: null,
        grossDespatch: null,
        netExposure: null,
      },
    });
  });

  it('does not aggregate mismatched child currencies', () => {
    const result = resolveNonReversibleSettlement({
      expectedOperationScope: 'LoadingAndDischarge',
      settlementCurrency: 'USD',
      children: [child('Loading'), { ...child('Discharge'), currency: 'EUR' }],
    });

    expect(result).toMatchObject({
      settlementStatus: 'NONAUTHORITATIVE',
      finalizationEligible: false,
      reasonCode: 'CURRENCY_MISMATCH',
      monetaryAggregation: { status: 'CURRENCY_MISMATCH' },
    });
  });
});
