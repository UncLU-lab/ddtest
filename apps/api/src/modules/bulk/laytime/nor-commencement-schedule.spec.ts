import {
  NorCommencementSchedule,
  NorCommencementScheduleError,
  resolveNorCommencementSchedule,
} from './nor-commencement-schedule';

const weekdays: NorCommencementSchedule['workingDays'] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
];

function schedule(
  overrides: Partial<NorCommencementSchedule> = {},
): NorCommencementSchedule {
  return {
    cutoffReference: 'tenderTime',
    tenderCutoffTime: '12:00',
    sameDayCommencementTime: '13:00',
    nextWorkingDayCommencementTime: '08:00',
    workingDays: [...weekdays],
    timeZone: 'UTC',
    ...overrides,
  };
}

describe('resolveNorCommencementSchedule', () => {
  it.each([['before cutoff', '2026-03-02T11:59:59Z']])(
    'uses same-day commencement %s',
    (_case, governingNorTime) => {
      const result = resolveNorCommencementSchedule({
        governingNorTime: new Date(governingNorTime),
        schedule: schedule(),
      });

      expect(result).toEqual({
        commencedAt: new Date('2026-03-02T13:00:00Z'),
        basis: 'same-day',
        localNorDate: '2026-03-02',
        localNorTime: '11:59:59',
        selectedWorkingDate: '2026-03-02',
        selectedLocalCommencementTime: '13:00',
        timeZone: 'UTC',
        skippedDates: [],
      });
    },
  );

  it.each([
    ['at cutoff', '2026-03-02T12:00:00Z'],
    ['after cutoff', '2026-03-02T12:00:01Z'],
  ])('uses the next working day %s', (_case, governingNorTime) => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date(governingNorTime),
      schedule: schedule(),
    });

    expect(result.commencedAt).toEqual(new Date('2026-03-03T08:00:00Z'));
    expect(result.basis).toBe('next-working-day');
    expect(result.selectedWorkingDate).toBe('2026-03-03');
  });

  it.each([
    ['Friday after cutoff', '2026-03-06T12:01:00Z'],
    ['Saturday', '2026-03-07T10:00:00Z'],
    ['Sunday', '2026-03-08T10:00:00Z'],
  ])('skips the weekend for %s', (_case, effectiveNorTime) => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date(effectiveNorTime),
      schedule: schedule(),
    });

    expect(result.commencedAt).toEqual(new Date('2026-03-09T08:00:00Z'));
    const expectedSkippedDates = effectiveNorTime.includes('06T')
      ? ['2026-03-07', '2026-03-08']
      : effectiveNorTime.includes('07T')
        ? ['2026-03-07', '2026-03-08']
        : ['2026-03-08'];
    expect(result.skippedDates.map((entry) => entry.localDate)).toEqual(
      expectedSkippedDates,
    );
  });

  it('skips Sunday when only Monday through Saturday are working', () => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date('2026-03-08T10:00:00Z'),
      schedule: schedule({ workingDays: [...weekdays, 'SAT'] }),
    });

    expect(result.commencedAt).toEqual(new Date('2026-03-09T08:00:00Z'));
    expect(result.skippedDates).toEqual([
      { localDate: '2026-03-08', reason: 'non-working-weekday' },
    ]);
  });

  it('allows Sunday when it is contractual working time', () => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date('2026-03-08T11:00:00Z'),
      schedule: schedule({ workingDays: ['SUN'] }),
    });

    expect(result.commencedAt).toEqual(new Date('2026-03-08T13:00:00Z'));
    expect(result.basis).toBe('same-day');
  });

  it('records deterministic skipped dates for a custom weekday subset', () => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date('2026-03-02T12:01:00Z'),
      schedule: schedule({ workingDays: ['THU'] }),
    });

    expect(result.selectedWorkingDate).toBe('2026-03-05');
    expect(result.skippedDates).toEqual([
      { localDate: '2026-03-02', reason: 'non-working-weekday' },
      { localDate: '2026-03-03', reason: 'non-working-weekday' },
      { localDate: '2026-03-04', reason: 'non-working-weekday' },
    ]);
  });

  it('uses the next calendar day when all seven days are working', () => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date('2026-03-06T12:01:00Z'),
      schedule: schedule({
        workingDays: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      }),
    });

    expect(result.commencedAt).toEqual(new Date('2026-03-07T08:00:00Z'));
    expect(result.skippedDates).toEqual([]);
  });

  it.each([
    ['UTC', '2026-03-02T11:00:00Z', '2026-03-02T13:00:00Z'],
    ['Europe/London', '2026-07-06T10:00:00Z', '2026-07-06T12:00:00Z'],
    ['Australia/Sydney', '2026-07-06T01:00:00Z', '2026-07-06T03:00:00Z'],
    ['Asia/Singapore', '2026-07-06T03:00:00Z', '2026-07-06T05:00:00Z'],
    ['America/New_York', '2026-07-06T15:00:00Z', '2026-07-06T17:00:00Z'],
  ])('resolves contractual local time in %s', (timeZone, nor, expected) => {
    const result = resolveNorCommencementSchedule({
      governingNorTime: new Date(nor),
      schedule: schedule({ timeZone }),
    });

    expect(result.commencedAt).toEqual(new Date(expected));
  });

  it('rejects a nonexistent spring-forward local time', () => {
    expect(() =>
      resolveNorCommencementSchedule({
        governingNorTime: new Date('2026-03-29T00:30:00Z'),
        schedule: schedule({
          timeZone: 'Europe/London',
          workingDays: ['SUN'],
          tenderCutoffTime: '00:45',
          sameDayCommencementTime: '01:30',
        }),
      }),
    ).toThrow('does not exist in Europe/London');
  });

  it('rejects an ambiguous fall-back local time', () => {
    expect(() =>
      resolveNorCommencementSchedule({
        governingNorTime: new Date('2026-10-24T23:15:00Z'),
        schedule: schedule({
          timeZone: 'Europe/London',
          workingDays: ['SUN'],
          tenderCutoffTime: '00:30',
          sameDayCommencementTime: '01:30',
        }),
      }),
    ).toThrow('is ambiguous in Europe/London');
  });

  it('rejects a same-day schedule that precedes the effective NOR', () => {
    expect(() =>
      resolveNorCommencementSchedule({
        governingNorTime: new Date('2026-03-02T11:00:00Z'),
        schedule: schedule({ sameDayCommencementTime: '10:00' }),
      }),
    ).toThrow(NorCommencementScheduleError);
  });

  it('does not mutate inputs and is deterministic', () => {
    const effectiveNorTime = new Date('2026-03-06T12:01:00Z');
    const inputSchedule = schedule();
    const timeValue = effectiveNorTime.getTime();
    const scheduleValue = structuredClone(inputSchedule);

    const first = resolveNorCommencementSchedule({
      governingNorTime: effectiveNorTime,
      schedule: inputSchedule,
    });
    const second = resolveNorCommencementSchedule({
      governingNorTime: effectiveNorTime,
      schedule: inputSchedule,
    });

    expect(first).toEqual(second);
    expect(effectiveNorTime.getTime()).toBe(timeValue);
    expect(inputSchedule).toEqual(scheduleValue);
    expect(first.commencedAt).not.toBe(effectiveNorTime);
  });
});
