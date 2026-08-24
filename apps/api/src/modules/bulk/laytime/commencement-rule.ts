import { EngineClause } from './laytime.types';

const DEFAULT_NOTICE_HOURS = 6;
const NOTICE_PARAMETER_KEYS = [
  'noticeHours',
  'notice_hours',
  'turnTimeHours',
] as const;

export type ExplicitNoticeSource = (typeof NOTICE_PARAMETER_KEYS)[number];

export type CommencementRuleSelection =
  | {
      rule: 'notice-hours';
      noticeHours: number;
      noticeSource: ExplicitNoticeSource | 'default';
      scheduleClauseId: null;
      conflict: null;
    }
  | {
      rule: 'office-schedule';
      noticeHours: null;
      noticeSource: null;
      scheduleClauseId: string | null;
      conflict: null;
    }
  | {
      rule: 'conflict';
      noticeHours: number;
      noticeSource: ExplicitNoticeSource;
      scheduleClauseId: string | null;
      conflict: {
        reason: string;
      };
    };

export function selectCommencementRule(input: {
  laytimeRateClause?: EngineClause | null;
  norCommencementScheduleClause?: EngineClause | null;
}): CommencementRuleSelection {
  const explicitNotice = readExplicitNotice(
    input.laytimeRateClause?.parameters,
  );
  const schedule = input.norCommencementScheduleClause;

  if (!schedule) {
    return {
      rule: 'notice-hours',
      noticeHours: explicitNotice?.value ?? DEFAULT_NOTICE_HOURS,
      noticeSource: explicitNotice?.source ?? 'default',
      scheduleClauseId: null,
      conflict: null,
    };
  }

  if (!explicitNotice) {
    return {
      rule: 'office-schedule',
      noticeHours: null,
      noticeSource: null,
      scheduleClauseId: schedule.id ?? null,
      conflict: null,
    };
  }

  return {
    rule: 'conflict',
    noticeHours: explicitNotice.value,
    noticeSource: explicitNotice.source,
    scheduleClauseId: schedule.id ?? null,
    conflict: {
      reason:
        'The Charter Party configures both explicit notice hours and a NOR commencement schedule; these alternative commencement rules cannot be applied together.',
    },
  };
}

export function readExplicitNotice(
  parameters: Record<string, unknown> | undefined,
): { value: number; source: ExplicitNoticeSource } | null {
  if (!parameters) {
    return null;
  }

  for (const source of NOTICE_PARAMETER_KEYS) {
    const value = parameters[source];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { value, source };
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return { value: parsed, source };
      }
    }
  }

  return null;
}
