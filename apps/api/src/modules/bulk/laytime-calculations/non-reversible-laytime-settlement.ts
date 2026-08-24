import type { LaytimeOperationScope } from '../entities/charter-party.entity';
import type { SettlementCurrency } from '../currency/settlement-currency';
import type { LaytimeSettlementAuthorityStatus } from './laytime-settlement-authority';

export const NON_REVERSIBLE_SETTLEMENT_VERSION = 1 as const;
export const NON_REVERSIBLE_SETTLEMENT_MODE =
  'separate_operation_results' as const;

export type SettledOperation = 'Loading' | 'Discharge';
export type NonReversibleBalanceType = 'DEMURRAGE' | 'DESPATCH' | 'BALANCED';

export type NonReversibleChildInput = {
  operation: SettledOperation;
  childCalculationId: string;
  allowedSeconds: number;
  usedSeconds: number;
  demurrageAmount: number;
  despatchAmount: number;
  despatchBasis: 'all_time_saved' | 'working_time_saved' | null;
  clauseIds: string[];
  currency: SettlementCurrency | null;
};

export type NonReversibleOperationSummary = NonReversibleChildInput & {
  calculationComplete: true;
  childLifecycle: 'Draft';
  childVersion: number | null;
  balanceType: NonReversibleBalanceType;
  savedSeconds: number;
  excessSeconds: number;
  authorityStatus: 'PROVISIONAL';
  claimEligibility: {
    eligible: false;
    reasonCode:
      | 'LAYTIME_CALCULATION_CURRENCY_REQUIRED'
      | 'LAYTIME_OPERATION_CLAIM_LINK_REQUIRED';
  };
};

export type NonReversibleSettlementResult = {
  version: 1;
  settlementMode: 'separate_operation_results';
  expectedOperationScope: LaytimeOperationScope | null;
  expectedOperations: SettledOperation[];
  settlementStatus: LaytimeSettlementAuthorityStatus;
  reasonCode:
    | 'NON_REVERSIBLE_SETTLEMENT_READY_FOR_FINALIZATION'
    | 'NON_REVERSIBLE_EXPECTED_OPERATION_SCOPE_REQUIRED'
    | 'NON_REVERSIBLE_EXPECTED_OPERATION_INCOMPLETE'
    | 'CURRENCY_AUTHORITY_REQUIRED'
    | 'CURRENCY_MISMATCH';
  finalizationEligible: boolean;
  operations: Partial<Record<SettledOperation, NonReversibleOperationSummary>>;
  missingOperations: SettledOperation[];
  ignoredUnexpectedChildIds: string[];
  monetaryAggregation: {
    status: 'AVAILABLE' | 'CURRENCY_AUTHORITY_REQUIRED' | 'CURRENCY_MISMATCH';
    currency: SettlementCurrency | null;
    grossDemurrage: number | null;
    grossDespatch: number | null;
    netExposure: number | null;
    netDirection: 'NET_PAYABLE' | 'NET_RECEIVABLE' | 'BALANCED' | null;
    legalNetting: false;
    claimableAsAggregate: false;
  };
  finalizationBlockers: string[];
  warnings: string[];
  parentVersion: number | null;
};

export function resolveExpectedLaytimeOperations(
  scope: LaytimeOperationScope | null | undefined,
): SettledOperation[] {
  if (scope === 'Loading') return ['Loading'];
  if (scope === 'Discharge') return ['Discharge'];
  if (scope === 'LoadingAndDischarge') return ['Loading', 'Discharge'];
  return [];
}

function summarizeChild(
  child: NonReversibleChildInput,
): NonReversibleOperationSummary {
  const savedSeconds = Math.max(child.allowedSeconds - child.usedSeconds, 0);
  const excessSeconds = Math.max(child.usedSeconds - child.allowedSeconds, 0);
  const balanceType: NonReversibleBalanceType =
    excessSeconds > 0
      ? 'DEMURRAGE'
      : savedSeconds > 0
        ? 'DESPATCH'
        : 'BALANCED';

  return {
    ...child,
    clauseIds: [...child.clauseIds],
    calculationComplete: true,
    childLifecycle: 'Draft',
    childVersion: null,
    balanceType,
    savedSeconds,
    excessSeconds,
    authorityStatus: 'PROVISIONAL',
    claimEligibility: {
      eligible: false,
      reasonCode: child.currency
        ? 'LAYTIME_OPERATION_CLAIM_LINK_REQUIRED'
        : 'LAYTIME_CALCULATION_CURRENCY_REQUIRED',
    },
  };
}

