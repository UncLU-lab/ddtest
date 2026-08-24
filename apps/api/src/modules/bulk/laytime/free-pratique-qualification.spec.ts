import { type FreePratiqueEvidenceSelection } from './free-pratique-evidence';
import {
  resolveFreePratiqueQualification,
  type SelectedWifponClause,
} from './free-pratique-qualification';

const TENDER_TIME = new Date('2026-03-04T08:00:00Z');

function evidence(
  grantedTime: string | null,
  selectedEventId = grantedTime ? 'free-pratique-event' : null,
): FreePratiqueEvidenceSelection {
  return {
    selectedEventId,
    grantedTime: grantedTime ? new Date(grantedTime) : null,
    source: grantedTime ? 'operation-specific' : 'missing',
    candidateEventIds: selectedEventId ? [selectedEventId] : [],
    excludedOppositeOperationEventIds: [],
    duplicateEventIds: [],
    warnings: [],
  };
}

function wifpon(
  enabled: boolean,
  parameters: Record<string, unknown> = {},
): SelectedWifponClause {
  return {
    id: 'wifpon-clause',
    clauseType: 'wifpon',
    parameters: { enabled, ...parameters },
  };
}

describe('resolveFreePratiqueQualification', () => {
  it('accepts a grant before NOR without WIFPON', () => {
    expect(
      resolveFreePratiqueQualification({
        tenderTime: TENDER_TIME,
        freePratiqueEvidence: evidence('2026-03-04T07:00:00Z'),
        wifponClause: null,
      }),
    ).toEqual(
      expect.objectContaining({
        valid: true,
        status: 'granted-before-nor',
        wifponEnabled: false,
        wifponApplied: false,
      }),
    );
  });

  it('accepts a grant exactly at NOR', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence('2026-03-04T08:00:00Z'),
      wifponClause: null,
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe('granted-before-nor');
  });

  it('rejects a grant after NOR without WIFPON', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence('2026-03-04T09:00:00Z'),
      wifponClause: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        status: 'granted-after-nor',
        wifponApplied: false,
      }),
    );
  });

  it('waives a late grant when WIFPON is enabled', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence('2026-03-04T09:00:00Z'),
      wifponClause: wifpon(true),
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        status: 'waived-by-wifpon',
        wifponEnabled: true,
        wifponApplied: true,
        grantedTime: new Date('2026-03-04T09:00:00Z'),
      }),
    );
  });

  it('waives missing evidence without manufacturing a timestamp when WIFPON is enabled', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence(null),
      wifponClause: wifpon(true),
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        status: 'waived-by-wifpon',
        grantedTime: null,
        wifponApplied: true,
      }),
    );
  });

  it('returns the backward-compatible unavailable state with no evidence or WIFPON', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence(null),
      wifponClause: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: null,
        status: 'unavailable',
        wifponClauseId: null,
        wifponEnabled: false,
        wifponApplied: false,
        warnings: [
          'Free-pratique qualification was not evaluated because grant evidence and an applicable WIFPON clause are missing.',
        ],
      }),
    );
  });

  it('records enabled WIFPON as unnecessary when grant precedes NOR', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence('2026-03-04T07:00:00Z'),
      wifponClause: wifpon(true),
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        status: 'granted-before-nor',
        wifponEnabled: true,
        wifponApplied: false,
      }),
    );
  });

  it('rejects a late grant when WIFPON is explicitly disabled', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence('2026-03-04T09:00:00Z'),
      wifponClause: wifpon(false),
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        status: 'granted-after-nor',
        wifponClauseId: 'wifpon-clause',
        wifponEnabled: false,
        wifponApplied: false,
      }),
    );
  });

  it('does not infer invalidity when WIFPON is disabled and grant evidence is missing', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence(null),
      wifponClause: wifpon(false),
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: null,
        status: 'unavailable',
        wifponEnabled: false,
        wifponApplied: false,
        warnings: [
          'Free-pratique qualification was not evaluated because WIFPON is disabled and free-pratique grant evidence is missing.',
        ],
      }),
    );
  });

  it('retains event, grant, and WIFPON clause evidence', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence(
        '2026-03-04T07:15:30.250Z',
        'grant-event-id',
      ),
      wifponClause: wifpon(false),
    });

    expect(result.freePratiqueEventId).toBe('grant-event-id');
    expect(result.grantedTime).toEqual(
      new Date('2026-03-04T07:15:30.250Z'),
    );
    expect(result.wifponClauseId).toBe('wifpon-clause');
  });

  it('ignores unrelated parameters on the selected WIFPON clause', () => {
    const result = resolveFreePratiqueQualification({
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence(null),
      wifponClause: wifpon(true, {
        operation: 'Loading',
        unrelated: 'ignored',
      }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        status: 'waived-by-wifpon',
        wifponApplied: true,
      }),
    );
  });

  it('does not mutate inputs and clones the returned grant Date', () => {
    const tenderTime = new Date(TENDER_TIME);
    const selectedEvidence = evidence('2026-03-04T07:00:00Z');
    const clause = wifpon(true, { operation: 'Loading' });
    const evidenceTime = selectedEvidence.grantedTime;
    const originalClause = structuredClone(clause);

    const result = resolveFreePratiqueQualification({
      tenderTime,
      freePratiqueEvidence: selectedEvidence,
      wifponClause: clause,
    });

    expect(tenderTime).toEqual(TENDER_TIME);
    expect(selectedEvidence.grantedTime).toBe(evidenceTime);
    expect(clause).toEqual(originalClause);
    expect(result.grantedTime).not.toBe(evidenceTime);
    expect(result.grantedTime).toEqual(evidenceTime);
  });

  it('is deterministic across repeated calls', () => {
    const input = {
      tenderTime: TENDER_TIME,
      freePratiqueEvidence: evidence('2026-03-04T09:00:00Z'),
      wifponClause: wifpon(true),
    };

    expect(resolveFreePratiqueQualification(input)).toEqual(
      resolveFreePratiqueQualification(input),
    );
  });
});
