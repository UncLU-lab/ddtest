import {
  EngineClause,
  EnginePeriod,
  EngineSofEvent,
  LaytimeEngineError,
  LaytimeEngineInput,
  LaytimeEngineResult,
} from './laytime.types';
import { secondsToDays } from './interval.util';

const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86_400;

/** Hours between NOR tender/acceptance and laytime commencing, absent a clause. */
const DEFAULT_NOTICE_HOURS = 6;

/** Bump when the deterministic calculation rules change. */
export const LAYTIME_ENGINE_VERSION = 'laytime-engine-v1';

/** Clause types this version of the engine understands. */
const SUPPORTED_CLAUSE_TYPES = new Set([
  'laytime_rate',
  'demurrage_rate',
  'despatch',
  'shex_shinc',
]);

/** SOF event marking NOR tender, used when no nor_documents row exists. */
const NOR_TENDERED_EVENT = 'NOR_TENDERED';

/** SOF events that end cargo operations; the last one stops the clock. */
const COMPLETION_EVENTS = new Set([
  'CARGO_COMPLETED',
  'LOADING_COMPLETED',
  'DISCHARGE_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
]);

/** SOF events that open a stoppage (laytime exception). */
const STOPPAGE_START_EVENTS = new Set([
  'RAIN_STOPPAGE',
  'RAIN_COMMENCED',
  'WEATHER_STOPPAGE',
  'BREAKDOWN',
  'STOPPAGE_START',
  'WORK_STOPPED',
]);

/** SOF events that close an open stoppage. */
const STOPPAGE_END_EVENTS = new Set([
  'RAIN_STOPPED',
  'WEATHER_CLEARED',
  'BREAKDOWN_REPAIRED',
  'STOPPAGE_END',
  'WORK_RESUMED',
]);

interface ExceptionInterval {
  start: Date;
  end: Date;
  clauseId: string | null;
}

/**
 * Deterministic laytime engine (v1).
 *
 * Laytime commences a notice period after NOR, runs until cargo operations
 * complete, and is suspended for stoppages recorded in the SOF and (under a
 * SHEX clause) for excepted weekend days. Countable time beyond the allowed
 * laytime becomes demurrage; time saved becomes despatch.
 *
 * Not yet modelled: WIBON, reversible laytime, weather working days, turn time,
 * and "once on demurrage, always on demurrage" (exceptions still suspend the
 * clock after demurrage begins — a warning is emitted when that happens).
 */
export function runLaytimeEngine(
  input: LaytimeEngineInput,
): LaytimeEngineResult {
  const warnings: string[] = [];
  const clauses = indexClauses(input.clauses, warnings);

  const commencedAt = resolveCommencement(input, clauses.laytimeRate, warnings);
  const completedAt = resolveCompletion(input.sofEvents);

  if (completedAt.getTime() <= commencedAt.getTime()) {
    throw new LaytimeEngineError(
      'Cargo operations completed at or before laytime commenced; check the NOR and SOF timestamps.',
    );
  }

  const allowedSeconds = resolveAllowedLaytime(
    clauses.laytimeRate,
    input.cargoQuantity,
  );

  const exceptions = collectExceptions(
    input.sofEvents,
    clauses.shex,
    commencedAt,
    completedAt,
    warnings,
  );

  const { periods, usedSeconds } = buildPeriods(
    commencedAt,
    completedAt,
    exceptions,
    allowedSeconds,
  );

  if (periods.some((period) => period.periodType === 'demurrage')) {
    const firstDemurrage = periods.findIndex(
      (period) => period.periodType === 'demurrage',
    );
    if (
      periods
        .slice(firstDemurrage)
        .some((period) => period.periodType === 'exception')
    ) {
      warnings.push(
        'Exceptions were applied after demurrage began; "once on demurrage, always on demurrage" is not modelled in this version.',
      );
    }
  }

  const { demurrageAmount, despatchAmount } = priceResult(
    usedSeconds,
    allowedSeconds,
    clauses,
    warnings,
  );

  return {
    commencedAt,
    completedAt,
    allowedSeconds,
    usedSeconds,
    demurrageAmount,
    despatchAmount,
    periods,
    warnings,
  };
}

