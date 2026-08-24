import { LaytimeEngineError, type CargoCompletionSelection, type CargoCompletionSelectionBasis, type EngineSofEvent } from './laytime.types';
import type { BulkOperationType, LaytimeOperation } from '../entities/voyage.entity';

const AUTH_COMPLETION_EVENT_TYPES = new Set([
  'CARGO_COMPLETED',
  'LOADING_COMPLETED',
  'DISCHARGE_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
  'HATCHES_CLOSED',
  'CARGO_SECURED',
]);

const LEGACY_COMPLETION_EVENT_TYPES = new Set([
  'CARGO_COMPLETED',
  'LOADING_COMPLETED',
  'DISCHARGE_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
]);

type OrderedCompletionEvent = EngineSofEvent & {
  __index: number;
};

function isRecognizedCompletionEvent(eventType: string): boolean {
  return LEGACY_COMPLETION_EVENT_TYPES.has(eventType);
}

function sortByTimeAndDeterministicOrder(events: OrderedCompletionEvent[]) {
  return [...events].sort((left, right) => {
    const timeDelta = left.eventTime.getTime() - right.eventTime.getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    const leftId = left.id ?? '';
    const rightId = right.id ?? '';
    const idDelta = leftId.localeCompare(rightId);

    if (idDelta !== 0) {
      return idDelta;
    }

    return left.__index - right.__index;
  });
}

function selectLatestRecognizedCompletion(
  events: OrderedCompletionEvent[],
): OrderedCompletionEvent | null {
  const recognized = sortByTimeAndDeterministicOrder(
    events.filter((event) => isRecognizedCompletionEvent(event.eventType)),
  );

  return recognized.at(-1) ?? null;
}

function selectEarliestByEventType(
  events: OrderedCompletionEvent[],
  eventType: string,
): OrderedCompletionEvent[] {
  return sortByTimeAndDeterministicOrder(
    events.filter((event) => event.eventType === eventType),
  );
}

export function selectCargoCompletion(input: {
  events: EngineSofEvent[];
  operation?: LaytimeOperation;
  bulkOperationType?: BulkOperationType | null;
}): CargoCompletionSelection {
  const ordered = input.events.map<OrderedCompletionEvent>((event, index) => ({
    ...event,
    __index: index,
  }));
  const candidateEventIds = ordered.map((event) => event.id ?? '');

  if (ordered.length === 0) {
    throw new LaytimeEngineError(
      `No cargo completion event found in the SOF; expected one of: ${[...AUTH_COMPLETION_EVENT_TYPES].join(', ')}.`,
    );
  }

  const completionType =
    input.bulkOperationType === 'dry_bulk'
      ? 'dry_bulk'
      : input.bulkOperationType === 'tanker'
        ? 'tanker'
        : 'legacy';
  const warnings: string[] = [];
  let selected: OrderedCompletionEvent | null = null;
  let selectionBasis: CargoCompletionSelectionBasis = 'legacy-completion-fallback';

  if (completionType === 'dry_bulk') {
    const hatchesClosed = selectEarliestByEventType(ordered, 'HATCHES_CLOSED');

    if (hatchesClosed.length > 0) {
      selected = hatchesClosed[0];
      selectionBasis = 'dry-bulk-hatches-closed';

      if (hatchesClosed.length > 1) {
        warnings.push(
          'Multiple HATCHES_CLOSED events were found; the earliest one was used as the authoritative dry-bulk completion marker.',
        );
      }
    } else {
      const cargoSecured = selectEarliestByEventType(ordered, 'CARGO_SECURED');

      if (cargoSecured.length > 0) {
        selected = cargoSecured[0];
        selectionBasis = 'dry-bulk-cargo-secured-fallback';

        if (cargoSecured.length > 1) {
          warnings.push(
            'Multiple CARGO_SECURED events were found; the earliest one was used as the dry-bulk fallback completion marker.',
          );
        }

        warnings.push(
          'Dry-bulk completion evidence did not include HATCHES_CLOSED; CARGO_SECURED was used as the documented fallback terminal marker.',
        );
      }
    }
  } else if (completionType === 'tanker') {
    const hosesDisconnected = selectEarliestByEventType(ordered, 'HOSES_DISCONNECTED');

    if (hosesDisconnected.length > 0) {
      selected = hosesDisconnected[0];
      selectionBasis = 'tanker-hoses-disconnected';

      if (hosesDisconnected.length > 1) {
        warnings.push(
          'Multiple HOSES_DISCONNECTED events were found; the earliest one was used as the authoritative tanker completion marker.',
        );
      }
    } else {
      warnings.push(
        'Tanker completion evidence did not include HOSES_DISCONNECTED; legacy completion fallback was used.',
      );
    }
  }

  if (!selected) {
    const fallback = selectLatestRecognizedCompletion(ordered);

    if (!fallback) {
      throw new LaytimeEngineError(
        `No cargo completion event found in the SOF; expected one of: ${[...AUTH_COMPLETION_EVENT_TYPES].join(', ')}.`,
      );
    }

    selected = fallback;

    if (completionType === 'dry_bulk' && selectionBasis === 'legacy-completion-fallback') {
      warnings.push(
        'Dry-bulk completion evidence did not include HATCHES_CLOSED or CARGO_SECURED; legacy completion fallback was used.',
      );
    }
  }

  const excludedEventIds = ordered
    .map((event) => event.id ?? '')
    .filter((eventId) => eventId !== (selected?.id ?? ''));

  return {
    selectedEventId: selected.id ?? '',
    selectedEventType: selected.eventType,
    completionTime: selected.eventTime,
    bulkOperationType: input.bulkOperationType ?? null,
    selectionBasis,
    candidateEventIds,
    excludedEventIds,
    warnings,
  };
}
