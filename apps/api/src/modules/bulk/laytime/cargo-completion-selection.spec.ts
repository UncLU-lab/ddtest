import { selectCargoCompletion } from './cargo-completion-selection';

function event(
  id: string,
  eventTime: string,
  eventType: string,
  operation: 'Loading' | 'Discharge' = 'Loading',
) {
  return {
    id,
    eventTime: new Date(eventTime),
    eventType,
    operation,
  };
}

describe('selectCargoCompletion', () => {
  it('selects HATCHES_CLOSED for dry bulk and prefers the earliest duplicate', () => {
    const result = selectCargoCompletion({
      bulkOperationType: 'dry_bulk',
      operation: 'Loading',
      events: [
        event('cargo-completed', '2026-03-05T16:00:00Z', 'CARGO_COMPLETED'),
        event('hatches-2', '2026-03-05T16:45:00Z', 'HATCHES_CLOSED'),
        event('hatches-1', '2026-03-05T16:30:00Z', 'HATCHES_CLOSED'),
        event('cargo-secured', '2026-03-05T16:15:00Z', 'CARGO_SECURED'),
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: 'hatches-1',
        selectedEventType: 'HATCHES_CLOSED',
        selectionBasis: 'dry-bulk-hatches-closed',
        bulkOperationType: 'dry_bulk',
      }),
    );
    expect(result.completionTime.toISOString()).toBe('2026-03-05T16:30:00.000Z');
    expect(result.excludedEventIds).toEqual([
      'cargo-completed',
      'hatches-2',
      'cargo-secured',
    ]);
    expect(result.warnings).toContain(
      'Multiple HATCHES_CLOSED events were found; the earliest one was used as the authoritative dry-bulk completion marker.',
    );
  });

  it('falls back to CARGO_SECURED for dry bulk when HATCHES_CLOSED is missing', () => {
    const result = selectCargoCompletion({
      bulkOperationType: 'dry_bulk',
      operation: 'Loading',
      events: [
        event('cargo-completed', '2026-03-05T16:00:00Z', 'CARGO_COMPLETED'),
        event('cargo-secured-1', '2026-03-05T16:20:00Z', 'CARGO_SECURED'),
        event('cargo-secured-2', '2026-03-05T16:25:00Z', 'CARGO_SECURED'),
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: 'cargo-secured-1',
        selectedEventType: 'CARGO_SECURED',
        selectionBasis: 'dry-bulk-cargo-secured-fallback',
      }),
    );
    expect(result.warnings).toContain(
      'Dry-bulk completion evidence did not include HATCHES_CLOSED; CARGO_SECURED was used as the documented fallback terminal marker.',
    );
  });

  it('uses the legacy fallback for dry bulk when no dry-bulk terminal evidence exists', () => {
    const result = selectCargoCompletion({
      bulkOperationType: 'dry_bulk',
      operation: 'Loading',
      events: [
        event('cargo-completed', '2026-03-05T16:00:00Z', 'CARGO_COMPLETED'),
        event('loading-completed', '2026-03-05T15:00:00Z', 'LOADING_COMPLETED'),
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: 'cargo-completed',
        selectedEventType: 'CARGO_COMPLETED',
        selectionBasis: 'legacy-completion-fallback',
      }),
    );
    expect(result.warnings).toContain(
      'Dry-bulk completion evidence did not include HATCHES_CLOSED or CARGO_SECURED; legacy completion fallback was used.',
    );
  });

  it('selects HOSES_DISCONNECTED for tanker and ignores later generic completion markers', () => {
    const result = selectCargoCompletion({
      bulkOperationType: 'tanker',
      operation: 'Discharge',
      events: [
        event('discharge-completed', '2026-03-05T18:00:00Z', 'DISCHARGE_COMPLETED', 'Discharge'),
        event('hoses-1', '2026-03-05T18:30:00Z', 'HOSES_DISCONNECTED', 'Discharge'),
        event('cargo-completed', '2026-03-05T18:45:00Z', 'CARGO_COMPLETED', 'Discharge'),
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: 'hoses-1',
        selectedEventType: 'HOSES_DISCONNECTED',
        selectionBasis: 'tanker-hoses-disconnected',
      }),
    );
    expect(result.excludedEventIds).toEqual([
      'discharge-completed',
      'cargo-completed',
    ]);
  });

  it('falls back to legacy completion selection for tanker when hoses are missing', () => {
    const result = selectCargoCompletion({
      bulkOperationType: 'tanker',
      operation: 'Discharge',
      events: [
        event('discharge-completed', '2026-03-05T18:00:00Z', 'DISCHARGE_COMPLETED', 'Discharge'),
        event('cargo-completed', '2026-03-05T18:45:00Z', 'CARGO_COMPLETED', 'Discharge'),
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: 'cargo-completed',
        selectedEventType: 'CARGO_COMPLETED',
        selectionBasis: 'legacy-completion-fallback',
      }),
    );
    expect(result.warnings).toContain(
      'Tanker completion evidence did not include HOSES_DISCONNECTED; legacy completion fallback was used.',
    );
  });

  it('preserves legacy completion behavior when the voyage regime is unknown', () => {
    const result = selectCargoCompletion({
      bulkOperationType: null,
      operation: 'Loading',
      events: [
        event('cargo-completed', '2026-03-05T16:00:00Z', 'CARGO_COMPLETED'),
        event('hoses-disconnected', '2026-03-05T18:00:00Z', 'HOSES_DISCONNECTED'),
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        selectedEventId: 'hoses-disconnected',
        selectedEventType: 'HOSES_DISCONNECTED',
        selectionBasis: 'legacy-completion-fallback',
      }),
    );
    expect(result.warnings).toEqual([]);
  });

  it('does not mutate the input event array', () => {
    const events = [
      event('cargo-completed', '2026-03-05T16:00:00Z', 'CARGO_COMPLETED'),
      event('hatches-closed', '2026-03-05T16:30:00Z', 'HATCHES_CLOSED'),
    ];
    const snapshot = events.map((entry) => ({
      ...entry,
      eventTime: entry.eventTime.toISOString(),
    }));

    selectCargoCompletion({
      bulkOperationType: 'dry_bulk',
      operation: 'Loading',
      events,
    });

    expect(
      events.map((entry) => ({
        ...entry,
        eventTime: entry.eventTime.toISOString(),
      })),
    ).toEqual(snapshot);
  });
});
