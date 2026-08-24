import { EngineClause } from './laytime.types';
import { selectCommencementRule } from './commencement-rule';

function laytime(parameters: Record<string, unknown> = {}): EngineClause {
  return { id: 'laytime-rate', clauseType: 'laytime_rate', parameters };
}

function schedule(id = 'nor-schedule'): EngineClause {
  return {
    id,
    clauseType: 'nor_commencement_schedule',
    parameters: {
      cutoffReference: 'tenderTime',
      tenderCutoffTime: '12:00',
      sameDayCommencementTime: '13:00',
      nextWorkingDayCommencementTime: '08:00',
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      timeZone: 'Europe/London',
    },
  };
}

describe('selectCommencementRule', () => {
  it.each([
    ['noticeHours', 6],
    ['noticeHours', 12],
    ['notice_hours', 8],
    ['turnTimeHours', 4],
    ['noticeHours', 0],
  ] as const)('selects explicit %s=%s without a schedule', (source, value) => {
    expect(
      selectCommencementRule({
        laytimeRateClause: laytime({ [source]: value }),
      }),
    ).toEqual({
      rule: 'notice-hours',
      noticeHours: value,
      noticeSource: source,
      scheduleClauseId: null,
      conflict: null,
    });
  });

  it('uses the legacy six-hour default when no explicit notice exists', () => {
    expect(selectCommencementRule({ laytimeRateClause: laytime() })).toEqual({
      rule: 'notice-hours',
      noticeHours: 6,
      noticeSource: 'default',
      scheduleClauseId: null,
      conflict: null,
    });
  });

  it('selects the office schedule and suppresses the default notice', () => {
    expect(
      selectCommencementRule({
        laytimeRateClause: laytime(),
        norCommencementScheduleClause: schedule('schedule-audit-id'),
      }),
    ).toEqual({
      rule: 'office-schedule',
      noticeHours: null,
      noticeSource: null,
      scheduleClauseId: 'schedule-audit-id',
      conflict: null,
    });
  });

  it.each([
    ['noticeHours', 6],
    ['notice_hours', 12],
    ['turnTimeHours', 3],
  ] as const)(
    'reports a conflict for a schedule plus explicit %s',
    (source, value) => {
      const result = selectCommencementRule({
        laytimeRateClause: laytime({ [source]: value }),
        norCommencementScheduleClause: schedule(),
      });

      expect(result).toEqual({
        rule: 'conflict',
        noticeHours: value,
        noticeSource: source,
        scheduleClauseId: 'nor-schedule',
        conflict: {
          reason:
            'The Charter Party configures both explicit notice hours and a NOR commencement schedule; these alternative commencement rules cannot be applied together.',
        },
      });
    },
  );

  it('preserves existing explicit notice alias precedence', () => {
    const result = selectCommencementRule({
      laytimeRateClause: laytime({
        turnTimeHours: 3,
        notice_hours: 8,
        noticeHours: 12,
      }),
      norCommencementScheduleClause: schedule(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        rule: 'conflict',
        noticeHours: 12,
        noticeSource: 'noticeHours',
      }),
    );
  });

  it('does not mutate inputs and is deterministic', () => {
    const laytimeRateClause = laytime({ notice_hours: '6' });
    const scheduleClause = schedule();
    const originalLaytime = structuredClone(laytimeRateClause);
    const originalSchedule = structuredClone(scheduleClause);

    const first = selectCommencementRule({
      laytimeRateClause,
      norCommencementScheduleClause: scheduleClause,
    });
    const second = selectCommencementRule({
      laytimeRateClause,
      norCommencementScheduleClause: scheduleClause,
    });

    expect(first).toEqual(second);
    expect(laytimeRateClause).toEqual(originalLaytime);
    expect(scheduleClause).toEqual(originalSchedule);
  });
});
