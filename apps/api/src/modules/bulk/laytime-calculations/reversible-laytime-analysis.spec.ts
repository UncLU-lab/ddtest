import {
  analyzeReversibleLaytime,
  resolveReversibleLaytimeRule,
} from './reversible-laytime-analysis';

const HOUR = 3600;

function child(operation: 'Loading' | 'Discharge', allowedHours: number, usedHours: number) {
  return {
    operation,
    allowedSeconds: allowedHours * HOUR,
    usedSeconds: usedHours * HOUR,
  } as const;
}

describe('analyzeReversibleLaytime', () => {
  it.each([
    {
      name: 'Loading surplus offsets Discharge overrun',
      loading: child('Loading', 48, 24),
      discharge: child('Discharge', 48, 60),
      expected: {
        status: 'available' as const,
        loading: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 24 * HOUR,
          surplusSeconds: 24 * HOUR,
          overrunSeconds: 0,
        },
        discharge: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 60 * HOUR,
          surplusSeconds: 0,
          overrunSeconds: 12 * HOUR,
        },
        pool: {
          totalAllowedSeconds: 96 * HOUR,
          totalUsedSeconds: 84 * HOUR,
          totalSurplusBeforeTransferSeconds: 24 * HOUR,
          totalOverrunBeforeTransferSeconds: 12 * HOUR,
          loadingSurplusAvailableToOffsetDischargeOverrunSeconds: 12 * HOUR,
          dischargeSurplusAvailableToOffsetLoadingOverrunSeconds: 0,
          transferableSurplusSeconds: 12 * HOUR,
          netPooledOverrunSeconds: 0,
          netPooledSurplusSeconds: 12 * HOUR,
        },
      },
    },
    {
      name: 'Discharge surplus offsets Loading overrun',
      loading: child('Loading', 48, 60),
      discharge: child('Discharge', 48, 24),
      expected: {
        status: 'available' as const,
        loading: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 60 * HOUR,
          surplusSeconds: 0,
          overrunSeconds: 12 * HOUR,
        },
        discharge: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 24 * HOUR,
          surplusSeconds: 24 * HOUR,
          overrunSeconds: 0,
        },
        pool: {
          totalAllowedSeconds: 96 * HOUR,
          totalUsedSeconds: 84 * HOUR,
          totalSurplusBeforeTransferSeconds: 24 * HOUR,
          totalOverrunBeforeTransferSeconds: 12 * HOUR,
          loadingSurplusAvailableToOffsetDischargeOverrunSeconds: 0,
          dischargeSurplusAvailableToOffsetLoadingOverrunSeconds: 12 * HOUR,
          transferableSurplusSeconds: 12 * HOUR,
          netPooledOverrunSeconds: 0,
          netPooledSurplusSeconds: 12 * HOUR,
        },
      },
    },
    {
      name: 'Both operations overrun',
      loading: child('Loading', 48, 60),
      discharge: child('Discharge', 48, 72),
      expected: {
        status: 'available' as const,
        loading: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 60 * HOUR,
          surplusSeconds: 0,
          overrunSeconds: 12 * HOUR,
        },
        discharge: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 72 * HOUR,
          surplusSeconds: 0,
          overrunSeconds: 24 * HOUR,
        },
        pool: {
          totalAllowedSeconds: 96 * HOUR,
          totalUsedSeconds: 132 * HOUR,
          totalSurplusBeforeTransferSeconds: 0,
          totalOverrunBeforeTransferSeconds: 36 * HOUR,
          loadingSurplusAvailableToOffsetDischargeOverrunSeconds: 0,
          dischargeSurplusAvailableToOffsetLoadingOverrunSeconds: 0,
          transferableSurplusSeconds: 0,
          netPooledOverrunSeconds: 36 * HOUR,
          netPooledSurplusSeconds: 0,
        },
      },
    },
    {
      name: 'Both operations have surplus',
      loading: child('Loading', 60, 48),
      discharge: child('Discharge', 72, 24),
      expected: {
        status: 'available' as const,
        loading: {
          allowedSeconds: 60 * HOUR,
          usedSeconds: 48 * HOUR,
          surplusSeconds: 12 * HOUR,
          overrunSeconds: 0,
        },
        discharge: {
          allowedSeconds: 72 * HOUR,
          usedSeconds: 24 * HOUR,
          surplusSeconds: 48 * HOUR,
          overrunSeconds: 0,
        },
        pool: {
          totalAllowedSeconds: 132 * HOUR,
          totalUsedSeconds: 72 * HOUR,
          totalSurplusBeforeTransferSeconds: 60 * HOUR,
          totalOverrunBeforeTransferSeconds: 0,
          loadingSurplusAvailableToOffsetDischargeOverrunSeconds: 0,
          dischargeSurplusAvailableToOffsetLoadingOverrunSeconds: 0,
          transferableSurplusSeconds: 0,
          netPooledOverrunSeconds: 0,
          netPooledSurplusSeconds: 60 * HOUR,
        },
      },
    },
    {
      name: 'Exact pooled balance',
      loading: child('Loading', 48, 60),
      discharge: child('Discharge', 60, 48),
      expected: {
        status: 'available' as const,
        loading: {
          allowedSeconds: 48 * HOUR,
          usedSeconds: 60 * HOUR,
          surplusSeconds: 0,
          overrunSeconds: 12 * HOUR,
        },
        discharge: {
          allowedSeconds: 60 * HOUR,
          usedSeconds: 48 * HOUR,
          surplusSeconds: 12 * HOUR,
          overrunSeconds: 0,
        },
        pool: {
          totalAllowedSeconds: 108 * HOUR,
          totalUsedSeconds: 108 * HOUR,
          totalSurplusBeforeTransferSeconds: 12 * HOUR,
          totalOverrunBeforeTransferSeconds: 12 * HOUR,
          loadingSurplusAvailableToOffsetDischargeOverrunSeconds: 0,
          dischargeSurplusAvailableToOffsetLoadingOverrunSeconds: 12 * HOUR,
          transferableSurplusSeconds: 12 * HOUR,
          netPooledOverrunSeconds: 0,
          netPooledSurplusSeconds: 0,
        },
      },
    },
  ])('$name', ({ loading, discharge, expected }) => {
    expect(analyzeReversibleLaytime(loading, discharge)).toEqual(
      expect.objectContaining({
        status: expected.status,
        reason: expect.any(String),
        mode: 'audit-only',
        contractRuleApplied: false,
        loading: expect.objectContaining(expected.loading),
        discharge: expect.objectContaining(expected.discharge),
        pool: expect.objectContaining(expected.pool),
      }),
    );
  });

  it('is not available when one child is missing', () => {
    expect(analyzeReversibleLaytime(child('Loading', 48, 24), null)).toEqual(
      expect.objectContaining({
        status: 'not-available',
        reason: expect.stringContaining('Discharge'),
        mode: 'audit-only',
        contractRuleApplied: false,
        loading: expect.objectContaining({
          allowedSeconds: 48 * HOUR,
          usedSeconds: 24 * HOUR,
        }),
        discharge: null,
        pool: null,
      }),
    );
  });

  it('marks the analysis as contract-enabled when the reversible rule is enabled', () => {
    expect(
      analyzeReversibleLaytime(
        child('Loading', 48, 24),
        child('Discharge', 48, 60),
        true,
      ),
    ).toEqual(
      expect.objectContaining({
        status: 'available',
        mode: 'contract-enabled',
        contractRuleApplied: true,
        reason: expect.stringContaining('enabled'),
      }),
    );
  });
});

