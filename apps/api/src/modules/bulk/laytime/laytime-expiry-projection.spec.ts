import { projectLaytimeExpiry } from './laytime-expiry-projection';
import { resolveShexCalendarContract } from './shex-calendar';

const HOUR_SECONDS = 60 * 60;

describe('projectLaytimeExpiry', () => {
  it('skips Sunday when projecting remaining countable time under SHEX', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-07T18:00:00Z'),
      remainingCountableSeconds: 12 * HOUR_SECONDS,
      calendarContract: resolveShexCalendarContract({ shex: true }),
    });

    expect(result).toEqual({
      theoreticalExpiry: new Date('2026-03-09T06:00:00Z'),
      calendarSecondsSaved: 36 * HOUR_SECONDS,
      projectedExceptedIntervals: [
        {
          start: new Date('2026-03-08T00:00:00Z'),
          end: new Date('2026-03-09T00:00:00Z'),
          localDate: '2026-03-08',
          reasons: ['sunday'],
        },
      ],
    });
  });

  it('advances continuously under SHINC', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-07T18:00:00Z'),
      remainingCountableSeconds: 12 * HOUR_SECONDS,
      calendarContract: resolveShexCalendarContract({ shex: false }),
    });

    expect(result).toEqual({
      theoreticalExpiry: new Date('2026-03-08T06:00:00Z'),
      calendarSecondsSaved: 12 * HOUR_SECONDS,
      projectedExceptedIntervals: [],
    });
  });

  it('returns completion unchanged when no countable time remains', () => {
    const completionTime = new Date('2026-03-08T12:00:00Z');

    const result = projectLaytimeExpiry({
      completionTime,
      remainingCountableSeconds: 0,
      calendarContract: resolveShexCalendarContract({ shex: true }),
    });

    expect(result).toEqual({
      theoreticalExpiry: new Date('2026-03-08T12:00:00Z'),
      calendarSecondsSaved: 0,
      projectedExceptedIntervals: [],
    });
  });

  it('skips from a Sunday start to the next countable period', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-08T12:00:00Z'),
      remainingCountableSeconds: 6 * HOUR_SECONDS,
      calendarContract: resolveShexCalendarContract({ shex: true }),
    });

    expect(result).toEqual({
      theoreticalExpiry: new Date('2026-03-09T06:00:00Z'),
      calendarSecondsSaved: 18 * HOUR_SECONDS,
      projectedExceptedIntervals: [
        {
          start: new Date('2026-03-08T12:00:00Z'),
          end: new Date('2026-03-09T00:00:00Z'),
          localDate: '2026-03-08',
          reasons: ['sunday'],
        },
      ],
    });
  });

  it('skips multiple Sundays deterministically', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-06T00:00:00Z'),
      remainingCountableSeconds: 10 * 24 * HOUR_SECONDS,
      calendarContract: resolveShexCalendarContract({ shex: true }),
    });

    expect(result.theoreticalExpiry).toEqual(
      new Date('2026-03-18T00:00:00Z'),
    );
    expect(result.calendarSecondsSaved).toBe(12 * 24 * HOUR_SECONDS);
    expect(result.projectedExceptedIntervals).toEqual([
      {
        start: new Date('2026-03-08T00:00:00Z'),
        end: new Date('2026-03-09T00:00:00Z'),
        localDate: '2026-03-08',
        reasons: ['sunday'],
      },
      {
        start: new Date('2026-03-15T00:00:00Z'),
        end: new Date('2026-03-16T00:00:00Z'),
        localDate: '2026-03-15',
        reasons: ['sunday'],
      },
    ]);
  });

  it('does not mutate its inputs', () => {
    const completionTime = new Date('2026-03-07T18:00:00Z');
    const calendarContract = resolveShexCalendarContract({ shex: true });
    const completionValue = completionTime.getTime();
    const rulesValue = { ...calendarContract };

    projectLaytimeExpiry({
      completionTime,
      remainingCountableSeconds: 12 * HOUR_SECONDS,
      calendarContract,
    });

    expect(completionTime.getTime()).toBe(completionValue);
    expect(calendarContract).toEqual(rulesValue);
  });

  it('uses one versioned calendar for holiday, Saturday, and Sunday projection', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-12-24T12:00:00Z'),
      remainingCountableSeconds: 24 * HOUR_SECONDS,
      calendarContract: resolveShexCalendarContract({
        shex: true,
        calendarVersion: 1,
        timeZone: 'UTC',
        holidayDates: ['2026-12-25'],
        saturdayExcepted: true,
      }),
    });

    expect(result.theoreticalExpiry).toEqual(
      new Date('2026-12-28T12:00:00Z'),
    );
    expect(result.projectedExceptedIntervals).toEqual([
      {
        start: new Date('2026-12-25T00:00:00Z'),
        end: new Date('2026-12-26T00:00:00Z'),
        localDate: '2026-12-25',
        reasons: ['contractual-holiday'],
      },
      {
        start: new Date('2026-12-26T00:00:00Z'),
        end: new Date('2026-12-27T00:00:00Z'),
        localDate: '2026-12-26',
        reasons: ['saturday'],
      },
      {
        start: new Date('2026-12-27T00:00:00Z'),
        end: new Date('2026-12-28T00:00:00Z'),
        localDate: '2026-12-27',
        reasons: ['sunday'],
      },
    ]);
  });
});