export function resolveNonReversibleSettlement(input: {
  expectedOperationScope: LaytimeOperationScope | null | undefined;
  settlementCurrency: SettlementCurrency | null;
  children: NonReversibleChildInput[];
}): NonReversibleSettlementResult {
  const expectedOperationScope = input.expectedOperationScope ?? null;
  const expectedOperations = resolveExpectedLaytimeOperations(
    expectedOperationScope,
  );
  const childByOperation = new Map(
    input.children.map((child) => [child.operation, child]),
  );
  const operations: NonReversibleSettlementResult['operations'] = {};
  const missingOperations: SettledOperation[] = [];

  for (const operation of expectedOperations) {
    const child = childByOperation.get(operation);
    if (child) operations[operation] = summarizeChild(child);
    else missingOperations.push(operation);
  }

  const expectedSet = new Set(expectedOperations);
  const ignoredUnexpectedChildIds = input.children
    .filter((child) => !expectedSet.has(child.operation))
    .map((child) => child.childCalculationId);
  const scopeMissing = expectedOperations.length === 0;
  const currencyMissing = input.settlementCurrency === null;
  const currencyMismatch = expectedOperations.some(
    (operation) => {
      const child = childByOperation.get(operation);
      return Boolean(child) && child?.currency !== input.settlementCurrency;
    },
  );
  const finalizationEligible =
    !scopeMissing &&
    missingOperations.length === 0 &&
    !currencyMissing &&
    !currencyMismatch;
  const reasonCode = scopeMissing
    ? 'NON_REVERSIBLE_EXPECTED_OPERATION_SCOPE_REQUIRED'
    : missingOperations.length > 0
      ? 'NON_REVERSIBLE_EXPECTED_OPERATION_INCOMPLETE'
      : currencyMissing
        ? 'CURRENCY_AUTHORITY_REQUIRED'
        : currencyMismatch
          ? 'CURRENCY_MISMATCH'
          : 'NON_REVERSIBLE_SETTLEMENT_READY_FOR_FINALIZATION';
  const finalizationBlockers = scopeMissing
    ? ['Expected laytime operation scope is not configured.']
    : missingOperations.length > 0
      ? missingOperations.map(
        (operation) =>
          `${operation} child calculation is missing or incomplete.`,
        )
      : currencyMissing
        ? ['Charter Party settlement currency is not configured.']
        : currencyMismatch
          ? ['Expected child calculation currency does not match the parent currency.']
          : [];
  const expectedSummaries = expectedOperations
    .map((operation) => operations[operation])
    .filter((summary): summary is NonReversibleOperationSummary =>
      Boolean(summary),
    );
  const roundMoney = (value: number) => Math.round(value * 100) / 100;
  const grossDemurrage = finalizationEligible
    ? roundMoney(
        expectedSummaries.reduce(
          (total, entry) => total + entry.demurrageAmount,
          0,
        ),
      )
    : null;
  const grossDespatch = finalizationEligible
    ? roundMoney(
        expectedSummaries.reduce(
          (total, entry) => total + entry.despatchAmount,
          0,
        ),
      )
    : null;
  const netExposure =
    grossDemurrage !== null && grossDespatch !== null
      ? roundMoney(grossDemurrage - grossDespatch)
      : null;
  const netDirection =
    netExposure === null
      ? null
      : netExposure > 0
        ? 'NET_PAYABLE'
        : netExposure < 0
          ? 'NET_RECEIVABLE'
          : 'BALANCED';

  return {
    version: NON_REVERSIBLE_SETTLEMENT_VERSION,
    settlementMode: NON_REVERSIBLE_SETTLEMENT_MODE,
    expectedOperationScope,
    expectedOperations,
    settlementStatus:
      scopeMissing || currencyMissing || currencyMismatch
        ? 'NONAUTHORITATIVE'
        : 'PROVISIONAL',
    reasonCode,
    finalizationEligible,
    operations,
    missingOperations,
    ignoredUnexpectedChildIds,
    monetaryAggregation: {
      status: currencyMissing
        ? 'CURRENCY_AUTHORITY_REQUIRED'
        : currencyMismatch
          ? 'CURRENCY_MISMATCH'
          : 'AVAILABLE',
      currency: input.settlementCurrency,
      grossDemurrage,
      grossDespatch,
      netExposure,
      netDirection,
      legalNetting: false,
      claimableAsAggregate: false,
    },
    finalizationBlockers,
    warnings: [
      'Loading and Discharge operation results remain independent; no time or money is transferred between operations.',
      input.settlementCurrency
        ? 'Voyage monetary totals are informational summaries and are not aggregate claim amounts.'
        : 'Authoritative voyage monetary aggregation requires a persisted calculation currency.',
    ],
    parentVersion: null,
  };
}
