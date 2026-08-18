import {
  COMMERCIAL_CLAUSE_OPERATIONS,
  normalizeCommercialTermsToClauses,
  parseNoticeHours,
  resolveClausesForOperation,
  SUPPORTED_COMMERCIAL_CLAUSE_TYPES,
} from './charter-party-terms';
import { type EngineClause } from './laytime/laytime.types';

function clause(
  id: string,
  clauseType: string,
  parameters: Record<string, unknown>,
): EngineClause {
  return { id, clauseType, parameters };
}

describe('normalizeCommercialTermsToClauses', () => {
  it('produces the same normalized clause shape for persisted commercial terms', () => {
    expect(
      normalizeCommercialTermsToClauses({
        id: 'charter-party-1',
        laytimeAllowed: 72,
        demurrageRate: '25000.00',
        dispatchRate: '12500.00',
        timeCountingBasis: 'SHEX',
        norNoticePeriod: '12 hours',
      }),
    ).toEqual([
      {
        id: 'charter-party-1:laytime_rate',
        clauseType: 'laytime_rate',
        rawText: 'Laytime allowed: 72h\nNOR notice: 12 hours',
        parameters: { hours: 72, noticeHours: 12 },
      },
      {
        id: 'charter-party-1:demurrage_rate',
        clauseType: 'demurrage_rate',
        rawText: 'Demurrage: $25,000/day',
        parameters: { rate: 25000 },
      },
      {
        id: 'charter-party-1:despatch',
        clauseType: 'despatch',
        rawText: 'Dispatch: $12,500/day',
        parameters: { rate: 12500 },
      },
      {
        id: 'charter-party-1:shex_shinc',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHEX',
        parameters: { shex: true },
      },
    ]);
  });

  it('emits an explicit SHINC clause when the basis is SHINC', () => {
    expect(
      normalizeCommercialTermsToClauses({
        id: 'charter-party-2',
        timeCountingBasis: 'SHINC',
      }),
    ).toEqual([
      {
        id: 'charter-party-2:shex_shinc',
        clauseType: 'shex_shinc',
        rawText: 'Time counting basis: SHINC',
        parameters: { shex: false },
      },
    ]);
  });

  it('keeps NOR notice parsing unchanged', () => {
    expect(parseNoticeHours('12 hours')).toBe(12);
    expect(parseNoticeHours('Immediate')).toBe(0);
    expect(parseNoticeHours('n/a')).toBeUndefined();
  });
});

describe('supported commercial clause types', () => {
  it('includes reversible_laytime as an explicit supported clause type', () => {
    expect(SUPPORTED_COMMERCIAL_CLAUSE_TYPES).toContain('reversible_laytime');
  });

  it('includes atutc as an explicit supported clause type', () => {
    expect(SUPPORTED_COMMERCIAL_CLAUSE_TYPES).toContain('atutc');
  });
});

describe('resolveClausesForOperation', () => {
  it.each(COMMERCIAL_CLAUSE_OPERATIONS)(
    'selects operation-specific laytime_rate clauses for %s',
    (operation) => {
      const selected = resolveClausesForOperation(
        [
          clause('global-laytime', 'laytime_rate', { hours: 72 }),
          clause(`${operation.toLowerCase()}-laytime`, 'laytime_rate', {
            hours: operation === 'Loading' ? 48 : 54,
            operation,
          }),
        ],
        operation,
      );

      expect(selected).toEqual([
        expect.objectContaining({
          id: `${operation.toLowerCase()}-laytime`,
          clauseType: 'laytime_rate',
        }),
      ]);
    },
  );

  it('falls back to a global laytime_rate when no operation-specific clause exists', () => {
    const selected = resolveClausesForOperation(
      [clause('global-laytime', 'laytime_rate', { hours: 72 })],
      'Loading',
    );

    expect(selected).toEqual([
      expect.objectContaining({
        id: 'global-laytime',
        clauseType: 'laytime_rate',
      }),
    ]);
  });

  it('excludes opposite-operation clauses', () => {
    const selected = resolveClausesForOperation(
      [
        clause('discharge-laytime', 'laytime_rate', {
          hours: 54,
          operation: 'Discharge',
        }),
      ],
      'Loading',
    );

    expect(selected).toEqual([]);
  });

  it.each(['demurrage_rate', 'despatch'] as const)(
    'applies the same precedence rules to %s',
    (clauseType) => {
      const selected = resolveClausesForOperation(
        [
          clause(`global-${clauseType}`, clauseType, { rate: 10000 }),
          clause(`loading-${clauseType}`, clauseType, {
            rate: 12000,
            operation: 'Loading',
          }),
          clause(`discharge-${clauseType}`, clauseType, {
            rate: 14000,
            operation: 'Discharge',
          }),
        ],
        'Loading',
      );

      expect(selected).toEqual([
        expect.objectContaining({
          id: `loading-${clauseType}`,
          clauseType,
        }),
      ]);
    },
  );

  it('preserves a global SHEX/SHINC fallback', () => {
    const selected = resolveClausesForOperation(
      [clause('global-shex', 'shex_shinc', { shex: true })],
      'Discharge',
    );

    expect(selected).toEqual([
      expect.objectContaining({
        id: 'global-shex',
        clauseType: 'shex_shinc',
      }),
    ]);
  });

  it('warns and keeps the first same-operation clause when duplicates exist', () => {
    const warnings: string[] = [];
    const selected = resolveClausesForOperation(
      [
        clause('loading-laytime-1', 'laytime_rate', {
          hours: 48,
          operation: 'Loading',
        }),
        clause('loading-laytime-2', 'laytime_rate', {
          hours: 54,
          operation: 'Loading',
        }),
      ],
      'Loading',
      warnings,
    );

    expect(selected).toEqual([
      expect.objectContaining({
        id: 'loading-laytime-1',
        clauseType: 'laytime_rate',
      }),
    ]);
    expect(warnings).toEqual([
      'Multiple "laytime_rate" clauses found for operation "Loading"; the first one was used.',
    ]);
  });

  it('keeps global-only charter-party clauses unchanged', () => {
    const globalOnly = normalizeCommercialTermsToClauses({
      id: 'charter-party-global',
      laytimeAllowed: 72,
      demurrageRate: '25000.00',
      dispatchRate: '12500.00',
      timeCountingBasis: 'SHEX',
      norNoticePeriod: '12 hours',
    });

    expect(resolveClausesForOperation(globalOnly, 'Loading')).toEqual(
      globalOnly,
    );
  });
});
