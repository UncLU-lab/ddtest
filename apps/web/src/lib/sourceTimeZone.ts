type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function parts(value: string, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const result: Record<string, string> = {};
  for (const item of formatter.formatToParts(new Date(value))) if (item.type !== 'literal') result[item.type] = item.value;
  return { year: Number(result.year), month: Number(result.month), day: Number(result.day), hour: Number(result.hour), minute: Number(result.minute) };
}

export function isValidIanaTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return Boolean(value.trim()); } catch { return false; }
}

export function resolveLocalDateTimeInTimeZone(local: string, timeZone: string): string {
  if (!isValidIanaTimeZone(timeZone)) throw new Error('Enter a valid IANA source timezone (for example, Australia/Brisbane).');
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error('Enter a valid event time.');
  const wanted: Parts = { year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5] };
  const nominal = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const candidates: Date[] = [];
  for (let delta = -36 * 3600 * 1000; delta <= 36 * 3600 * 1000; delta += 3600 * 1000) {
    const candidate = new Date(nominal + delta);
    const actual = parts(candidate.toISOString(), timeZone);
    if (JSON.stringify(actual) === JSON.stringify(wanted) && !candidates.some((item) => item.getTime() === candidate.getTime())) candidates.push(candidate);
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Event time is ambiguous in the selected source timezone.' : 'Event time does not exist in the selected source timezone.');
  return candidates[0].toISOString();
}

export function formatDateTimeInputInTimeZone(value: string, timeZone?: string | null): string {
  if (!value) return '';
  if (!timeZone || !isValidIanaTimeZone(timeZone)) {
    const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const p = parts(value, timeZone); const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatSourceDateTime(value: string, timeZone?: string | null): string {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(timeZone && isValidIanaTimeZone(timeZone) ? { timeZone } : {}) }).format(date);
}