interface IndexedClauses {
  laytimeRate?: EngineClause;
  demurrageRate?: EngineClause;
  despatch?: EngineClause;
  shex?: EngineClause;
}

function indexClauses(
  clauses: EngineClause[],
  warnings: string[],
): IndexedClauses {
  const indexed: IndexedClauses = {};
  const unsupported = new Set<string>();

  for (const clause of clauses) {
    switch (clause.clauseType) {
      case 'laytime_rate':
        indexed.laytimeRate ??= clause;
        break;
      case 'demurrage_rate':
        indexed.demurrageRate ??= clause;
        break;
      case 'despatch':
        indexed.despatch ??= clause;
        break;
      case 'shex_shinc':
        indexed.shex ??= clause;
        break;
      default:
        unsupported.add(clause.clauseType);
    }
  }

  for (const clauseType of unsupported) {
    warnings.push(
      `Clause type "${clauseType}" is not yet supported by the laytime engine and was ignored.`,
    );
  }

  const duplicated = new Set(
    clauses
      .filter((clause) => SUPPORTED_CLAUSE_TYPES.has(clause.clauseType))
      .map((clause) => clause.clauseType)
      .filter((type, index, all) => all.indexOf(type) !== index),
  );
  for (const clauseType of duplicated) {
    warnings.push(
      `Multiple "${clauseType}" clauses found; the first one was used.`,
    );
  }

  return indexed;
}

function resolveCommencement(
  input: LaytimeEngineInput,
  laytimeClause: EngineClause | undefined,
  warnings: string[],
): Date {
  const earliestNor = [...input.norDocuments].sort(
    (a, b) => a.tenderTime.getTime() - b.tenderTime.getTime(),
  )[0];

  let base: Date;
  if (earliestNor) {
    if (earliestNor.acceptedTime) {
      base = earliestNor.acceptedTime;
    } else {
      base = earliestNor.tenderTime;
      warnings.push(
        'NOR has no accepted time; laytime commencement was measured from the tender time.',
      );
    }
  } else {
    const tenderEvent = input.sofEvents
      .filter((event) => event.eventType === NOR_TENDERED_EVENT)
      .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())[0];

    if (!tenderEvent) {
      throw new LaytimeEngineError(
        'No Notice of Readiness found for this voyage; attach a NOR document or a NOR_TENDERED SOF event before calculating laytime.',
      );
    }

    base = tenderEvent.eventTime;
    warnings.push(
      'No NOR document found; laytime commencement was derived from the NOR_TENDERED SOF event.',
    );
  }

  const noticeHours = readNumber(laytimeClause?.parameters, [
    'noticeHours',
    'notice_hours',
    'turnTimeHours',
  ]);

  if (noticeHours === undefined) {
    warnings.push(
      `No notice period in the charter party; the default of ${DEFAULT_NOTICE_HOURS} hours was applied.`,
    );
  }

  const hours = noticeHours ?? DEFAULT_NOTICE_HOURS;

  return new Date(base.getTime() + hours * HOUR_SECONDS * 1000);
}

function resolveCompletion(sofEvents: EngineSofEvent[]): Date {
  const completion = sofEvents
    .filter((event) => COMPLETION_EVENTS.has(event.eventType))
    .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())
    .at(-1);

  if (!completion) {
    throw new LaytimeEngineError(
      'No cargo completion event found in the SOF; expected one of: ' +
        [...COMPLETION_EVENTS].join(', ') +
        '.',
    );
  }

  return completion.eventTime;
}

