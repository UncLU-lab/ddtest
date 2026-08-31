import type { EnginePeriod } from '../laytime/laytime.types';
import {
  LAYTIME_SETTLEMENT_AUTHORITY_STATUSES,
  type LaytimeSettlementAuthorityStatus,
} from './laytime-settlement-authority';
import type { SettlementCurrency } from '../currency/settlement-currency';

export const REVERSIBLE_SETTLEMENT_STATUSES =
  LAYTIME_SETTLEMENT_AUTHORITY_STATUSES;

export type ReversibleSettlementStatus = LaytimeSettlementAuthorityStatus;

export type ReversibleSettlementReasonCode =
  | 'SETTLED'
  | 'DRAFT_SOF_EVIDENCE'
  | 'DESPATCH_NOT_CONTRACTUALLY_AGREED'
  | 'LEGACY_REVERSIBLE_CONTRACT'
  | 'REVERSIBLE_CONTRACT_AMBIGUOUS'
  | 'REVERSIBLE_CONTRACT_INVALID'
  | 'REVERSIBLE_OPERATION_INCOMPLETE'
  | 'REVERSIBLE_EXPLICIT_OPERATION_ALLOWANCES_REQUIRED'
  | 'REVERSIBLE_DEMURRAGE_RATE_MISMATCH'
  | 'REVERSIBLE_DESPATCH_TERMS_MISMATCH'
  | 'REVERSIBLE_DESPATCH_RATE_MISMATCH'
  | 'REVERSIBLE_ALL_TIME_SAVED_UNSUPPORTED_V1'
  | 'CURRENCY_AUTHORITY_REQUIRED';

export type ReversibleSettlementRuleInput = {
  clauseId: string | null;
  contractStatus: 'v1' | 'legacy' | 'ambiguous' | 'invalid';
  settlementVersion: 1 | null;
  allowanceMode: 'sum_operation_allowances' | null;
};

export type ReversibleAllowanceInput = {
  clauseId: string;
  source: 'operation-specific' | 'global-fallback';
  mechanism: 'hours' | 'days' | 'rate';
  parameters: Record<string, unknown>;
  allowedSeconds: number;
};

export type ReversibleOperationSettlementInput = {
  operation: 'Loading' | 'Discharge';
  childCalculationId: string;
  timeline: EnginePeriod[];
  demurrage: {
    clauseId: string | null;
    rate: number | null;
    rateBasis?: 'per_day';
    currency?: SettlementCurrency | null;
  } | null;
  despatch: {
    clauseId: string;
    rate: number | null;
    timeBasis: 'all_time_saved' | 'working_time_saved';
    rateBasis?: 'per_day';
    currency?: SettlementCurrency | null;
  } | null;
};

export type ReversibleSettlementInput = {
  rule: ReversibleSettlementRuleInput;
  cargoQuantity: number;
  allowances: {
    Loading: ReversibleAllowanceInput | null;
    Discharge: ReversibleAllowanceInput | null;
  };
  operations: {
    Loading: ReversibleOperationSettlementInput | null;
    Discharge: ReversibleOperationSettlementInput | null;
  };
};

export type ReversibleSettlementSegment = {
  operation: 'Loading' | 'Discharge';
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  sourceChildCalculationId: string;
  sourcePeriodIndex: number;
  originalClassification: EnginePeriod['periodType'];
  classification: EnginePeriod['periodType'];
  countedSeconds: number;
  appliedClauseId: string | null;
  exceptionKind: EnginePeriod['exceptionKind'] | null;
  exceptionKinds: EnginePeriod['exceptionKinds'] | null;
  thresholdCrossing: boolean;
  onceOnDemurrageOverrideReason: 'COMBINED_THRESHOLD_ALREADY_REACHED' | null;
  calendarDates: EnginePeriod['calendarDates'] | null;
};

