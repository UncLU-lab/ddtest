import {
  type ReadinessEvidenceEvent,
  selectReadinessEvidence,
} from './readiness-evidence';

const READINESS = 'VESSEL_READY_IN_ALL_RESPECTS';

function readinessEvent(
  id: string,
  eventTime: string,
  operation?: 'Loading' | 'Discharge' | null,
): ReadinessEvidenceEvent {
  return {
    id,
    eventTime: new Date(eventTime),
    eventType: READINESS,
    operation,
  };
}

describe('selectReadinessEvidence', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'selects explicit %s readiness evidence',
    (operation) => {
      const selected = selectReadinessEvidence(
        [readinessEvent(`${operation}-ready`, '2026-03-04T09:00:00Z', operation)],
        operation,
      );

      expect(selected).toEqual(
        expect.objectContaining({
          selectedEventId: `${operation}-ready`,
          readinessTime: new Date('2026-03-04T09:00:00Z'),
          source: 'operation-specific',
        }),
      );
    },
  );

  it('falls back to null-operation readiness for Loading', () => {
    const selected = selectReadinessEvidence(
      [readinessEvent('global-ready', '2026-03-04T08:00:00Z', null)],
      'Loading',
    );

    expect(selected).toEqual(
      expect.objectContaining({
        selectedEventId: 'global-ready',
        source: 'legacy-null',
      }),
    );
  });

  it('prefers matching Loading readiness over earlier null evidence', () => {
    const selected = selectReadinessEvidence(
      [
        readinessEvent('global-ready', '2026-03-04T08:00:00Z', null),
        readinessEvent('loading-ready', '2026-03-04T09:00:00Z', 'Loading'),
      ],
      'Loading',
    );

    expect(selected.selectedEventId).toBe('loading-ready');
    expect(selected.readinessTime).toEqual(new Date('2026-03-04T09:00:00Z'));
    expect(selected.source).toBe('operation-specific');
  });

  it('excludes opposite-operation readiness', () => {
    const selected = selectReadinessEvidence(
      [
        readinessEvent('loading-ready', '2026-03-04T09:00:00Z', 'Loading'),
        readinessEvent('discharge-ready', '2026-03-04T07:00:00Z', 'Discharge'),
      ],
      'Loading',
    );

    expect(selected.selectedEventId).toBe('loading-ready');
    expect(selected.excludedOppositeOperationEventIds).toEqual([
      'discharge-ready',
    ]);
  });

  it('selects only null-operation readiness when operation is omitted', () => {
    const selected = selectReadinessEvidence([
      readinessEvent('loading-ready', '2026-03-04T07:00:00Z', 'Loading'),
      readinessEvent('global-ready', '2026-03-04T08:00:00Z', null),
    ]);

    expect(selected.selectedEventId).toBe('global-ready');
    expect(selected.source).toBe('unscoped');
  });

  it('returns missing when no eligible readiness evidence exists', () => {
    const selected = selectReadinessEvidence(
      [
        readinessEvent('discharge-ready', '2026-03-04T08:00:00Z', 'Discharge'),
        {
          id: 'cargo-start',
          eventTime: new Date('2026-03-04T09:00:00Z'),
          eventType: 'CARGO_STARTED',
          operation: 'Loading',
        },
      ],
      'Loading',
    );

    expect(selected).toEqual({
      selectedEventId: null,
      readinessTime: null,
      source: 'missing',
      candidateEventIds: ['discharge-ready'],
      excludedOppositeOperationEventIds: ['discharge-ready'],
      duplicateEventIds: [],
      warnings: [],
    });
  });

  it('selects the earliest matching event and warns about duplicates', () => {
    const selected = selectReadinessEvidence(
      [
        readinessEvent('later', '2026-03-04T10:00:00Z', 'Loading'),
        readinessEvent('earlier', '2026-03-04T09:00:00Z', 'Loading'),
      ],
      'Loading',
    );

    expect(selected.selectedEventId).toBe('earlier');
    expect(selected.duplicateEventIds).toEqual(['later']);
    expect(selected.warnings).toEqual([
      'Multiple vessel-readiness events were eligible; the earliest deterministic event was selected and 1 additional event(s) were treated as duplicates.',
    ]);
  });

  it('uses lexical event ID ordering for equal timestamps', () => {
    const selected = selectReadinessEvidence(
      [
        readinessEvent('ready-z', '2026-03-04T09:00:00Z', 'Loading'),
        readinessEvent('ready-a', '2026-03-04T09:00:00Z', 'Loading'),
      ],
      'Loading',
    );

    expect(selected.selectedEventId).toBe('ready-a');
    expect(selected.duplicateEventIds).toEqual(['ready-z']);
  });

  it('returns later readiness evidence without applying NOR timing logic', () => {
    const selected = selectReadinessEvidence(
      [readinessEvent('post-nor-ready', '2026-03-04T12:00:00Z', 'Loading')],
      'Loading',
    );

    expect(selected.readinessTime).toEqual(new Date('2026-03-04T12:00:00Z'));
  });

  it('does not mutate the input array, events, or dates', () => {
    const events = [
      readinessEvent('later', '2026-03-04T10:00:00Z', 'Loading'),
      readinessEvent('earlier', '2026-03-04T09:00:00Z', 'Loading'),
    ];
    const originalOrder = events.map((event) => event.id);
    const originalTimes = events.map((event) => event.eventTime.getTime());

    selectReadinessEvidence(events, 'Loading');

    expect(events.map((event) => event.id)).toEqual(originalOrder);
    expect(events.map((event) => event.eventTime.getTime())).toEqual(
      originalTimes,
    );
  });

  it('returns a cloned readiness Date', () => {
    const event = readinessEvent(
      'loading-ready',
      '2026-03-04T09:00:00Z',
      'Loading',
    );
    const selected = selectReadinessEvidence([event], 'Loading');

    expect(selected.readinessTime).toEqual(event.eventTime);
    expect(selected.readinessTime).not.toBe(event.eventTime);
  });
});