function resolveAllowedLaytime(
  laytimeClause: EngineClause | undefined,
  cargoQuantity: number,
): number {
  const parameters = laytimeClause?.parameters;

  const fixedHours = readNumber(parameters, ['hours']);
  if (fixedHours !== undefined) {
    return fixedHours * HOUR_SECONDS;
  }

  const fixedDays = readNumber(parameters, ['days']);
  if (fixedDays !== undefined) {
    return fixedDays * DAY_SECONDS;
  }

  const rate = readNumber(parameters, ['rate', 'ratePerDay', 'rate_per_day']);
  if (rate !== undefined && rate > 0) {
    if (cargoQuantity <= 0) {
      throw new LaytimeEngineError(
        'Cargo quantity must be greater than zero to derive allowed laytime from a daily rate.',
      );
    }
    return (cargoQuantity / rate) * DAY_SECONDS;
  }

  throw new LaytimeEngineError(
    'No usable "laytime_rate" clause found; allowed laytime needs a "rate" (MT/day), "hours", or "days" parameter.',
  );
}

function collectExceptions(
  sofEvents: EngineSofEvent[],
  shexClause: EngineClause | undefined,
  commencedAt: Date,
  completedAt: Date,
  warnings: string[],
): ExceptionInterval[] {
  const raw: ExceptionInterval[] = [
    ...collectStoppages(sofEvents, completedAt, warnings),
    ...collectExceptedDays(shexClause, commencedAt, completedAt),
  ];

  const clamped = raw
    .map(({ start, end, clauseId }) => ({
      start: new Date(Math.max(start.getTime(), commencedAt.getTime())),
      end: new Date(Math.min(end.getTime(), completedAt.getTime())),
      clauseId,
    }))
    .filter((interval) => interval.end.getTime() > interval.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return mergeIntervals(clamped);
}

function collectStoppages(
  sofEvents: EngineSofEvent[],
  completedAt: Date,
  warnings: string[],
): ExceptionInterval[] {
  const ordered = [...sofEvents].sort(
    (a, b) => a.eventTime.getTime() - b.eventTime.getTime(),
  );

  const stoppages: ExceptionInterval[] = [];
  let openedAt: Date | null = null;

  for (const event of ordered) {
    if (STOPPAGE_START_EVENTS.has(event.eventType)) {
      openedAt ??= event.eventTime;
    } else if (STOPPAGE_END_EVENTS.has(event.eventType) && openedAt) {
      stoppages.push({ start: openedAt, end: event.eventTime, clauseId: null });
      openedAt = null;
    }
  }

  if (openedAt) {
    warnings.push(
      'A stoppage recorded in the SOF was never closed; it was treated as lasting until cargo completion.',
    );
    stoppages.push({ start: openedAt, end: completedAt, clauseId: null });
  }

  return stoppages;
}

/** Whole days excepted by a SHEX clause (Sundays, and Saturdays when configured). */
function collectExceptedDays(
  shexClause: EngineClause | undefined,
  commencedAt: Date,
  completedAt: Date,
): ExceptionInterval[] {
  if (!shexClause || !readBoolean(shexClause.parameters, ['shex'])) {
    return [];
  }

  const saturdaysExcepted =
    readBoolean(shexClause.parameters, [
      'saturdayExcepted',
      'saturday_excepted',
      'satShex',
    ]) ?? false;

  const excepted: ExceptionInterval[] = [];
  const cursor = new Date(
    Date.UTC(
      commencedAt.getUTCFullYear(),
      commencedAt.getUTCMonth(),
      commencedAt.getUTCDate(),
    ),
  );

  while (cursor.getTime() < completedAt.getTime()) {
    const day = cursor.getUTCDay();
    if (day === 0 || (saturdaysExcepted && day === 6)) {
      excepted.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + DAY_SECONDS * 1000),
        clauseId: shexClause.id,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return excepted;
}

/** Unions overlapping intervals; a clause-attributed interval keeps its clause. */
function mergeIntervals(sorted: ExceptionInterval[]): ExceptionInterval[] {
  const merged: ExceptionInterval[] = [];

  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start.getTime() <= previous.end.getTime()) {
      if (interval.end.getTime() > previous.end.getTime()) {
        previous.end = interval.end;
      }
      previous.clauseId ??= interval.clauseId;
      continue;
    }
    merged.push({ ...interval });
  }

  return merged;
}

