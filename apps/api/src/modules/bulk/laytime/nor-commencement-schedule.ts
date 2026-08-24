export const NOR_SCHEDULE_WEEKDAYS = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
] as const;

export type NorScheduleWeekday = (typeof NOR_SCHEDULE_WEEKDAYS)[number];
export type NorCutoffReference = 'tenderTime' | 'acceptedTime';

export interface NorCommencementSchedule {
  /** Omitted only for persisted legacy schedules interpreted by the engine. */
  cutoffReference?: NorCutoffReference;
  tenderCutoffTime: string;
  sameDayCommencementTime: string;
  nextWorkingDayCommencementTime: string;
  workingDays: NorScheduleWeekday[];
  timeZone: string;
}

export interface NorCommencementScheduleResult {
  commencedAt: Date;
  basis: 'same-day' | 'next-working-day';
  localNorDate: string;
  localNorTime: string;
  selectedWorkingDate: string;
  selectedLocalCommencementTime: string;
  timeZone: string;
  skippedDates: Array<{
    localDate: string;
    reason: 'non-working-weekday';
  }>;
}

export class NorCommencementScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NorCommencementScheduleError';
  }
}

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function resolveNorCommencementSchedule(input: {
  governingNorTime: Date;
  schedule: NorCommencementSchedule;
}): NorCommencementScheduleResult {
  const governingNorTime = new Date(input.governingNorTime);
  const schedule = input.schedule;
  const localNor = toLocalParts(governingNorTime, schedule.timeZone);
  const localNorDate = formatDate(localNor);
  const localNorTime = formatTime(localNor);
  const cutoffSeconds = parseClockSeconds(schedule.tenderCutoffTime);
  const norSeconds =
    localNor.hour * 3600 + localNor.minute * 60 + localNor.second;
  const workingDays = new Set(schedule.workingDays);
  const norDateIsWorking = workingDays.has(weekdayFor(localNor));
  const useSameDay = norDateIsWorking && norSeconds < cutoffSeconds;
  const skippedDates: NorCommencementScheduleResult['skippedDates'] = [];

  let selectedDate = {
    year: localNor.year,
    month: localNor.month,
    day: localNor.day,
  };
  let selectedLocalCommencementTime = schedule.sameDayCommencementTime;
  let basis: NorCommencementScheduleResult['basis'] = 'same-day';

  if (!useSameDay) {
    basis = 'next-working-day';
    selectedLocalCommencementTime = schedule.nextWorkingDayCommencementTime;
    if (!norDateIsWorking) {
      skippedDates.push({
        localDate: localNorDate,
        reason: 'non-working-weekday',
      });
    }

    do {
      selectedDate = addCalendarDays(selectedDate, 1);
      if (!workingDays.has(weekdayFor(selectedDate))) {
        skippedDates.push({
          localDate: formatDate(selectedDate),
          reason: 'non-working-weekday',
        });
      }
    } while (!workingDays.has(weekdayFor(selectedDate)));
  }

  const commencedAt = resolveLocalWallClock(
    selectedDate,
    selectedLocalCommencementTime,
    schedule.timeZone,
  );

  if (commencedAt.getTime() < governingNorTime.getTime()) {
    throw new NorCommencementScheduleError(
      'The contractual same-day commencement time precedes the governing NOR timestamp.',
    );
  }

  return {
    commencedAt,
    basis,
    localNorDate,
    localNorTime,
    selectedWorkingDate: formatDate(selectedDate),
    selectedLocalCommencementTime,
    timeZone: schedule.timeZone,
    skippedDates,
  };
}

function resolveLocalWallClock(
  date: Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>,
  clockTime: string,
  timeZone: string,
): Date {
  const [hour, minute] = clockTime.split(':').map(Number);
  const nominalUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    hour,
    minute,
  );
  const matches: Date[] = [];

  // Search every possible minute-offset instant; this detects both DST gaps and folds.
  for (
    let offsetMinutes = -14 * 60;
    offsetMinutes <= 14 * 60;
    offsetMinutes += 1
  ) {
    const candidate = new Date(nominalUtc - offsetMinutes * 60_000);
    const local = toLocalParts(candidate, timeZone);
    if (
      local.year === date.year &&
      local.month === date.month &&
      local.day === date.day &&
      local.hour === hour &&
      local.minute === minute &&
      local.second === 0
    ) {
      matches.push(candidate);
    }
  }

  if (matches.length === 0) {
    throw new NorCommencementScheduleError(
      `The contractual local commencement time ${formatDate(date)} ${clockTime} does not exist in ${timeZone}.`,
    );
  }
  if (matches.length > 1) {
    throw new NorCommencementScheduleError(
      `The contractual local commencement time ${formatDate(date)} ${clockTime} is ambiguous in ${timeZone}.`,
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

function parseClockSeconds(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 3600 + minute * 60;
}

function addCalendarDays<
  T extends Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>,
>(date: T, days: number) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function weekdayFor(
  date: Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>,
): NorScheduleWeekday {
  return NOR_SCHEDULE_WEEKDAYS[
    new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
  ];
}

function formatDate(
  date: Pick<LocalDateTimeParts, 'year' | 'month' | 'day'>,
): string {
  return `${date.year.toString().padStart(4, '0')}-${date.month
    .toString()
    .padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`;
}

function formatTime(
  date: Pick<LocalDateTimeParts, 'hour' | 'minute' | 'second'>,
): string {
  return [date.hour, date.minute, date.second]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':');
}
