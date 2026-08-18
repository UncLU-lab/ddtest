import {
  intersectWorkingWithExceptedIntervals,
  type TimeInterval,
} from './interval-overlap';

function interval(start: string, end: string): TimeInterval {
  return {
    start: new Date(start),
    end: new Date(end),
  };
}

describe('intersectWorkingWithExceptedIntervals', () => {
  it('returns no overlap when intervals do not intersect', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T12:00:00Z')],
      [interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z')],
    );

    expect(result.intervals).toEqual([]);
    expect(result.totalOverlapSeconds).toBe(0);
  });

  it('returns a full containment overlap', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T16:00:00Z')],
      [interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z')],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(7200);
  });

  it('returns a partial overlap at the start', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T14:00:00Z')],
      [interval('2026-03-04T08:00:00Z', '2026-03-04T12:00:00Z')],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T10:00:00Z', '2026-03-04T12:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(7200);
  });

  it('returns a partial overlap at the end', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T14:00:00Z')],
      [interval('2026-03-04T12:00:00Z', '2026-03-04T16:00:00Z')],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(7200);
  });

  it('does not count touching boundaries as overlap', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T12:00:00Z')],
      [interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z')],
    );

    expect(result.intervals).toEqual([]);
    expect(result.totalOverlapSeconds).toBe(0);
  });

  it('handles one working interval overlapping multiple excepted intervals', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T18:00:00Z')],
      [
        interval('2026-03-04T11:00:00Z', '2026-03-04T12:00:00Z'),
        interval('2026-03-04T14:00:00Z', '2026-03-04T15:00:00Z'),
      ],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T11:00:00Z', '2026-03-04T12:00:00Z'),
      interval('2026-03-04T14:00:00Z', '2026-03-04T15:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(7200);
  });

  it('handles multiple working intervals overlapping one excepted interval', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [
        interval('2026-03-04T10:00:00Z', '2026-03-04T12:00:00Z'),
        interval('2026-03-04T13:00:00Z', '2026-03-04T15:00:00Z'),
      ],
      [interval('2026-03-04T11:00:00Z', '2026-03-04T14:00:00Z')],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T11:00:00Z', '2026-03-04T12:00:00Z'),
      interval('2026-03-04T13:00:00Z', '2026-03-04T14:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(7200);
  });

  it('merges overlapping excepted intervals so overlap is not double-counted', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T15:00:00Z')],
      [
        interval('2026-03-04T11:00:00Z', '2026-03-04T13:00:00Z'),
        interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z'),
      ],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T11:00:00Z', '2026-03-04T14:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(10800);
  });

  it('merges adjacent intersections into a continuous overlap block', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [interval('2026-03-04T10:00:00Z', '2026-03-04T15:00:00Z')],
      [
        interval('2026-03-04T11:00:00Z', '2026-03-04T12:00:00Z'),
        interval('2026-03-04T12:00:00Z', '2026-03-04T14:00:00Z'),
      ],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T11:00:00Z', '2026-03-04T14:00:00Z'),
    ]);
    expect(result.totalOverlapSeconds).toBe(10800);
  });

  it('ignores invalid and zero-length intervals', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [
        interval('2026-03-04T12:00:00Z', '2026-03-04T12:00:00Z'),
        interval('2026-03-04T14:00:00Z', '2026-03-04T13:00:00Z'),
      ],
      [
        interval('2026-03-04T11:00:00Z', '2026-03-04T11:00:00Z'),
        interval('2026-03-04T15:00:00Z', '2026-03-04T14:00:00Z'),
      ],
    );

    expect(result.intervals).toEqual([]);
    expect(result.totalOverlapSeconds).toBe(0);
  });

  it('returns intervals in deterministic order', () => {
    const result = intersectWorkingWithExceptedIntervals(
      [
        interval('2026-03-04T14:00:00Z', '2026-03-04T18:00:00Z'),
        interval('2026-03-04T10:00:00Z', '2026-03-04T13:00:00Z'),
      ],
      [
        interval('2026-03-04T12:00:00Z', '2026-03-04T15:00:00Z'),
        interval('2026-03-04T09:00:00Z', '2026-03-04T11:00:00Z'),
      ],
    );

    expect(result.intervals).toEqual([
      interval('2026-03-04T10:00:00Z', '2026-03-04T11:00:00Z'),
      interval('2026-03-04T12:00:00Z', '2026-03-04T13:00:00Z'),
      interval('2026-03-04T14:00:00Z', '2026-03-04T15:00:00Z'),
    ]);
  });

  it('does not mutate the input arrays', () => {
    const working = [
      interval('2026-03-04T10:00:00Z', '2026-03-04T15:00:00Z'),
      interval('2026-03-04T16:00:00Z', '2026-03-04T18:00:00Z'),
    ];
    const excepted = [
      interval('2026-03-04T11:00:00Z', '2026-03-04T13:00:00Z'),
      interval('2026-03-04T14:00:00Z', '2026-03-04T17:00:00Z'),
    ];

    const workingSnapshot = working.map(({ start, end }) => ({
      start: start.toISOString(),
      end: end.toISOString(),
    }));
    const exceptedSnapshot = excepted.map(({ start, end }) => ({
      start: start.toISOString(),
      end: end.toISOString(),
    }));

    intersectWorkingWithExceptedIntervals(working, excepted);

    expect(
      working.map(({ start, end }) => ({
        start: start.toISOString(),
        end: end.toISOString(),
      })),
    ).toEqual(workingSnapshot);
    expect(
      excepted.map(({ start, end }) => ({
        start: start.toISOString(),
        end: end.toISOString(),
      })),
    ).toEqual(exceptedSnapshot);
  });
});
