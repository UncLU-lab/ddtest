import {
  resolveReversibleLaytimeSettlement,
  type ReversibleSettlementInput,
} from './reversible-laytime-settlement';

const HOUR = 3600;

function period(
  startHour: number,
  endHour: number,
  periodType: 'laytime' | 'exception' = 'laytime',
) {
  return {
    startTime: new Date(Date.UTC(2026, 0, 1, startHour)),
    endTime: new Date(Date.UTC(2026, 0, 1, endHour)),
    periodType,
    appliedClauseId: periodType === 'exception' ? 'exception-clause' : null,
    exceptionKind: periodType === 'exception' ? ('shex' as const) : undefined,
  };
}

function operation(
  name: 'Loading' | 'Discharge',
  timeline: ReturnType<typeof period>[],
  overrides: Partial<NonNullable<ReversibleSettlementInput['operations']['Loading']>> = {},
) {
  return {
    operation: name,
    childCalculationId: `${name.toLowerCase()}-child`,
    timeline,
    demurrage: { clauseId: `${name}-demurrage`, rate: 12000 },
    despatch: {
      clauseId: `${name}-despatch`,
      rate: 6000,
      timeBasis: 'working_time_saved' as const,
    },
    ...overrides,
  };
}

function input(
  loadingTimeline: ReturnType<typeof period>[],
  dischargeTimeline: ReturnType<typeof period>[],
  overrides: Partial<ReversibleSettlementInput> = {},
): ReversibleSettlementInput {
  return {
    rule: {
      clauseId: 'reversible-v1',
      contractStatus: 'v1',
      settlementVersion: 1,
      allowanceMode: 'sum_operation_allowances',
    },
    cargoQuantity: 20000,
    allowances: {
      Loading: {
        clauseId: 'loading-allowance',
        source: 'operation-specific',
        mechanism: 'hours',
        parameters: { hours: 72, operation: 'Loading' },
        allowedSeconds: 72 * HOUR,
      },
      Discharge: {
        clauseId: 'discharge-allowance',
        source: 'operation-specific',
        mechanism: 'hours',
        parameters: { hours: 48, operation: 'Discharge' },
        allowedSeconds: 48 * HOUR,
      },
    },
    operations: {
      Loading: operation('Loading', loadingTimeline),
      Discharge: operation('Discharge', dischargeTimeline),
    },
    ...overrides,
  };
}