function buildPeriods(
  commencedAt: Date,
  completedAt: Date,
  exceptions: ExceptionInterval[],
  allowedSeconds: number,
): { periods: EnginePeriod[]; usedSeconds: number } {
  const periods: EnginePeriod[] = [];
  let usedSeconds = 0;
  let cursor = commencedAt;

  const pushCountable = (start: Date, end: Date): void => {
    const segmentSeconds = (end.getTime() - start.getTime()) / 1000;
    if (segmentSeconds <= 0) {
      return;
    }

    const remainingAllowed = Math.max(0, allowedSeconds - usedSeconds);
    const laytimeSeconds = Math.min(segmentSeconds, remainingAllowed);
    const splitAt = new Date(start.getTime() + laytimeSeconds * 1000);

    if (laytimeSeconds > 0) {
      periods.push({
        startTime: start,
        endTime: splitAt,
        periodType: 'laytime',
        appliedClauseId: null,
      });
    }
    if (segmentSeconds > laytimeSeconds) {
      periods.push({
        startTime: splitAt,
        endTime: end,
        periodType: 'demurrage',
        appliedClauseId: null,
      });
    }

    usedSeconds += segmentSeconds;
  };

  for (const exception of exceptions) {
    pushCountable(cursor, exception.start);
    periods.push({
      startTime: exception.start,
      endTime: exception.end,
      periodType: 'exception',
      appliedClauseId: exception.clauseId,
    });
    cursor = exception.end;
  }

  pushCountable(cursor, completedAt);

  return { periods, usedSeconds };
}

function priceResult(
  usedSeconds: number,
  allowedSeconds: number,
  clauses: IndexedClauses,
  warnings: string[],
): { demurrageAmount: number; despatchAmount: number } {
  const demurrageRate = readNumber(clauses.demurrageRate?.parameters, [
    'rate',
    'ratePerDay',
    'rate_per_day',
    'amount',
  ]);

  if (usedSeconds > allowedSeconds) {
    if (demurrageRate === undefined) {
      warnings.push(
        'Laytime was exceeded but no "demurrage_rate" clause was found; the demurrage amount is zero.',
      );
      return { demurrageAmount: 0, despatchAmount: 0 };
    }

    const excessDays = secondsToDays(usedSeconds - allowedSeconds);
    return {
      demurrageAmount: round2(excessDays * demurrageRate),
      despatchAmount: 0,
    };
  }

  const savedDays = secondsToDays(allowedSeconds - usedSeconds);
  if (savedDays === 0) {
    return { demurrageAmount: 0, despatchAmount: 0 };
  }

  if (!clauses.despatch) {
    warnings.push(
      'Laytime was saved but no "despatch" clause was found; the despatch amount is zero.',
    );
    return { demurrageAmount: 0, despatchAmount: 0 };
  }

  let despatchRate = readNumber(clauses.despatch.parameters, [
    'rate',
    'ratePerDay',
    'rate_per_day',
    'amount',
  ]);

  if (despatchRate === undefined) {
    const multiplier = readNumber(clauses.despatch.parameters, ['multiplier']);

    if (demurrageRate === undefined) {
      warnings.push(
        'The despatch clause has no rate or usable multiplier and no demurrage rate is available; the despatch amount is zero.',
      );
      return { demurrageAmount: 0, despatchAmount: 0 };
    }

    if (multiplier !== undefined) {
      despatchRate = demurrageRate * multiplier;
      warnings.push(
        `The despatch multiplier of ${multiplier} was applied to the demurrage rate.`,
      );
    } else {
      despatchRate = demurrageRate / 2;
      warnings.push(
        'The despatch clause has no rate; half the demurrage rate was applied.',
      );
    }
  }

  return {
    demurrageAmount: 0,
    despatchAmount: round2(savedDays * despatchRate),
  };
}

function readNumber(
  parameters: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined {
  if (!parameters) {
    return undefined;
  }

  for (const key of keys) {
    const value = parameters[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function readBoolean(
  parameters: Record<string, unknown> | undefined,
  keys: string[],
): boolean | undefined {
  if (!parameters) {
    return undefined;
  }

  for (const key of keys) {
    const value = parameters[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
  }

  return undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
