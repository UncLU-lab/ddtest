export const SHEX_CALENDAR_VERSION = 1 as const;
export const LEGACY_SHEX_CALENDAR_WARNING =
  'A legacy SHEX clause used historical UTC Sunday/Saturday boundaries and no named holidays; upgrade the clause to calendarVersion 1 before editing it.';

export type ShexCalendarReason =
  | 'sunday'
  | 'saturday'
  | 'contractual-holiday';

export interface ShexCalendarContract {
  shex: boolean;
  calendarVersion: 1 | null;
  operation: 'Loading' | 'Discharge' | null;
  timeZone: string | null;
  holidayDates: string[];
  saturdayExcepted: boolean;
  sourceType:
    | 'explicit-contractual-dates'
    | 'legacy-utc-calendar'
    | 'shinc';
  legacyCompatibilityUsed: boolean;
}

export interface ShexCalendarInterval {
  start: Date;
  end: Date;
  localDate: string;
  reasons: ShexCalendarReason[];
}

export class ShexCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShexCalendarError';
  }
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

interface LocalDateTimeParts extends LocalDateParts {
  hour: number;
  minute: number;
  second: number;
}

const VERSIONED_FIELDS = [
  'calendarVersion',
  'timeZone',
  'holidayDates',
] as const;
const SATURDAY_FIELDS = [
  'saturdayExcepted',
  'saturday_excepted',
  'satShex',
] as const;

export function resolveShexCalendarContract(
  parameters: Record<string, unknown>,
): ShexCalendarContract {
  if (typeof parameters.shex !== 'boolean') {
    throw new ShexCalendarError('shex must be a boolean.');
  }

  const operation = readOperation(parameters.operation);
  if (parameters.shex === false) {
    const shexOnlyField = [
      ...VERSIONED_FIELDS,
      ...SATURDAY_FIELDS,
    ].find((field) => parameters[field] !== undefined);
    if (shexOnlyField) {
      throw new ShexCalendarError(
        `${shexOnlyField} cannot be configured when shex is false (SHINC).`,
      );
    }

    return {
      shex: false,
      calendarVersion: null,
      operation,
      timeZone: null,
      holidayDates: [],
      saturdayExcepted: false,
      sourceType: 'shinc',
      legacyCompatibilityUsed: false,
    };
  }

  const hasVersionedFields = VERSIONED_FIELDS.some(
    (field) => parameters[field] !== undefined,
  );
  if (!hasVersionedFields) {
    return {
      shex: true,
      calendarVersion: null,
      operation,
      timeZone: 'UTC',
      holidayDates: [],
      saturdayExcepted: readLegacySaturday(parameters),
      sourceType: 'legacy-utc-calendar',
      legacyCompatibilityUsed: true,
    };
  }

  if (parameters.calendarVersion !== SHEX_CALENDAR_VERSION) {
    throw new ShexCalendarError(
      `calendarVersion must be ${SHEX_CALENDAR_VERSION}.`,
    );
  }
  if (!isValidIanaTimeZone(parameters.timeZone)) {
    throw new ShexCalendarError('timeZone must be a valid IANA time zone.');
  }
  if (!Array.isArray(parameters.holidayDates)) {
    throw new ShexCalendarError('holidayDates must be an array.');
  }
  if (typeof parameters.saturdayExcepted !== 'boolean') {
    throw new ShexCalendarError('saturdayExcepted must be a boolean.');
  }
  if (
    parameters.saturday_excepted !== undefined ||
    parameters.satShex !== undefined
  ) {
    throw new ShexCalendarError(
      'New SHEX calendars must use saturdayExcepted; legacy Saturday aliases are not allowed.',
    );
  }

  const holidayDates = parameters.holidayDates.map((date) => {
    if (typeof date !== 'string' || !isValidCalendarDate(date)) {
      throw new ShexCalendarError(
        'holidayDates must contain valid YYYY-MM-DD calendar dates.',
      );
    }
    return date;
  });
  if (new Set(holidayDates).size !== holidayDates.length) {
    throw new ShexCalendarError('holidayDates must not contain duplicates.');
  }

  return {
    shex: true,
    calendarVersion: SHEX_CALENDAR_VERSION,
    operation,
    timeZone: parameters.timeZone,
    holidayDates: [...holidayDates].sort(),
    saturdayExcepted: parameters.saturdayExcepted,
    sourceType: 'explicit-contractual-dates',
    legacyCompatibilityUsed: false,
  };
}

export function isValidShexClauseForWrite(
  parameters: Record<string, unknown>,
): boolean {
  try {
    const contract = resolveShexCalendarContract(parameters);
    return !contract.legacyCompatibilityUsed;
  } catch {
    return false;
  }
}

