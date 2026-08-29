import { describe, expect, it } from 'vitest';
import { resolveLocalDateTimeInTimeZone } from './sourceTimeZone';

describe('source timezone conversion', () => {
  it('keeps Brisbane civil time independent of browser timezone and DST', () => {
    const start = resolveLocalDateTimeInTimeZone('2026-10-02T14:30', 'Australia/Brisbane');
    const end = resolveLocalDateTimeInTimeZone('2026-10-06T14:30', 'Australia/Brisbane');
    expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(96);
  });
  it('applies real Sydney DST rules', () => {
    const start = resolveLocalDateTimeInTimeZone('2026-10-02T14:30', 'Australia/Sydney');
    const end = resolveLocalDateTimeInTimeZone('2026-10-06T14:30', 'Australia/Sydney');
    expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(95);
  });
  it('resolves operation timezones independently', () => {
    expect(resolveLocalDateTimeInTimeZone('2026-10-02T14:30', 'Asia/Singapore')).toBe('2026-10-02T06:30:00.000Z');
    expect(resolveLocalDateTimeInTimeZone('2026-10-02T14:30', 'Australia/Brisbane')).toBe('2026-10-02T04:30:00.000Z');
  });
  it('rejects invalid identifiers', () => {
    expect(() => resolveLocalDateTimeInTimeZone('2026-10-02T14:30', 'Not/AZone')).toThrow(/IANA/);
  });
});