describe('resolveReversibleLaytimeRule', () => {
  it('selects the first reversible clause and warns on duplicates', () => {
    expect(
      resolveReversibleLaytimeRule([
        {
          id: 'reversible-1',
          clauseType: 'reversible_laytime',
          rawText: 'Reversible laytime enabled',
          parameters: { enabled: false },
        },
        {
          id: 'reversible-2',
          clauseType: 'reversible_laytime',
          rawText: 'Reversible laytime enabled again',
          parameters: { enabled: true },
        },
      ]),
    ).toEqual(
      expect.objectContaining({
        clauseId: 'reversible-1',
        clauseType: 'reversible_laytime',
        enabled: false,
        clauseParameters: { enabled: false },
        rawText: 'Reversible laytime enabled',
        warnings: ['Multiple "reversible_laytime" clauses found; the first one was used.'],
      }),
    );
  });

  it('returns empty evidence when no reversible clause exists', () => {
    expect(
      resolveReversibleLaytimeRule([
        {
          id: 'global-laytime',
          clauseType: 'laytime_rate',
          parameters: { hours: 48 },
        },
      ]),
    ).toEqual(
      expect.objectContaining({
        clauseId: null,
        clauseType: 'reversible_laytime',
        enabled: null,
        clauseParameters: null,
        rawText: null,
        warnings: [],
      }),
    );
  });
});
