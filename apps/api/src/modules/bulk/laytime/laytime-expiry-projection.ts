import { TimeInterval } from './interval-overlap';
import {
  localDateForInstant,
  nextLocalDate,
  resolveLocalDateStart,
  resolveShexCalendarDay,
  type ShexCalendarContract,
  type ShexCalendarReason,
} from './shex-calendar';

export interface LaytimeExpiryProjection {
  theoreticalExpiry: Date;
  calendarSecondsSaved: number;
  projectedExceptedIntervals: Array<
    TimeInterval & { localDate: string; reasons: ShexCalendarReason[] }
  >;
}

/**
 * Advances unused countable laytime through the same deterministic contractual
 * calendar used by actual counting. It does not project evidence-based exceptions.
 */
export function projectLaytimeExpiry(input: {
  completionTime: Date;
  remainingCountableSeconds: number;
  calendarContract: ShexCalendarContract | null;
}): LaytimeExpiryProjection {
  const completionTime = new Date(input.completionTime);
  let cursor = new Date(completionTime);
  let remainingMilliseconds = Math.max(
    0,
    input.remainingCountableSeconds * 1000,
  );
  const projectedExceptedIntervals: LaytimeExpiryProjection['projectedExceptedIntervals'] = [];

  if (!input.calendarContract?.shex || !input.calendarContract.timeZone) {
    const theoreticalExpiry = new Date(
      completionTime.getTime() + remainingMilliseconds,
    );
    return {
      theoreticalExpiry,
      calendarSecondsSaved: input.remainingCountableSeconds,
      projectedExceptedIntervals,
    };
  }

  while (remainingMilliseconds > 0) {
    const localDate = localDateForInstant(
      cursor,
      input.calendarContract.timeZone,
    );
    const nextMidnight = resolveLocalDateStart(
      nextLocalDate(localDate),
      input.calendarContract.timeZone,
    );
    const segmentMilliseconds = nextMidnight.getTime() - cursor.getTime();
    const exceptedDay = resolveShexCalendarDay(
      input.calendarContract,
      localDate,
    );

    if (exceptedDay) {
      projectedExceptedIntervals.push({
        start: new Date(cursor),
        end: new Date(nextMidnight),
        localDate,
        reasons: [...exceptedDay.reasons],
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
