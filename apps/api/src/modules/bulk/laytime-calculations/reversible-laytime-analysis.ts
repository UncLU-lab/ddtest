import { type LaytimeOperation } from '../entities/voyage.entity';

export type ReversibleLaytimeChildResult = {
  operation: Exclude<LaytimeOperation, null>;
  allowedSeconds: number;
  usedSeconds: number;
};

export type ReversibleLaytimeOperationAnalysis = {
  allowedSeconds: number;
  usedSeconds: number;
  surplusSeconds: number;
  overrunSeconds: number;
};

export type ReversibleLaytimePoolAnalysis = {
  totalAllowedSeconds: number;
  totalUsedSeconds: number;
  totalSurplusBeforeTransferSeconds: number;
  totalOverrunBeforeTransferSeconds: number;
  loadingSurplusAvailableToOffsetDischargeOverrunSeconds: number;
  dischargeSurplusAvailableToOffsetLoadingOverrunSeconds: number;
  transferableSurplusSeconds: number;
  netPooledOverrunSeconds: number;
  netPooledSurplusSeconds: number;
};

export type ReversibleLaytimeRuleEvidence = {
  clauseId: string | null;
  clauseType: 'reversible_laytime';
  enabled: boolean | null;
  contractStatus:
    | 'absent'
    | 'disabled'
    | 'legacy'
    | 'v1'
    | 'invalid'
    | 'ambiguous';
  settlementVersion: 1 | null;
  allowanceMode: 'sum_operation_allowances' | null;
  clauseParameters: Record<string, unknown> | null;
  rawText: string | null;
  conflictingClauseIds: string[];
  warnings: string[];
};

export type ReversibleLaytimeAnalysis = {
  status: 'available' | 'not-available';
  reason: string;
  mode: 'audit-only' | 'contract-enabled';
  contractRuleApplied: boolean;
  loading: ReversibleLaytimeOperationAnalysis | null;
  discharge: ReversibleLaytimeOperationAnalysis | null;
  pool: ReversibleLaytimePoolAnalysis | null;
};

function summarizeChild(
  child: ReversibleLaytimeChildResult,
): ReversibleLaytimeOperationAnalysis {
  const allowedSeconds = Math.max(0, child.allowedSeconds);
  const usedSeconds = Math.max(0, child.usedSeconds);

  return {
    allowedSeconds,
    usedSeconds,
    surplusSeconds: Math.max(allowedSeconds - usedSeconds, 0),
    overrunSeconds: Math.max(usedSeconds - allowedSeconds, 0),
  };
}

export function resolveReversibleLaytimeRule(
  clauses: Array<{
    id: string;
    clauseType: string;
    rawText?: string | null;
    parameters: Record<string, unknown>;
  }>,
): ReversibleLaytimeRuleEvidence {
  const reversibleClauses = clauses.filter(
    (clause) => clause.clauseType === 'reversible_laytime',
  );

  const warnings: string[] = [];
  const activeClauses = reversibleClauses.filter(
    (candidate) => candidate.parameters.enabled === true,
  );
  const ambiguous = activeClauses.length > 1;
  if (ambiguous) {
    warnings.push(
      'Multiple active "reversible_laytime" clauses found; no authoritative settlement contract was selected.',
    );
  }

  const clause = ambiguous
    ? undefined
    : activeClauses[0] ?? reversibleClauses[0];
  const enabled =
    clause && typeof clause.parameters.enabled === 'boolean'
      ? clause.parameters.enabled
      : clause
        ? null
        : null;

  const hasV1Fields =
    clause?.parameters.settlementVersion !== undefined ||
    clause?.parameters.allowanceMode !== undefined;
  const validV1 =
    clause?.parameters.settlementVersion === 1 &&
    clause?.parameters.allowanceMode === 'sum_operation_allowances';
  const contractStatus: ReversibleLaytimeRuleEvidence['contractStatus'] =
    ambiguous
      ? 'ambiguous'
      : !clause
        ? 'absent'
        : enabled === false
          ? 'disabled'
          : enabled !== true
            ? 'invalid'
            : validV1
              ? 'v1'
              : hasV1Fields
                ? 'invalid'
                : 'legacy';

  return {
    clauseId: clause?.id ?? null,
    clauseType: 'reversible_laytime',
    enabled,
    contractStatus,
    settlementVersion: validV1 ? 1 : null,
    allowanceMode: validV1 ? 'sum_operation_allowances' : null,
    clauseParameters: clause ? { ...clause.parameters } : null,
    rawText: clause?.rawText ?? null,
    conflictingClauseIds: ambiguous
      ? activeClauses.map((candidate) => candidate.id)
      : [],
    warnings,
  };
}

