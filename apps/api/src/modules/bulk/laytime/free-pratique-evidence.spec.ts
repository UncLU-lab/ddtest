import {
  type FreePratiqueEvidenceEvent,
  selectFreePratiqueEvidence,
} from './free-pratique-evidence';

function grant(
  id: string | null,
  eventTime: string,
  operation?: 'Loading' | 'Discharge' | null,
): FreePratiqueEvidenceEvent {
  return {
    id,
    eventTime: new Date(eventTime),
    eventType: 'FREE_PRATIQUE_GRANTED',
    operation,
  };
}

describe('selectFreePratiqueEvidence', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'selects matching %s evidence',
    (operation) => {
      const result = selectFreePratiqueEvidence(
        [grant(`${operation}-grant`, '2026-03-04T08:00:00Z', operation)],
        operation,
      );

      expect(result).toEqual(
        expect.objectContaining({
          selectedEventId: `${operation}-grant`,
          grantedTime: new Date('2026-03-04T08:00:00Z'),
          source: 'operation-specific',
        }),
      );
    },
  );

  it.each(['Loading', 'Discharge'] as const)(
    'falls back to null-operation evidence for %s',
    (operation) => {
      const result = selectFreePratiqueEvidence(
        [grant('null-grant', '2026-03-04T07:00:00Z', null)],
        operation,
      );

      expect(result).toEqual(
        expect.objectContaining({
          selectedEventId: 'null-grant',
          source: 'legacy-null',
        }),
      );
    },
  );

  it('prefers matching evidence over earlier null evidence', () => {
    const result = selectFreePratiqueEvidence(
      [
        grant('null-grant', '2026-03-04T07:00:00Z', null),
        grant('loading-grant', '2026-03-04T09:00:00Z', 'Loading'),
      ],
      'Loading',
    );

    expect(result.selectedEventId).toBe('loading-grant');
    expect(result.grantedTime).toEqual(new Date('2026-03-04T09:00:00Z'));
  });

  it('excludes opposite-operation evidence', () => {
    const result = selectFreePratiqueEvidence(
      [grant('discharge-grant', '2026-03-04T08:00:00Z', 'Discharge')],
      'Loading',
    );

    expect(result.selectedEventId).toBeNull();
    expect(result.excludedOppositeOperationEventIds).toEqual([
      'discharge-grant',
    ]);
  });

  it('selects only null-operation evidence when operation is omitted', () => {
    const result = selectFreePratiqueEvidence([
      grant('loading-grant', '2026-03-04T06:00:00Z', 'Loading'),
      grant('null-grant', '2026-03-04T08:00:00Z', null),
      grant('discharge-grant', '2026-03-04T07:00:00Z', 'Discharge'),
    ]);

    expect(result.selectedEventId).toBe('null-grant');
    expect(result.source).toBe('unscoped');
  });

  it('returns a missing result without manufacturing a timestamp', () => {
    expect(selectFreePratiqueEvidence([], 'Loading')).toEqual({
      selectedEventId: null,
      grantedTime: null,
      source: 'missing',
      candidateEventIds: [],
      excludedOppositeOperationEventIds: [],
      duplicateEventIds: [],
      warnings: [],
    });
  });

  it('selects the earliest eligible grant and warns about duplicates', () => {
    const result = selectFreePratiqueEvidence(
      [
        grant('later', '2026-03-04T09:00:00Z', 'Loading'),
        grant('earlier', '2026-03-04T08:00:00Z', 'Loading'),
      ],
      'Loading',
    );

    expect(result.selectedEventId).toBe('earlier');
    expect(result.duplicateEventIds).toEqual(['later']);
    expect(result.warnings).toEqual([
      'Multiple free-pratique grant events were eligible; the earliest deterministic event was selected and 1 additional event(s) were treated as duplicates.',
    ]);
  });

  it('uses lexicographic event ID order at the same timestamp', () => {
    const result = selectFreePratiqueEvidence(
      [
        grant('grant-b', '2026-03-04T08:00:00Z', 'Loading'),
        grant('grant-a', '2026-03-04T08:00:00Z', 'Loading'),
      ],
      'Loading',
    );

    expect(result.selectedEventId).toBe('grant-a');
    expect(result.duplicateEventIds).toEqual(['grant-b']);
  });

  it('returns a late grant without interpreting it against NOR', () => {
    const result = selectFreePratiqueEvidence(
      [grant('late-grant', '2026-03-05T18:00:00Z', 'Loading')],
      'Loading',
    );

    expect(result.grantedTime).toEqual(new Date('2026-03-05T18:00:00Z'));
    expect(result.warnings).toEqual([]);
  });

  it.each([
    'VESSEL_READY_IN_ALL_RESPECTS',
    'NOR_TENDERED',
    'CARGO_STARTED',
    'ARRIVED_AT_PORT',
  ])('ignores unrelated event type %s', (eventType) => {
    const result = selectFreePratiqueEvidence(
      [
        {
          id: 'unrelated',
          eventTime: new Date('2026-03-04T08:00:00Z'),
          eventType,
          operation: 'Loading',
        },
      ],
      'Loading',
    );

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: null,
        grantedTime: null,
        source: 'missing',
        candidateEventIds: [],
      }),
    );
  });

  it('does not mutate inputs and clones the returned Date', () => {
    const event = grant('grant', '2026-03-04T08:00:00Z', 'Loading');
    const events = [event];
    const originalTime = event.eventTime.getTime();

    const result = selectFreePratiqueEvidence(events, 'Loading');

    expect(events).toEqual([event]);
    expect(event.eventTime.getTime()).toBe(originalTime);
    expect(result.grantedTime).not.toBe(event.eventTime);
    expect(result.grantedTime?.getTime()).toBe(originalTime);
  });

  it('is deterministic across repeated calls', () => {
    const events = [
      grant('grant-b', '2026-03-04T08:00:00Z', 'Loading'),
      grant('grant-a', '2026-03-04T08:00:00Z', 'Loading'),
    ];

    expect(selectFreePratiqueEvidence(events, 'Loading')).toEqual(
      selectFreePratiqueEvidence(events, 'Loading'),
    );
  });
});
