export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface IntervalOverlapResult {
  intervals: TimeInterval[];
  totalOverlapSeconds: number;
}

function compareIntervals(left: TimeInterval, right: TimeInterval): number {
  const startDelta = left.start.getTime() - right.start.getTime();
  if (startDelta !== 0) {
    return startDelta;
  }

  return left.end.getTime() - right.end.getTime();
}

function isPositiveInterval(interval: TimeInterval): boolean {
  return interval.end.getTime() > interval.start.getTime();
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) {
    return [];
  }

  const merged: TimeInterval[] = [{ ...intervals[0] }];

  for (const interval of intervals.slice(1)) {
    const previous = merged[merged.length - 1];
    if (interval.start.getTime() <= previous.end.getTime()) {
      if (interval.end.getTime() > previous.end.getTime()) {
        previous.end = new Date(interval.end);
      }
      continue;
    }

    merged.push({ ...interval });
  }

  return merged;
}

function totalSeconds(intervals: TimeInterval[]): number {
  return intervals.reduce(
    (sum, interval) => sum + (interval.end.getTime() - interval.start.getTime()) / 1000,
    0,
  );
}

function intersectPair(
  working: TimeInterval,
  excepted: TimeInterval,
): TimeInterval | null {
  const start = new Date(
    Math.max(working.start.getTime(), excepted.start.getTime()),
  );
  const end = new Date(Math.min(working.end.getTime(), excepted.end.getTime()));

  if (end.getTime() <= start.getTime()) {
    return null;
  }

  return { start, end };
}

/**
 * Intersects working and excepted intervals, returning normalized positive
 * overlaps only.
 */
export function intersectWorkingWithExceptedIntervals(
  workingIntervals: TimeInterval[],
  exceptedIntervals: TimeInterval[],
): IntervalOverlapResult {
  const working = [...workingIntervals].filter(isPositiveInterval);
  const excepted = [...exceptedIntervals].filter(isPositiveInterval);

  const rawIntersections: TimeInterval[] = [];
  for (const workingInterval of working) {
    for (const exceptedInterval of excepted) {
      const intersection = intersectPair(workingInterval, exceptedInterval);
      if (intersection) {
        rawIntersections.push(intersection);
      }
    }
  }

  rawIntersections.sort(compareIntervals);

  const intervals = mergeIntervals(rawIntersections);

  return {
    intervals,
    totalOverlapSeconds: totalSeconds(intervals),
  };
}
