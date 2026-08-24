export type ReadinessOperation = 'Loading' | 'Discharge';

export interface ReadinessEvidenceEvent {
  id?: string | null;
  eventTime: Date;
  eventType: string;
  operation?: ReadinessOperation | null;
}
export interface ReadinessEvidenceSelection {
  selectedEventId: string | null;
  readinessTime: Date | null;
  source: 'operation-specific' | 'legacy-null' | 'unscoped' | 'missing';
  candidateEventIds: string[];
  excludedOppositeOperationEventIds: string[];
  duplicateEventIds: string[];
  warnings: string[];
}

const READINESS_EVENT_TYPE = 'VESSEL_READY_IN_ALL_RESPECTS';

/** Selects readiness evidence without evaluating it against a NOR timestamp. */
export function selectReadinessEvidence(
  events: ReadinessEvidenceEvent[],
  operation?: ReadinessOperation,
): ReadinessEvidenceSelection {
  const readinessEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.eventType === READINESS_EVENT_TYPE);
  const candidateEventIds = readinessEvents.flatMap(({ event }) =>
    event.id ? [event.id] : [],
  );
  const oppositeEvents = operation
    ? readinessEvents.filter(
        ({ event }) =>
          event.operation !== null &&
          event.operation !== undefined &&
          event.operation !== operation,
      )
    : [];
  const nullEvents = readinessEvents.filter(
    ({ event }) => event.operation === null || event.operation === undefined,
  );
  const matchingEvents = operation
    ? readinessEvents.filter(({ event }) => event.operation === operation)
    : [];

  const selectedGroup = operation
    ? matchingEvents.length > 0
      ? matchingEvents
      : nullEvents
    : nullEvents;
  const source: ReadinessEvidenceSelection['source'] =
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
    if (timeDelta !== 0) {
      return timeDelta;
    }

    const idDelta = (left.event.id ?? '').localeCompare(right.event.id ?? '');
    return idDelta !== 0 ? idDelta : left.index - right.index;
  });
  const selected = ordered[0]?.event;
  const duplicates = ordered.slice(1);
  const warnings =
    duplicates.length > 0
      ? [
          `Multiple vessel-readiness events were eligible; the earliest deterministic event was selected and ${duplicates.length} additional event(s) were treated as duplicates.`,
        ]
      : [];

  return {
    selectedEventId: selected?.id ?? null,
    readinessTime: selected ? new Date(selected.eventTime) : null,
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