export function analyzeReversibleLaytime(
  loadingChild?: ReversibleLaytimeChildResult | null,
  dischargeChild?: ReversibleLaytimeChildResult | null,
  contractEnabled = false,
): ReversibleLaytimeAnalysis {
  const loading = loadingChild ? summarizeChild(loadingChild) : null;
  const discharge = dischargeChild ? summarizeChild(dischargeChild) : null;

  if (!loading || !discharge) {
    const missingOperations = [
      !loading ? 'Loading' : null,
      !discharge ? 'Discharge' : null,
    ].filter(
      (operation): operation is Exclude<LaytimeOperation, null> =>
        operation !== null,
    );

    return {
      status: 'not-available',
      reason:
        missingOperations.length === 2
          ? 'Reversible laytime analysis is unavailable because both Loading and Discharge child results are missing.'
          : `Reversible laytime analysis is unavailable because the ${missingOperations[0]} child result is missing.`,
      mode: 'audit-only',
      contractRuleApplied: false,
      loading,
      discharge,
      pool: null,
    };
  }

  const totalAllowedSeconds = loading.allowedSeconds + discharge.allowedSeconds;
  const totalUsedSeconds = loading.usedSeconds + discharge.usedSeconds;
  const totalSurplusBeforeTransferSeconds =
    loading.surplusSeconds + discharge.surplusSeconds;
  const totalOverrunBeforeTransferSeconds =
    loading.overrunSeconds + discharge.overrunSeconds;
  const loadingSurplusAvailableToOffsetDischargeOverrunSeconds = Math.min(
    loading.surplusSeconds,
    discharge.overrunSeconds,
  );
  const dischargeSurplusAvailableToOffsetLoadingOverrunSeconds = Math.min(
    discharge.surplusSeconds,
    loading.overrunSeconds,
  );
  const transferableSurplusSeconds =
    loadingSurplusAvailableToOffsetDischargeOverrunSeconds +
    dischargeSurplusAvailableToOffsetLoadingOverrunSeconds;
  const netPooledOverrunSeconds = Math.max(
    totalUsedSeconds - totalAllowedSeconds,
    0,
  );
  const netPooledSurplusSeconds = Math.max(
    totalAllowedSeconds - totalUsedSeconds,
    0,
  );

  return {
    status: 'available',
    reason: contractEnabled
      ? 'Reversible laytime is enabled by the persisted Charter Party rule and both child results are available.'
      : 'Reversible laytime is available for audit only because the persisted Charter Party rule is absent or disabled.',
    mode: contractEnabled ? 'contract-enabled' : 'audit-only',
    contractRuleApplied: contractEnabled,
    loading,
    discharge,
    pool: {
      totalAllowedSeconds,
      totalUsedSeconds,
      totalSurplusBeforeTransferSeconds,
      totalOverrunBeforeTransferSeconds,
      loadingSurplusAvailableToOffsetDischargeOverrunSeconds,
      dischargeSurplusAvailableToOffsetLoadingOverrunSeconds,
      transferableSurplusSeconds,
      netPooledOverrunSeconds,
      netPooledSurplusSeconds,
    },
  };
}
