export type FreePratiqueOperation = 'Loading' | 'Discharge';

export interface FreePratiqueEvidenceEvent {
  id?: string | null;
  eventTime: Date;
  eventType: string;
  operation?: FreePratiqueOperation | null;
}

export interface FreePratiqueEvidenceSelection {
  selectedEventId: string | null;
  grantedTime: Date | null;
  source: 'operation-specific' | 'legacy-null' | 'unscoped' | 'missing';
  candidateEventIds: string[];
  excludedOppositeOperationEventIds: string[];
  duplicateEventIds: string[];
  warnings: string[];
}

const FREE_PRATIQUE_EVENT_TYPE = 'FREE_PRATIQUE_GRANTED';

/** Selects factual free-pratique evidence without evaluating NOR validity. */
export function selectFreePratiqueEvidence(
  events: FreePratiqueEvidenceEvent[],
  operation?: FreePratiqueOperation,
): FreePratiqueEvidenceSelection {
  const grantEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.eventType === FREE_PRATIQUE_EVENT_TYPE);
  const candidateEventIds = grantEvents.flatMap(({ event }) =>
    event.id ? [event.id] : [],
  );
  const oppositeEvents = operation
    ? grantEvents.filter(
        ({ event }) =>
          event.operation !== null &&
          event.operation !== undefined &&
          event.operation !== operation,
      )
    : [];
  const nullEvents = grantEvents.filter(
    ({ event }) => event.operation === null || event.operation === undefined,
  );
  const matchingEvents = operation
    ? grantEvents.filter(({ event }) => event.operation === operation)
    : [];

  const selectedGroup = operation
    ? matchingEvents.length > 0
      ? matchingEvents
      : nullEvents
    : nullEvents;
  const source: FreePratiqueEvidenceSelection['source'] =
    selectedGroup.length === 0
      ? 'missing'
      : operation
        ? matchingEvents.length > 0
          ? 'operation-specific'
          : 'legacy-null'
        : 'unscoped';
  const ordered = [...selectedGroup].sort((left, right) => {
    const timeDelta =
      left.event.eventTime.getTime() - right.event.eventTime.getTime();
    if (timeDelta !== 0) return timeDelta;

    const idDelta = (left.event.id ?? '').localeCompare(right.event.id ?? '');
    return idDelta !== 0 ? idDelta : left.index - right.index;
  });
  const selected = ordered[0]?.event;
  const duplicates = ordered.slice(1);
  const warnings =
    duplicates.length > 0
      ? [
          `Multiple free-pratique grant events were eligible; the earliest deterministic event was selected and ${duplicates.length} additional event(s) were treated as duplicates.`,
        ]
      : [];

  return {
    selectedEventId: selected?.id ?? null,
    grantedTime: selected ? new Date(selected.eventTime) : null,
    source,
    candidateEventIds,
    excludedOppositeOperationEventIds: oppositeEvents.flatMap(({ event }) =>
      event.id ? [event.id] : [],
    ),
    duplicateEventIds: duplicates.flatMap(({ event }) =>
      event.id ? [event.id] : [],
    ),
    warnings,
  };
}
