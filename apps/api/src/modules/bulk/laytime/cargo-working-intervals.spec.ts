import {
  deriveCargoWorkingIntervals,
  type CargoWorkingEvent,
} from './cargo-working-intervals';

function event(
  id: string,
  eventTime: string,
  eventType: string,
  operation: 'Loading' | 'Discharge' = 'Loading',
): CargoWorkingEvent {
  return {
    id,
    eventTime: new Date(eventTime),
    eventType,
    operation,
  };
}

describe('deriveCargoWorkingIntervals', () => {
  const operation = 'Loading' as const;
  const commencement = new Date('2026-03-04T06:00:00Z');
  const completion = new Date('2026-03-04T18:00:00Z');

  it('derives one interval from CARGO_STARTED to completion', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: new Date('2026-03-04T16:00:00Z'),
        startEventId: 'start',
        endEventId: 'complete',
      },
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it('splits work into two intervals across stop and resume events', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
        event('stop', '2026-03-04T10:00:00Z', 'WORK_STOPPED', operation),
        event('resume', '2026-03-04T12:00:00Z', 'WORK_RESUMED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: new Date('2026-03-04T10:00:00Z'),
        startEventId: 'start',
        endEventId: 'stop',
      },
      {
        start: new Date('2026-03-04T12:00:00Z'),
        end: new Date('2026-03-04T16:00:00Z'),
        startEventId: 'resume',
        endEventId: 'complete',
      },
    ]);
  });

  it('ignores duplicate CARGO_STARTED events while already working', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start-1', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
        event('start-2', '2026-03-04T09:00:00Z', 'CARGO_STARTED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: new Date('2026-03-04T16:00:00Z'),
        startEventId: 'start-1',
        endEventId: 'complete',
      },
    ]);
    expect(result.warnings).toContain(
      'Duplicate CARGO_STARTED event was ignored while the Loading operation was already working.',
    );
  });

  it('ignores WORK_RESUMED before any stop', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('resume', '2026-03-04T08:00:00Z', 'WORK_RESUMED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([]);
    expect(result.warnings).toContain(
      'WORK_RESUMED event was ignored because no prior stop had been seen for the Loading operation.',
    );
  });

  it('ignores WORK_STOPPED before any start', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('stop', '2026-03-04T08:00:00Z', 'WORK_STOPPED', operation),
        event('start', '2026-03-04T09:00:00Z', 'CARGO_STARTED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T09:00:00Z'),
        end: new Date('2026-03-04T16:00:00Z'),
        startEventId: 'start',
        endEventId: 'complete',
      },
    ]);
    expect(result.warnings).toContain(
      'WORK_STOPPED event was ignored because no Loading work interval was open.',
    );
  });

  it('does not treat weather events as working boundaries', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
        event('rain-start', '2026-03-04T09:00:00Z', 'RAIN_STOPPAGE', operation),
        event('rain-end', '2026-03-04T10:00:00Z', 'RAIN_STOPPED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: new Date('2026-03-04T16:00:00Z'),
        startEventId: 'start',
        endEventId: 'complete',
      },
    ]);
  });

  it('clips intervals that begin before laytime commencement', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start', '2026-03-04T04:00:00Z', 'CARGO_STARTED', operation),
        event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: commencement,
        end: new Date('2026-03-04T16:00:00Z'),
        startEventId: 'start',
        endEventId: 'complete',
      },
    ]);
  });

  it('clips intervals that extend beyond cargo completion', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
        event('stop', '2026-03-04T22:00:00Z', 'WORK_STOPPED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: completion,
        startEventId: 'start',
      },
    ]);
    expect(result.warnings).toContain(
      'The Loading working interval was closed at the cargo completion boundary because no explicit end event was present.',
    );
  });

  it('closes an open interval at the supplied cargo completion boundary', () => {
    const result = deriveCargoWorkingIntervals(
      [event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation)],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: completion,
        startEventId: 'start',
      },
    ]);
    expect(result.warnings).toContain(
      'The Loading working interval was closed at the cargo completion boundary because no explicit end event was present.',
    );
  });

  it('discards zero-length intervals', () => {
    const zeroBoundary = new Date('2026-03-04T10:00:00Z');
    const result = deriveCargoWorkingIntervals(
      [event('start', '2026-03-04T09:00:00Z', 'CARGO_STARTED', operation)],
      { operation, laytimeCommencement: zeroBoundary, cargoCompletion: zeroBoundary },
    );

    expect(result.intervals).toEqual([]);
    expect(result.warnings).toContain(
      'The Loading working interval was closed at the cargo completion boundary because no explicit end event was present.',
    );
  });

  it('uses deterministic same-timestamp ordering so stop and resume do not overlap', () => {
    const result = deriveCargoWorkingIntervals(
      [
        event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
        event('stop', '2026-03-04T10:00:00Z', 'WORK_STOPPED', operation),
        event('resume', '2026-03-04T10:00:00Z', 'WORK_RESUMED', operation),
        event('complete', '2026-03-04T12:00:00Z', 'CARGO_COMPLETED', operation),
      ],
      { operation, laytimeCommencement: commencement, cargoCompletion: completion },
    );

    expect(result.intervals).toEqual([
      {
        start: new Date('2026-03-04T08:00:00Z'),
        end: new Date('2026-03-04T10:00:00Z'),
        startEventId: 'start',
        endEventId: 'stop',
      },
      {
        start: new Date('2026-03-04T10:00:00Z'),
        end: new Date('2026-03-04T12:00:00Z'),
        startEventId: 'resume',
        endEventId: 'complete',
      },
    ]);
  });

  it('does not mutate the input array', () => {
    const events = [
      event('start', '2026-03-04T08:00:00Z', 'CARGO_STARTED', operation),
      event('stop', '2026-03-04T10:00:00Z', 'WORK_STOPPED', operation),
      event('complete', '2026-03-04T16:00:00Z', 'CARGO_COMPLETED', operation),
    ];
    const snapshot = events.map((entry) => ({
      ...entry,
      eventTime: entry.eventTime.toISOString(),
    }));

    deriveCargoWorkingIntervals(events, {
      operation,
      laytimeCommencement: commencement,
      cargoCompletion: completion,
    });

    expect(
      events.map((entry) => ({
        ...entry,
        eventTime: entry.eventTime.toISOString(),
      })),
    ).toEqual(snapshot);
  });
});