export type ReversibleSettlementResult = {
  version: 1 | null;
  allowanceMode: 'sum_operation_allowances' | null;
  cargoQuantityBasis: 'voyage_cargo_quantity' | null;
  thresholdMode: 'combined_pool' | null;
  settlementStatus: ReversibleSettlementStatus;
  reasonCode: ReversibleSettlementReasonCode;
  reason: string;
  reversibleClauseId: string | null;
  loadingChildCalculationId: string | null;
  dischargeChildCalculationId: string | null;
  loadingAllowance: ReversibleAllowanceInput | null;
  dischargeAllowance: ReversibleAllowanceInput | null;
  loadingCountableInputSeconds: number | null;
  dischargeCountableInputSeconds: number | null;
  loadingDemurrage: ReversibleOperationSettlementInput['demurrage'] | null;
  dischargeDemurrage: ReversibleOperationSettlementInput['demurrage'] | null;
  loadingDespatch: ReversibleOperationSettlementInput['despatch'] | null;
  dischargeDespatch: ReversibleOperationSettlementInput['despatch'] | null;
  combinedAllowedSeconds: number | null;
  combinedUsedSeconds: number;
  combinedOverrunSeconds: number;
  combinedSavedSeconds: number;
  cargoQuantity: number;
  threshold: {
    operation: 'Loading' | 'Discharge';
    timestamp: Date;
    cumulativeSeconds: number;
  } | null;
  timeline: ReversibleSettlementSegment[];
  demurrageRate: number | null;
  despatchRate: number | null;
  despatchTimeBasis: 'all_time_saved' | 'working_time_saved' | null;
  demurrageAmount: number;
  despatchAmount: number;
  currency?: SettlementCurrency | null;
  currencySource?: 'charter_party_settlement_currency';
  currencyAuthorityStatus?: 'AVAILABLE' | 'CURRENCY_AUTHORITY_REQUIRED';
  claimEligibilityImpact?:
    | 'AUTHORITATIVE_CURRENCY_AVAILABLE'
    | 'LAYTIME_CALCULATION_CURRENCY_REQUIRED';
  warnings: string[];
};

const DAY_SECONDS = 86400;

function resultBase(
  input: ReversibleSettlementInput,
): ReversibleSettlementResult {
  const countableInputSeconds = (
    operation: ReversibleOperationSettlementInput | null,
  ): number | null =>
    operation
      ? operation.timeline
          .filter((period) => period.periodType !== 'exception')
          .reduce((total, period) => total + durationSeconds(period), 0)
      : null;

  return {
    version: input.rule.contractStatus === 'v1' ? 1 : null,
    allowanceMode:
      input.rule.contractStatus === 'v1' ? 'sum_operation_allowances' : null,
    cargoQuantityBasis:
      input.rule.contractStatus === 'v1' ? 'voyage_cargo_quantity' : null,
    thresholdMode: input.rule.contractStatus === 'v1' ? 'combined_pool' : null,
    settlementStatus: 'NONAUTHORITATIVE',
    reasonCode: 'REVERSIBLE_CONTRACT_INVALID',
    reason: 'The reversible settlement contract is invalid.',
    reversibleClauseId: input.rule.clauseId,
    loadingChildCalculationId:
      input.operations.Loading?.childCalculationId ?? null,
    dischargeChildCalculationId:
      input.operations.Discharge?.childCalculationId ?? null,
    loadingAllowance: input.allowances.Loading,
    dischargeAllowance: input.allowances.Discharge,
    loadingCountableInputSeconds: countableInputSeconds(
      input.operations.Loading,
    ),
    dischargeCountableInputSeconds: countableInputSeconds(
      input.operations.Discharge,
    ),
    loadingDemurrage: input.operations.Loading?.demurrage ?? null,
    dischargeDemurrage: input.operations.Discharge?.demurrage ?? null,
    loadingDespatch: input.operations.Loading?.despatch ?? null,
    dischargeDespatch: input.operations.Discharge?.despatch ?? null,
    combinedAllowedSeconds: null,
    combinedUsedSeconds: 0,
    combinedOverrunSeconds: 0,
    combinedSavedSeconds: 0,
    cargoQuantity: input.cargoQuantity,
    threshold: null,
    timeline: [],
    demurrageRate: null,
    despatchRate: null,
    despatchTimeBasis: null,
    demurrageAmount: 0,
    despatchAmount: 0,
    warnings: [],
  };
}

