import {
  normalizeCommercialTermsToClauses,
  parseNoticeHours,
} from './charter-party-terms';

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
