const SECONDS_PER_DAY = 86_400;

/**
 * Formats a duration as a PostgreSQL `interval` literal, e.g. `3 days 12:30:00`.
 * Negative durations are not expected — the engine always works with elapsed time.
 */
export function secondsToInterval(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const rest = seconds % SECONDS_PER_DAY;
  const hh = String(Math.floor(rest / 3600)).padStart(2, '0');
  const mm = String(Math.floor((rest % 3600) / 60)).padStart(2, '0');
  const ss = String(rest % 60).padStart(2, '0');

  return `${days} days ${hh}:${mm}:${ss}`;
}

export function secondsToDays(totalSeconds: number): number {
  return totalSeconds / SECONDS_PER_DAY;
}

/** Shape `pg` returns for an `interval` column. */
interface PostgresInterval {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export function intervalToSeconds(value: PostgresInterval): number {
  const { years = 0, months = 0, days = 0 } = value;
  const { hours = 0, minutes = 0, seconds = 0, milliseconds = 0 } = value;

  // Calendar-ambiguous units are approximated; laytime intervals never use them.
  const totalDays = years * 365 + months * 30 + days;

  return (
    totalDays * SECONDS_PER_DAY +
    hours * 3600 +
    minutes * 60 +
    seconds +
    milliseconds / 1000
  );
}

/**
 * Keeps `interval` columns as strings on the way out. Without this, `pg` hands
 * back a structured object and the entity's declared `string` type is a lie.
 */
export const intervalTransformer = {
  to: (value: string | null): string | null => value,
  from: (value: PostgresInterval | string | null): string | null => {
    if (value === null || value === undefined || typeof value === 'string') {
      return value ?? null;
    }

    return secondsToInterval(intervalToSeconds(value));
  },
};