function withFailure(
  base: ReversibleSettlementResult,
  settlementStatus: ReversibleSettlementStatus,
  reasonCode: ReversibleSettlementReasonCode,
  reason: string,
): ReversibleSettlementResult {
  return {
    ...base,
    settlementStatus,
    reasonCode,
    reason,
    warnings: [...base.warnings, reason],
  };
}

function durationSeconds(
  period: Pick<EnginePeriod, 'startTime' | 'endTime'>,
): number {
  return (period.endTime.getTime() - period.startTime.getTime()) / 1000;
}

function appendSegment(
  target: ReversibleSettlementSegment[],
  operation: ReversibleOperationSettlementInput,
  sourcePeriod: EnginePeriod,
  sourcePeriodIndex: number,
  startTime: Date,
  endTime: Date,
  classification: EnginePeriod['periodType'],
  countedSeconds: number,
  thresholdCrossing: boolean,
  overrideReason: ReversibleSettlementSegment['onceOnDemurrageOverrideReason'],
): void {
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;
  if (duration <= 0) return;

  target.push({
    operation: operation.operation,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    durationSeconds: duration,
    sourceChildCalculationId: operation.childCalculationId,
    sourcePeriodIndex,
    originalClassification: sourcePeriod.periodType,
    classification,
    countedSeconds,
    appliedClauseId: sourcePeriod.appliedClauseId,
    exceptionKind: sourcePeriod.exceptionKind ?? null,
    exceptionKinds: sourcePeriod.exceptionKinds
      ? [...sourcePeriod.exceptionKinds]
      : null,
    thresholdCrossing,
    onceOnDemurrageOverrideReason: overrideReason,
    calendarDates: sourcePeriod.calendarDates
      ? sourcePeriod.calendarDates.map((entry) => ({
          localDate: entry.localDate,
          reasons: [...entry.reasons],
        }))
      : null,
  });
}

function buildCombinedTimeline(
  loading: ReversibleOperationSettlementInput,
  discharge: ReversibleOperationSettlementInput,
  combinedAllowedSeconds: number,
): Pick<
  ReversibleSettlementResult,
  'timeline' | 'threshold' | 'combinedUsedSeconds'
> {
  const timeline: ReversibleSettlementSegment[] = [];
  let cumulativeSeconds = 0;
  let threshold: ReversibleSettlementResult['threshold'] = null;

  for (const operation of [loading, discharge]) {
    for (const [
      sourcePeriodIndex,
      sourcePeriod,
    ] of operation.timeline.entries()) {
      const duration = durationSeconds(sourcePeriod);
      if (duration <= 0) continue;

      if (threshold) {
        appendSegment(
          timeline,
          operation,
          sourcePeriod,
          sourcePeriodIndex,
          sourcePeriod.startTime,
          sourcePeriod.endTime,
          'demurrage',
          duration,
          false,
          sourcePeriod.periodType === 'exception'
            ? 'COMBINED_THRESHOLD_ALREADY_REACHED'
            : null,
        );
        cumulativeSeconds += duration;
        continue;
      }

      if (sourcePeriod.periodType === 'exception') {
        appendSegment(
          timeline,
          operation,
          sourcePeriod,
          sourcePeriodIndex,
          sourcePeriod.startTime,
          sourcePeriod.endTime,
          'exception',
          0,
          false,
          null,
        );
        continue;
      }

      const remaining = Math.max(0, combinedAllowedSeconds - cumulativeSeconds);
      const beforeThresholdSeconds = Math.min(duration, remaining);
      const splitAt = new Date(
        sourcePeriod.startTime.getTime() + beforeThresholdSeconds * 1000,
      );

      if (beforeThresholdSeconds > 0) {
        cumulativeSeconds += beforeThresholdSeconds;
        const crossesAtEnd = cumulativeSeconds === combinedAllowedSeconds;
        appendSegment(
          timeline,
          operation,
          sourcePeriod,
          sourcePeriodIndex,
          sourcePeriod.startTime,
          splitAt,
          'laytime',
          beforeThresholdSeconds,
          crossesAtEnd,
          null,
        );
        if (crossesAtEnd) {
          threshold = {
            operation: operation.operation,
            timestamp: new Date(splitAt),
            cumulativeSeconds,
          };
        }
      }

      const afterThresholdSeconds = duration - beforeThresholdSeconds;
      if (afterThresholdSeconds > 0) {
        threshold ??= {
          operation: operation.operation,
          timestamp: new Date(sourcePeriod.startTime),
          cumulativeSeconds,
        };
        appendSegment(
          timeline,
          operation,
          sourcePeriod,
          sourcePeriodIndex,
          splitAt,
          sourcePeriod.endTime,
          'demurrage',
          afterThresholdSeconds,
          beforeThresholdSeconds === 0,
          null,
        );
        cumulativeSeconds += afterThresholdSeconds;
      }
    }
  }

  return { timeline, threshold, combinedUsedSeconds: cumulativeSeconds };
}

