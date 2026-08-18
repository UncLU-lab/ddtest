import { projectLaytimeExpiry } from './laytime-expiry-projection';

const HOUR_SECONDS = 60 * 60;

describe('projectLaytimeExpiry', () => {
  it('skips Sunday when projecting remaining countable time under SHEX', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-07T18:00:00Z'),
      remainingCountableSeconds: 12 * HOUR_SECONDS,
      calendarRules: { shex: true },
    });

    expect(result).toEqual({
      theoreticalExpiry: new Date('2026-03-09T06:00:00Z'),
      calendarSecondsSaved: 36 * HOUR_SECONDS,
      projectedExceptedIntervals: [
        {
          start: new Date('2026-03-08T00:00:00Z'),
          end: new Date('2026-03-09T00:00:00Z'),
        },
      ],
    });
  });

  it('advances continuously under SHINC', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-07T18:00:00Z'),
      remainingCountableSeconds: 12 * HOUR_SECONDS,
      calendarRules: { shex: false },
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
      calendarRules: { shex: true },
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
      calendarRules: { shex: true },
    });

    expect(result).toEqual({
      theoreticalExpiry: new Date('2026-03-09T06:00:00Z'),
      calendarSecondsSaved: 18 * HOUR_SECONDS,
      projectedExceptedIntervals: [
        {
          start: new Date('2026-03-08T12:00:00Z'),
          end: new Date('2026-03-09T00:00:00Z'),
        },
      ],
    });
  });

  it('skips multiple Sundays deterministically', () => {
    const result = projectLaytimeExpiry({
      completionTime: new Date('2026-03-06T00:00:00Z'),
      remainingCountableSeconds: 10 * 24 * HOUR_SECONDS,
      calendarRules: { shex: true },
    });

    expect(result.theoreticalExpiry).toEqual(
      new Date('2026-03-18T00:00:00Z'),
    );
    expect(result.calendarSecondsSaved).toBe(12 * 24 * HOUR_SECONDS);
    expect(result.projectedExceptedIntervals).toEqual([
      {
        start: new Date('2026-03-08T00:00:00Z'),
        end: new Date('2026-03-09T00:00:00Z'),
      },
      {
        start: new Date('2026-03-15T00:00:00Z'),
        end: new Date('2026-03-16T00:00:00Z'),
      },
    ]);
  });

  it('does not mutate its inputs', () => {
    const completionTime = new Date('2026-03-07T18:00:00Z');
    const calendarRules = { shex: true, saturdayExcepted: false };
    const completionValue = completionTime.getTime();
    const rulesValue = { ...calendarRules };

    projectLaytimeExpiry({
      completionTime,
      remainingCountableSeconds: 12 * HOUR_SECONDS,
      calendarRules,
    });

    expect(completionTime.getTime()).toBe(completionValue);
    expect(calendarRules).toEqual(rulesValue);
  });
});