describe('resolveReversibleLaytimeSettlement', () => {
  it('does not trigger demurrage at the Loading nominal allowance', () => {
    const result = resolveReversibleLaytimeSettlement(
      input([period(0, 84)], [period(100, 136)]),
    );

    expect(result.settlementStatus).toBe('FINAL_AUTHORITATIVE');
    expect(result.combinedAllowedSeconds).toBe(120 * HOUR);
    expect(result.combinedUsedSeconds).toBe(120 * HOUR);
    expect(result.timeline.filter((entry) => entry.classification === 'demurrage')).toHaveLength(0);
    expect(result.threshold).toEqual(
      expect.objectContaining({ operation: 'Discharge', cumulativeSeconds: 120 * HOUR }),
    );
  });

  it('splits the exact combined threshold during Discharge', () => {
    const result = resolveReversibleLaytimeSettlement(
      input([period(0, 84)], [period(100, 160)]),
    );

    expect(result.threshold?.operation).toBe('Discharge');
    expect(result.threshold?.timestamp.toISOString()).toBe('2026-01-06T16:00:00.000Z');
    expect(result.timeline.slice(-2)).toEqual([
      expect.objectContaining({ operation: 'Discharge', classification: 'laytime', durationSeconds: 36 * HOUR }),
      expect.objectContaining({ operation: 'Discharge', classification: 'demurrage', durationSeconds: 24 * HOUR }),
    ]);
    expect(result.combinedOverrunSeconds).toBe(24 * HOUR);
    expect(result.demurrageAmount).toBe(12000);
  });

  it('starts combined demurrage during Loading and carries it into Discharge', () => {
    const result = resolveReversibleLaytimeSettlement(
      input([period(0, 130)], [period(150, 154)]),
    );

    expect(result.threshold).toEqual(
      expect.objectContaining({ operation: 'Loading', cumulativeSeconds: 120 * HOUR }),
    );
    expect(result.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'Loading', classification: 'demurrage', durationSeconds: 10 * HOUR }),
        expect.objectContaining({ operation: 'Discharge', classification: 'demurrage', durationSeconds: 4 * HOUR }),
      ]),
    );
  });

  it('keeps an exception after the child nominal limit excepted before the combined threshold', () => {
    const result = resolveReversibleLaytimeSettlement(
      input(
        [period(0, 80), period(80, 84, 'exception'), period(84, 88)],
        [period(100, 136)],
      ),
    );

    expect(result.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'Loading',
          classification: 'exception',
          durationSeconds: 4 * HOUR,
          countedSeconds: 0,
        }),
      ]),
    );
    expect(result.combinedUsedSeconds).toBe(120 * HOUR);
  });

  it('counts an exception after the combined threshold under once-on-demurrage', () => {
    const result = resolveReversibleLaytimeSettlement(
      input([period(0, 121)], [period(140, 144, 'exception')]),
    );

    expect(result.timeline.at(-1)).toEqual(
      expect.objectContaining({
        operation: 'Discharge',
        originalClassification: 'exception',
        classification: 'demurrage',
        countedSeconds: 4 * HOUR,
        onceOnDemurrageOverrideReason: 'COMBINED_THRESHOLD_ALREADY_REACHED',
      }),
    );
  });

  it.each([
    { loading: 60, discharge: 56, saved: 4, overrun: 0, demurrage: 0, despatch: 1000 },
    { loading: 84, discharge: 36, saved: 0, overrun: 0, demurrage: 0, despatch: 0 },
    { loading: 60, discharge: 36, saved: 24, overrun: 0, demurrage: 0, despatch: 6000 },
    { loading: 84, discharge: 60, saved: 0, overrun: 24, demurrage: 12000, despatch: 0 },
  ])('settles the approved pooled balance %#', ({ loading, discharge, saved, overrun, demurrage, despatch }) => {
    const result = resolveReversibleLaytimeSettlement(
      input([period(0, loading)], [period(200, 200 + discharge)]),
    );

    expect(result.combinedSavedSeconds).toBe(saved * HOUR);
    expect(result.combinedOverrunSeconds).toBe(overrun * HOUR);
    expect(result.demurrageAmount).toBe(demurrage);
    expect(result.despatchAmount).toBe(despatch);
  });

  it('settles Loading allowed=72h used=48h and Discharge allowed=72h used=96h to zero net overrun and surplus excluding the sailing gap', () => {
    const base = input([period(0, 48)], [period(200, 296)], {
      allowances: {
        Loading: {
          clauseId: 'loading-allowance',
          source: 'operation-specific',
          mechanism: 'hours',
          parameters: { hours: 72, operation: 'Loading' },
          allowedSeconds: 72 * HOUR,
        },
        Discharge: {
          clauseId: 'discharge-allowance',
          source: 'operation-specific',
          mechanism: 'hours',
          parameters: { hours: 72, operation: 'Discharge' },
          allowedSeconds: 72 * HOUR,
        },
      },
    });

    const result = resolveReversibleLaytimeSettlement(base);

    expect(result.settlementStatus).toBe('FINAL_AUTHORITATIVE');
    expect(result.reasonCode).toBe('SETTLED');
    expect(result.combinedAllowedSeconds).toBe(144 * HOUR);
    expect(result.combinedUsedSeconds).toBe(144 * HOUR);
    expect(result.combinedOverrunSeconds).toBe(0);
    expect(result.combinedSavedSeconds).toBe(0);
    expect(result.demurrageAmount).toBe(0);
    expect(result.despatchAmount).toBe(0);
    // Sailing gap between hour 48 and 200 is not in timeline
    expect(result.timeline.reduce((total, s) => total + s.countedSeconds, 0)).toBe(144 * HOUR);
    expect(result.timeline.filter((s) => s.classification === 'demurrage')).toHaveLength(0);
  });

  it('is non-authoritative when demurrage rates differ', () => {
    const base = input([period(0, 84)], [period(100, 160)]);
    base.operations.Discharge = operation('Discharge', [period(100, 160)], {
      demurrage: { clauseId: 'different-rate', rate: 15000 },
    });

    const result = resolveReversibleLaytimeSettlement(base);

    expect(result.settlementStatus).toBe('NONAUTHORITATIVE');
    expect(result.reasonCode).toBe('REVERSIBLE_DEMURRAGE_RATE_MISMATCH');
    expect(result.demurrageAmount).toBe(0);
    expect(result.loadingDemurrage?.rate).toBe(12000);
    expect(result.dischargeDemurrage?.rate).toBe(15000);
  });

  it('is final with zero despatch when neither operation has a despatch agreement', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.operations.Loading = operation('Loading', [period(0, 60)], { despatch: null });
    base.operations.Discharge = operation('Discharge', [period(100, 136)], { despatch: null });

    const result = resolveReversibleLaytimeSettlement(base);

    expect(result.settlementStatus).toBe('FINAL_AUTHORITATIVE');
    expect(result.reasonCode).toBe('DESPATCH_NOT_CONTRACTUALLY_AGREED');
    expect(result.combinedSavedSeconds).toBe(24 * HOUR);
    expect(result.despatchAmount).toBe(0);
  });

  it('refuses all-time-saved reversible despatch in V1', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.operations.Loading = operation('Loading', [period(0, 60)], {
      despatch: { clauseId: 'loading-ats', rate: 6000, timeBasis: 'all_time_saved' },
    });
    base.operations.Discharge = operation('Discharge', [period(100, 136)], {
      despatch: { clauseId: 'discharge-ats', rate: 6000, timeBasis: 'all_time_saved' },
    });

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        settlementStatus: 'NONAUTHORITATIVE',
        reasonCode: 'REVERSIBLE_ALL_TIME_SAVED_UNSUPPORTED_V1',
        despatchAmount: 0,
      }),
    );
  });

  it('refuses despatch when only one operation has an agreement', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.operations.Discharge = operation('Discharge', [period(100, 136)], {
      despatch: null,
    });

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        settlementStatus: 'NONAUTHORITATIVE',
        reasonCode: 'REVERSIBLE_DESPATCH_TERMS_MISMATCH',
      }),
    );
  });

  it('refuses despatch when effective operation rates differ', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.operations.Discharge = operation('Discharge', [period(100, 136)], {
      despatch: {
        clauseId: 'different-despatch',
        rate: 7000,
        timeBasis: 'working_time_saved',
      },
    });

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        settlementStatus: 'NONAUTHORITATIVE',
        reasonCode: 'REVERSIBLE_DESPATCH_RATE_MISMATCH',
      }),
    );
  });

  it('refuses mixed working-time-saved and all-time-saved bases', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.operations.Discharge = operation('Discharge', [period(100, 136)], {
      despatch: {
        clauseId: 'discharge-ats',
        rate: 6000,
        timeBasis: 'all_time_saved',
      },
    });

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        settlementStatus: 'NONAUTHORITATIVE',
        reasonCode: 'REVERSIBLE_DESPATCH_TERMS_MISMATCH',
      }),
    );
  });

  it('is provisional when one operation is incomplete', () => {
    const base = input([period(0, 60)], []);
    base.operations.Discharge = null;

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        settlementStatus: 'PROVISIONAL',
        reasonCode: 'REVERSIBLE_OPERATION_INCOMPLETE',
        despatchAmount: 0,
      }),
    );
  });

  it('does not silently apply V1 semantics to a legacy enabled-only clause', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.rule = {
      clauseId: 'legacy-reversible',
      contractStatus: 'legacy',
      settlementVersion: null,
      allowanceMode: null,
    };

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        version: null,
        allowanceMode: null,
        settlementStatus: 'LEGACY',
        reasonCode: 'LEGACY_REVERSIBLE_CONTRACT',
      }),
    );
  });

  it('does not double a global allowance', () => {
    const base = input([period(0, 60)], [period(100, 136)]);
    base.allowances.Loading = {
      ...base.allowances.Loading!,
      clauseId: 'global-allowance',
      source: 'global-fallback',
    };
    base.allowances.Discharge = {
      ...base.allowances.Discharge!,
      clauseId: 'global-allowance',
      source: 'global-fallback',
    };

    expect(resolveReversibleLaytimeSettlement(base)).toEqual(
      expect.objectContaining({
        settlementStatus: 'NONAUTHORITATIVE',
        reasonCode: 'REVERSIBLE_EXPLICIT_OPERATION_ALLOWANCES_REQUIRED',
        combinedAllowedSeconds: null,
      }),
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'refuses a contract missing the %s operation allowance',
    (operationName) => {
      const base = input([period(0, 60)], [period(100, 136)]);
      base.allowances[operationName] = null;

      expect(resolveReversibleLaytimeSettlement(base)).toEqual(
        expect.objectContaining({
          settlementStatus: 'NONAUTHORITATIVE',
          reasonCode: 'REVERSIBLE_EXPLICIT_OPERATION_ALLOWANCES_REQUIRED',
        }),
      );
    },
  );
});
