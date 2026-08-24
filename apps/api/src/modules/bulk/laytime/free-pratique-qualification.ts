import { type FreePratiqueEvidenceSelection } from './free-pratique-evidence';

export interface SelectedWifponClause {
  id: string;
  clauseType: 'wifpon';
  parameters: Record<string, unknown>;
}

export interface FreePratiqueQualificationResult {
  valid: boolean | null;
  status:
    | 'granted-before-nor'
    | 'granted-after-nor'
    | 'waived-by-wifpon'
    | 'unavailable';
  grantedTime: Date | null;
  freePratiqueEventId: string | null;
  wifponClauseId: string | null;
  wifponEnabled: boolean;
  wifponApplied: boolean;
  warnings: string[];
}

const MISSING_QUALIFICATION_WARNING =
  'Free-pratique qualification was not evaluated because grant evidence and an applicable WIFPON clause are missing.';
const DISABLED_WITHOUT_EVIDENCE_WARNING =
  'Free-pratique qualification was not evaluated because WIFPON is disabled and free-pratique grant evidence is missing.';

/** Qualifies one NOR tender using already-selected evidence and WIFPON terms. */
export function resolveFreePratiqueQualification(input: {
  tenderTime: Date;
  freePratiqueEvidence: FreePratiqueEvidenceSelection;
  wifponClause: SelectedWifponClause | null;
}): FreePratiqueQualificationResult {
  const grantedTime = input.freePratiqueEvidence.grantedTime
    ? new Date(input.freePratiqueEvidence.grantedTime)
    : null;
  const wifponEnabled = input.wifponClause?.parameters.enabled === true;
  const warnings = [...input.freePratiqueEvidence.warnings];
  const common = {
    grantedTime,
    freePratiqueEventId: input.freePratiqueEvidence.selectedEventId,
    wifponClauseId: input.wifponClause?.id ?? null,
    wifponEnabled,
    warnings,
  };

  if (grantedTime && grantedTime.getTime() <= input.tenderTime.getTime()) {
    return {
      ...common,
      valid: true,
      status: 'granted-before-nor',
      wifponApplied: false,
    };
  }

  if (wifponEnabled) {
    return {
      ...common,
      valid: true,
      status: 'waived-by-wifpon',
      wifponApplied: true,
    };
  }

  if (grantedTime) {
    return {
      ...common,
      valid: false,
      status: 'granted-after-nor',
      wifponApplied: false,
    };
  }

  warnings.push(
    input.wifponClause
      ? DISABLED_WITHOUT_EVIDENCE_WARNING
      : MISSING_QUALIFICATION_WARNING,
  );
  return {
    ...common,
    valid: null,
    status: 'unavailable',
    wifponApplied: false,
  };
}
