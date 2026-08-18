export type CargoWorkingOperation = 'Loading' | 'Discharge';

export interface CargoWorkingEvent {
  id?: string | null;
  eventTime: Date;
  eventType: string;
  operation?: CargoWorkingOperation | null;
}

export interface CargoWorkingInterval {
  start: Date;
  end: Date;
  startEventId?: string;
  endEventId?: string;
}

export interface CargoWorkingIntervalsResult {
  intervals: CargoWorkingInterval[];
  warnings: string[];
}

const OPEN_EVENTS = new Set(['CARGO_STARTED', 'WORK_RESUMED']);
const CLOSE_EVENTS = new Set([
  'WORK_STOPPED',
  'BREAKDOWN',
  'STOPPAGE_START',
  'CARGO_COMPLETED',
  'LOADING_COMPLETED',
  'DISCHARGE_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
]);
const WEATHER_EVENTS = new Set([
  'RAIN_STOPPAGE',
  'RAIN_COMMENCED',
  'RAIN_STOPPED',
  'WEATHER_STOPPAGE',
  'WEATHER_CLEARED',
]);

type OrderedCargoWorkingEvent = CargoWorkingEvent & {
  __index: number;
  __priority: number;
};

function classifyPriority(eventType: string): number {
  if (CLOSE_EVENTS.has(eventType)) {
    return 0;
  }

  if (OPEN_EVENTS.has(eventType)) {
    return 1;
  }

  return 2;
}

function isCompletionEvent(eventType: string): boolean {
  return (
    eventType === 'CARGO_COMPLETED' ||
    eventType === 'LOADING_COMPLETED' ||
    eventType === 'DISCHARGE_COMPLETED' ||
    eventType === 'COMPLETION_OF_CARGO' ||
    eventType === 'HOSES_DISCONNECTED'
  );
}

function clipInterval(
  start: Date,
  end: Date,
  commencement: Date,
  completion: Date,
): CargoWorkingInterval | null {
  const clippedStart = new Date(Math.max(start.getTime(), commencement.getTime()));
  const clippedEnd = new Date(Math.min(end.getTime(), completion.getTime()));

  if (clippedEnd.getTime() <= clippedStart.getTime()) {
    return null;
  }

  return {
    start: clippedStart,
    end: clippedEnd,
  };
}

/**
 * Derives deterministic cargo-working intervals from an already selected SOF
 * event stream for one voyage operation.
 *
 * Same-timestamp order is resolved as:
 * 1. eventTime ascending
 * 2. close/completion events before open/resume events
 * 3. stable event id / original input order
 */
export function deriveCargoWorkingIntervals(
  events: CargoWorkingEvent[],
  input: {
    operation: CargoWorkingOperation;
    laytimeCommencement: Date;
    cargoCompletion: Date;
  },
): CargoWorkingIntervalsResult {
  const warnings: string[] = [];
  const intervals: CargoWorkingInterval[] = [];
  const ordered = events
    .map<OrderedCargoWorkingEvent>((event, index) => ({
      ...event,
      __index: index,
      __priority: classifyPriority(event.eventType),
    }))
    .sort((left, right) => {
      const timeDelta = left.eventTime.getTime() - right.eventTime.getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }

      const priorityDelta = left.__priority - right.__priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftId = left.id ?? '';
      const rightId = right.id ?? '';
      const idDelta = leftId.localeCompare(rightId);
      if (idDelta !== 0) {
        return idDelta;
      }

      return left.__index - right.__index;
    });

  let state: 'idle' | 'working' = 'idle';
  let hasPreviouslyStopped = false;
  let activeStart:
    | {
        start: Date;
        startEventId?: string;
      }
    | undefined;

  const closeActive = (event: OrderedCargoWorkingEvent) => {
    if (!activeStart) {
      return;
    }

    const clipped = clipInterval(
      activeStart.start,
      event.eventTime,
      input.laytimeCommencement,
      input.cargoCompletion,
    );

    if (clipped) {
      intervals.push({
        ...clipped,
        startEventId: activeStart.startEventId,
        endEventId: event.id ?? undefined,
      });
    }

    activeStart = undefined;
    state = 'idle';
  };

  const closeAtCompletionBoundary = () => {
    if (!activeStart) {
      return;
    }

    warnings.push(
      `The ${input.operation} working interval was closed at the cargo completion boundary because no explicit end event was present.`,
    );

    const clipped = clipInterval(
      activeStart.start,
      input.cargoCompletion,
      input.laytimeCommencement,
      input.cargoCompletion,
    );

    if (clipped) {
      intervals.push({
        ...clipped,
        startEventId: activeStart.startEventId,
      });
    }

    activeStart = undefined;
    state = 'idle';
  };

  for (const event of ordered) {
    if (event.eventTime.getTime() > input.cargoCompletion.getTime()) {
      continue;
    }

    if (WEATHER_EVENTS.has(event.eventType)) {
      continue;
    }

    if (isCompletionEvent(event.eventType)) {
      if (state === 'working') {
        closeActive(event);
      }
      break;
    }

    if (event.eventType === 'CARGO_STARTED') {
      if (state === 'working') {
        warnings.push(
          `Duplicate CARGO_STARTED event was ignored while the ${input.operation} operation was already working.`,
        );
        continue;
      }

      state = 'working';
      activeStart = {
        start: event.eventTime,
        startEventId: event.id ?? undefined,
      };
      continue;
    }

    if (event.eventType === 'WORK_RESUMED') {
      if (state === 'working') {
        warnings.push(
          `WORK_RESUMED event was ignored while the ${input.operation} operation was already working.`,
        );
        continue;
      }

      if (!hasPreviouslyStopped) {
        warnings.push(
          `WORK_RESUMED event was ignored because no prior stop had been seen for the ${input.operation} operation.`,
        );
        continue;
      }

      state = 'working';
      activeStart = {
        start: event.eventTime,
        startEventId: event.id ?? undefined,
      };
      continue;
    }

    if (CLOSE_EVENTS.has(event.eventType)) {
      if (state === 'idle') {
        warnings.push(
          `${event.eventType} event was ignored because no ${input.operation} work interval was open.`,
        );
        continue;
      }

      closeActive(event);
      hasPreviouslyStopped = true;
    }
  }

  if (state === 'working' && activeStart) {
    closeAtCompletionBoundary();
  }

  return {
    intervals,
    warnings,
  };
}
