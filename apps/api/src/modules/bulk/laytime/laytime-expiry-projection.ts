import { TimeInterval } from './interval-overlap';

export interface LaytimeCalendarRules {
  shex: boolean;
  saturdayExcepted?: boolean;
}

export interface LaytimeExpiryProjection {
  theoreticalExpiry: Date;
  calendarSecondsSaved: number;
  projectedExceptedIntervals: TimeInterval[];
}

/**
 * Advances unused countable laytime through deterministic UTC SHEX/SHINC
 * calendar rules. It does not project evidence-based exceptions.
 */
export function projectLaytimeExpiry(input: {
  completionTime: Date;
  remainingCountableSeconds: number;
  calendarRules: LaytimeCalendarRules;
}): LaytimeExpiryProjection {
  const completionTime = new Date(input.completionTime);
  let cursor = new Date(completionTime);
  let remainingMilliseconds = Math.max(
    0,
    input.remainingCountableSeconds * 1000,
  );
  const projectedExceptedIntervals: TimeInterval[] = [];

  while (remainingMilliseconds > 0) {
    const nextMidnight = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
      ),
    );
    const segmentMilliseconds = nextMidnight.getTime() - cursor.getTime();
    const day = cursor.getUTCDay();
    const isExcepted =
      input.calendarRules.shex &&
      (day === 0 ||
        (day === 6 && input.calendarRules.saturdayExcepted === true));

    if (isExcepted) {
      projectedExceptedIntervals.push({
        start: new Date(cursor),
        end: new Date(nextMidnight),
      });
      cursor = nextMidnight;
      continue;
    }

    const countedMilliseconds = Math.min(
      remainingMilliseconds,
      segmentMilliseconds,
    );
    cursor = new Date(cursor.getTime() + countedMilliseconds);
    remainingMilliseconds -= countedMilliseconds;
  }

  return {
    theoreticalExpiry: cursor,
    calendarSecondsSaved:
      (cursor.getTime() - completionTime.getTime()) / 1000,
    projectedExceptedIntervals,
  };
}