export function collectShexCalendarIntervals(input: {
  contract: ShexCalendarContract;
  rangeStart: Date;
  rangeEnd: Date;
}): ShexCalendarInterval[] {
  if (
    !input.contract.shex ||
    !input.contract.timeZone ||
    input.rangeEnd.getTime() <= input.rangeStart.getTime()
  ) {
    return [];
  }

  const intervals: ShexCalendarInterval[] = [];
  const finalLocalDate = localDateForInstant(
    input.rangeEnd,
    input.contract.timeZone,
  );
  let localDate = localDateForInstant(
    input.rangeStart,
    input.contract.timeZone,
  );
  let iterations = 0;

  while (compareLocalDates(localDate, finalLocalDate) <= 0) {
    const interval = resolveShexCalendarDay(input.contract, localDate);
    if (
      interval &&
      interval.end.getTime() > input.rangeStart.getTime() &&
      interval.start.getTime() < input.rangeEnd.getTime()
    ) {
      intervals.push(interval);
    }
    localDate = nextLocalDate(localDate);
    iterations += 1;
    if (iterations > 100_000) {
      throw new ShexCalendarError(
        'The SHEX calendar range is too large to resolve safely.',
      );
    }
  }

  return intervals;
}

export function resolveShexCalendarDay(
  contract: ShexCalendarContract,
  localDate: string,
): ShexCalendarInterval | null {
  if (!contract.shex || !contract.timeZone) {
    return null;
  }

  const date = parseCalendarDate(localDate);
  const weekday = weekdayFor(date);
  const reasons: ShexCalendarReason[] = [];
  if (weekday === 0) {
    reasons.push('sunday');
  }
  if (weekday === 6 && contract.saturdayExcepted) {
    reasons.push('saturday');
  }
  if (contract.holidayDates.includes(localDate)) {
    reasons.push('contractual-holiday');
  }
  if (reasons.length === 0) {
    return null;
  }

  return {
    start: resolveLocalMidnight(date, contract.timeZone),
    end: resolveLocalMidnight(addCalendarDays(date, 1), contract.timeZone),
    localDate,
    reasons,
  };
}

export function localDateForInstant(instant: Date, timeZone: string): string {
  return formatCalendarDate(toLocalParts(instant, timeZone));
}

export function nextLocalDate(localDate: string): string {
  return formatCalendarDate(addCalendarDays(parseCalendarDate(localDate), 1));
}

export function resolveLocalDateStart(
  localDate: string,
  timeZone: string,
): Date {
  return resolveLocalMidnight(parseCalendarDate(localDate), timeZone);
}

export function isValidIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  try {
    parseCalendarDate(value);
    return true;
  } catch {
    return false;
  }
}

function readOperation(
  value: unknown,
): 'Loading' | 'Discharge' | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === 'Loading' || value === 'Discharge') {
    return value;
  }
  throw new ShexCalendarError(
    'operation must be Loading or Discharge when provided.',
  );
}

function readLegacySaturday(parameters: Record<string, unknown>): boolean {
  const values = SATURDAY_FIELDS.filter(
    (field) => parameters[field] !== undefined,
  ).map((field) => {
    const value = parameters[field];
    if (typeof value !== 'boolean') {
      throw new ShexCalendarError(
        `Legacy ${field} must be a boolean when provided.`,
      );
    }
    return value;
  });
  if (new Set(values).size > 1) {
    throw new ShexCalendarError(
      'Legacy SHEX Saturday aliases conflict and cannot be interpreted safely.',
    );
  }
  return values[0] ?? false;
}

function parseCalendarDate(value: string): LocalDateParts {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ShexCalendarError(
      `Invalid contractual calendar date ${value}; expected YYYY-MM-DD.`,
    );
  }
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    throw new ShexCalendarError(
      `Invalid contractual calendar date ${value}.`,
    );
  }
  return { year, month, day };
}

function resolveLocalMidnight(date: LocalDateParts, timeZone: string): Date {
  const nominalUtc = Date.UTC(date.year, date.month - 1, date.day);
  const possibleOffsets = new Set<number>();

  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(nominalUtc + hours * 60 * 60 * 1000);
    const local = toLocalParts(sample, timeZone);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    possibleOffsets.add(representedAsUtc - sample.getTime());
  }

  const matches = [...possibleOffsets]
    .map((offset) => new Date(nominalUtc - offset))
    .filter((candidate) => {
      const local = toLocalParts(candidate, timeZone);
      return (
        local.year === date.year &&
        local.month === date.month &&
        local.day === date.day &&
        local.hour === 0 &&
        local.minute === 0 &&
        local.second === 0
      );
    })
    .filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.getTime() === candidate.getTime()) ===
        index,
    );

  if (matches.length === 0) {
    throw new ShexCalendarError(
      `Local midnight for ${formatCalendarDate(date)} does not exist in ${timeZone}.`,
    );
  }
  if (matches.length > 1) {
    throw new ShexCalendarError(
      `Local midnight for ${formatCalendarDate(date)} is ambiguous in ${timeZone}.`,
    );
  }
  return matches[0];
}

function toLocalParts(instant: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function addCalendarDays(date: LocalDateParts, days: number): LocalDateParts {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function weekdayFor(date: LocalDateParts): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function compareLocalDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function formatCalendarDate(date: LocalDateParts): string {
  return `${date.year.toString().padStart(4, '0')}-${date.month
    .toString()
    .padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`;
}
