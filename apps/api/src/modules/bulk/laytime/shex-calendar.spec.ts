import {
  collectShexCalendarIntervals,
  resolveShexCalendarContract,
  ShexCalendarError,
} from './shex-calendar';

const versionedSydney = {
  shex: true,
  calendarVersion: 1,
  timeZone: 'Australia/Sydney',
  holidayDates: [] as string[],
  saturdayExcepted: false,
};

describe('SHEX contractual calendar', () => {
  it('resolves a Sydney Sunday by local rather than UTC boundaries', () => {
    const intervals = collectShexCalendarIntervals({
      contract: resolveShexCalendarContract(versionedSydney),
      rangeStart: new Date('2026-07-04T00:00:00Z'),
      rangeEnd: new Date('2026-07-06T00:00:00Z'),
    });

    expect(intervals).toEqual([
      {
        start: new Date('2026-07-04T14:00:00Z'),
        end: new Date('2026-07-05T14:00:00Z'),
        localDate: '2026-07-05',
        reasons: ['sunday'],
      },
    ]);
  });

  it('resolves a New York Sunday by local rather than UTC boundaries', () => {
    const intervals = collectShexCalendarIntervals({
      contract: resolveShexCalendarContract({
        ...versionedSydney,
        timeZone: 'America/New_York',
      }),
      rangeStart: new Date('2026-07-05T00:00:00Z'),
      rangeEnd: new Date('2026-07-07T00:00:00Z'),
    });

    expect(intervals).toEqual([
      {
        start: new Date('2026-07-05T04:00:00Z'),
        end: new Date('2026-07-06T04:00:00Z'),
        localDate: '2026-07-05',
        reasons: ['sunday'],
      },
    ]);
  });

  it('produces a 23-hour excepted Sunday across the New York DST gap', () => {
    const [interval] = collectShexCalendarIntervals({
      contract: resolveShexCalendarContract({
        ...versionedSydney,
        timeZone: 'America/New_York',
      }),
      rangeStart: new Date('2026-03-08T00:00:00Z'),
      rangeEnd: new Date('2026-03-10T00:00:00Z'),
    });

    expect(interval.start).toEqual(new Date('2026-03-08T05:00:00Z'));
    expect(interval.end).toEqual(new Date('2026-03-09T04:00:00Z'));
    expect(interval.end.getTime() - interval.start.getTime()).toBe(
      23 * 60 * 60 * 1000,
    );
  });

  it('produces a 25-hour excepted Sunday across the New York DST fold', () => {
    const [interval] = collectShexCalendarIntervals({
      contract: resolveShexCalendarContract({
        ...versionedSydney,
        timeZone: 'America/New_York',
      }),
      rangeStart: new Date('2026-11-01T00:00:00Z'),
      rangeEnd: new Date('2026-11-03T00:00:00Z'),
    });

    expect(interval.start).toEqual(new Date('2026-11-01T04:00:00Z'));
    expect(interval.end).toEqual(new Date('2026-11-02T05:00:00Z'));
    expect(interval.end.getTime() - interval.start.getTime()).toBe(
      25 * 60 * 60 * 1000,
    );
  });

  it('excepts an explicit holiday as one complete local calendar date', () => {
    const intervals = collectShexCalendarIntervals({
      contract: resolveShexCalendarContract({
        ...versionedSydney,
        holidayDates: ['2026-12-25'],
      }),
      rangeStart: new Date('2026-12-24T00:00:00Z'),
      rangeEnd: new Date('2026-12-27T00:00:00Z'),
    });

    expect(intervals).toContainEqual({
      start: new Date('2026-12-24T13:00:00Z'),
      end: new Date('2026-12-25T13:00:00Z'),
      localDate: '2026-12-25',
      reasons: ['contractual-holiday'],
    });
  });

  it('deduplicates a holiday that is also Sunday while retaining both reasons', () => {
    const intervals = collectShexCalendarIntervals({
      contract: resolveShexCalendarContract({
        ...versionedSydney,
        holidayDates: ['2026-07-05'],
      }),
      rangeStart: new Date('2026-07-04T00:00:00Z'),
      rangeEnd: new Date('2026-07-06T00:00:00Z'),
    });

    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toEqual(
      expect.objectContaining({
        localDate: '2026-07-05',
        reasons: ['sunday', 'contractual-holiday'],
      }),
    );
  });

  it('excepts Saturday only when the contract explicitly enables it', () => {
    const input = {
      rangeStart: new Date('2026-07-03T00:00:00Z'),
      rangeEnd: new Date('2026-07-04T14:00:00Z'),
    };

    expect(
      collectShexCalendarIntervals({
        ...input,
        contract: resolveShexCalendarContract(versionedSydney),
      }),
    ).toEqual([]);
    expect(
      collectShexCalendarIntervals({
        ...input,
        contract: resolveShexCalendarContract({
          ...versionedSydney,
          saturdayExcepted: true,
        }),
      }),
    ).toEqual([
      {
        start: new Date('2026-07-03T14:00:00Z'),
        end: new Date('2026-07-04T14:00:00Z'),
        localDate: '2026-07-04',
        reasons: ['saturday'],
      },
    ]);
  });

  it('generates no contractual calendar intervals for SHINC', () => {
    const contract = resolveShexCalendarContract({ shex: false });

    expect(
      collectShexCalendarIntervals({
        contract,
        rangeStart: new Date('2026-12-24T00:00:00Z'),
        rangeEnd: new Date('2026-12-28T00:00:00Z'),
      }),
    ).toEqual([]);
  });

  it('preserves the historical UTC Sunday contract for legacy SHEX', () => {
    const contract = resolveShexCalendarContract({ shex: true });
    const intervals = collectShexCalendarIntervals({
      contract,
      rangeStart: new Date('2026-07-04T00:00:00Z'),
      rangeEnd: new Date('2026-07-06T00:00:00Z'),
    });

    expect(contract.legacyCompatibilityUsed).toBe(true);
    expect(intervals).toEqual([
      {
        start: new Date('2026-07-05T00:00:00Z'),
        end: new Date('2026-07-06T00:00:00Z'),
        localDate: '2026-07-05',
        reasons: ['sunday'],
      },
    ]);
  });

  it('rejects conflicting historical Saturday aliases', () => {
    expect(() =>
      resolveShexCalendarContract({
        shex: true,
        saturdayExcepted: true,
        satShex: false,
      }),
    ).toThrow(ShexCalendarError);
  });
});