function price(seconds: number, rate: number): number {
  return Math.round((seconds / DAY_SECONDS) * rate * 100) / 100;
}

export function resolveReversibleLaytimeSettlement(
  input: ReversibleSettlementInput,
): ReversibleSettlementResult {
  let result = resultBase(input);

  if (input.rule.contractStatus === 'legacy') {
    return withFailure(
      result,
      'LEGACY',
      'LEGACY_REVERSIBLE_CONTRACT',
      'The enabled reversible clause is legacy and must be explicitly upgraded before V1 settlement can be authoritative.',
    );
  }
  if (input.rule.contractStatus === 'ambiguous') {
    return withFailure(
      result,
      'NONAUTHORITATIVE',
      'REVERSIBLE_CONTRACT_AMBIGUOUS',
      'Multiple active reversible clauses make the settlement contract ambiguous.',
    );
  }
  if (
    input.rule.contractStatus !== 'v1' ||
    input.rule.settlementVersion !== 1 ||
    input.rule.allowanceMode !== 'sum_operation_allowances'
  ) {
    return withFailure(
      result,
      'NONAUTHORITATIVE',
      'REVERSIBLE_CONTRACT_INVALID',
      'The reversible clause does not contain a supported Version 1 settlement contract.',
    );
  }

  const loadingAllowance = input.allowances.Loading;
  const dischargeAllowance = input.allowances.Discharge;
  if (
    !loadingAllowance ||
    !dischargeAllowance ||
    loadingAllowance.source !== 'operation-specific' ||
    dischargeAllowance.source !== 'operation-specific'
  ) {
    return withFailure(
      result,
      'NONAUTHORITATIVE',
      'REVERSIBLE_EXPLICIT_OPERATION_ALLOWANCES_REQUIRED',
      'Version 1 reversible settlement requires explicit Loading and Discharge allowance clauses; global allowance fallback is not duplicated or divided.',
    );
  }

  const combinedAllowedSeconds =
    loadingAllowance.allowedSeconds + dischargeAllowance.allowedSeconds;
  result = { ...result, combinedAllowedSeconds };

  const loading = input.operations.Loading;
  const discharge = input.operations.Discharge;
  if (!loading || !discharge) {
    const knownUsedSeconds = [loading, discharge]
      .filter(
        (operation): operation is ReversibleOperationSettlementInput =>
          operation !== null,
      )
      .flatMap((operation) => operation.timeline)
      .filter((entry) => entry.periodType === 'laytime')
      .reduce((total, entry) => total + durationSeconds(entry), 0);
    return withFailure(
      { ...result, combinedUsedSeconds: knownUsedSeconds },
      'PROVISIONAL',
      'REVERSIBLE_OPERATION_INCOMPLETE',
      'Version 1 reversible settlement remains provisional until both Loading and Discharge operation calculations are complete.',
    );
  }

  const combined = buildCombinedTimeline(
    loading,
    discharge,
    combinedAllowedSeconds,
  );
  const combinedOverrunSeconds = Math.max(
    combined.combinedUsedSeconds - combinedAllowedSeconds,
    0,
  );
  const combinedSavedSeconds = Math.max(
    combinedAllowedSeconds - combined.combinedUsedSeconds,
    0,
  );
  result = {
    ...result,
    ...combined,
    combinedOverrunSeconds,
    combinedSavedSeconds,
  };

  if (combinedOverrunSeconds > 0) {
    const loadingRate = loading.demurrage?.rate ?? null;
    const dischargeRate = discharge.demurrage?.rate ?? null;
    if (
      loadingRate === null ||
      dischargeRate === null ||
      loadingRate !== dischargeRate
    ) {
      return withFailure(
        result,
        'NONAUTHORITATIVE',
        'REVERSIBLE_DEMURRAGE_RATE_MISMATCH',
        'Authoritative Version 1 reversible demurrage requires one identical effective daily rate for Loading and Discharge.',
      );
    }
    return {
      ...result,
      settlementStatus: 'FINAL_AUTHORITATIVE',
      reasonCode: 'SETTLED',
      reason:
        'The completed reversible voyage was settled against the combined allowance and common demurrage rate.',
      demurrageRate: loadingRate,
      demurrageAmount: price(combinedOverrunSeconds, loadingRate),
    };
  }

  if (combinedSavedSeconds > 0) {
    const loadingDespatch = loading.despatch;
    const dischargeDespatch = discharge.despatch;
    if (!loadingDespatch && !dischargeDespatch) {
      return {
        ...result,
        settlementStatus: 'FINAL_AUTHORITATIVE',
        reasonCode: 'DESPATCH_NOT_CONTRACTUALLY_AGREED',
        reason:
          'Time was saved, but neither operation contains a contractual despatch agreement.',
      };
    }
    if (!loadingDespatch || !dischargeDespatch) {
      return withFailure(
        result,
        'NONAUTHORITATIVE',
        'REVERSIBLE_DESPATCH_TERMS_MISMATCH',
        'Loading and Discharge must both contain compatible despatch agreements for authoritative reversible despatch.',
      );
    }
    if (loadingDespatch.timeBasis !== dischargeDespatch.timeBasis) {
      return withFailure(
        result,
        'NONAUTHORITATIVE',
        'REVERSIBLE_DESPATCH_TERMS_MISMATCH',
        'Loading and Discharge despatch time bases differ.',
      );
    }
    if (loadingDespatch.timeBasis === 'all_time_saved') {
      return withFailure(
        { ...result, despatchTimeBasis: 'all_time_saved' },
        'NONAUTHORITATIVE',
        'REVERSIBLE_ALL_TIME_SAVED_UNSUPPORTED_V1',
        'All-time-saved reversible despatch is not authoritative in Settlement Version 1.',
      );
    }
    if (
      loadingDespatch.rate === null ||
      dischargeDespatch.rate === null ||
      loadingDespatch.rate !== dischargeDespatch.rate
    ) {
      return withFailure(
        { ...result, despatchTimeBasis: 'working_time_saved' },
        'NONAUTHORITATIVE',
        'REVERSIBLE_DESPATCH_RATE_MISMATCH',
        'Loading and Discharge effective despatch rates differ or are unavailable.',
      );
    }
    return {
      ...result,
      settlementStatus: 'FINAL_AUTHORITATIVE',
      reasonCode: 'SETTLED',
      reason:
        'The completed reversible voyage was settled using pooled working time saved.',
      despatchRate: loadingDespatch.rate,
      despatchTimeBasis: 'working_time_saved',
      despatchAmount: price(combinedSavedSeconds, loadingDespatch.rate),
    };
  }

  return {
    ...result,
    settlementStatus: 'FINAL_AUTHORITATIVE',
    reasonCode: 'SETTLED',
    reason:
      'The completed reversible voyage exactly consumed the combined allowance.',
  };
}

export function readReversibleSettlementStatus(
  decisionSnapshot: Record<string, unknown> | null | undefined,
): ReversibleSettlementStatus | null {
  const settlement = decisionSnapshot?.reversibleSettlement;
  if (
    !settlement ||
    typeof settlement !== 'object' ||
    Array.isArray(settlement)
  ) {
    return null;
  }
  const status = (settlement as Record<string, unknown>).settlementStatus;
  return (REVERSIBLE_SETTLEMENT_STATUSES as readonly unknown[]).includes(status)
    ? (status as ReversibleSettlementStatus)
    : null;
}
