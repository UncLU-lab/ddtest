import {
  EngineClause,
  EngineIgnoredException,
  EnginePeriod,
  EngineSofEvent,
  LaytimeEngineError,
  LaytimeEngineInput,
  LaytimeEngineResult,
} from './laytime.types';
import {
  deriveCargoWorkingIntervals,
  type CargoWorkingInterval,
} from './cargo-working-intervals';
import {
  intersectWorkingWithExceptedIntervals,
  type TimeInterval,
} from './interval-overlap';
import { secondsToDays } from './interval.util';
import { projectLaytimeExpiry } from './laytime-expiry-projection';
import { selectCargoCompletion } from './cargo-completion-selection';
import { resolveNorCommencementCandidate } from './nor-commencement-candidate';
import { selectCommencementRule } from './commencement-rule';
import {
  NorCommencementSchedule,
  resolveNorCommencementSchedule,
} from './nor-commencement-schedule';
import { resolveClausesForOperation } from '../charter-party-terms';
import { type SelectedWifponClause } from './free-pratique-qualification';
import { type NorLocationClauseInput } from './nor-location-qualification';
import {
  collectShexCalendarIntervals,
  LEGACY_SHEX_CALENDAR_WARNING,
  resolveShexCalendarContract,
  ShexCalendarError,
  type ShexCalendarContract,
  type ShexCalendarInterval,
} from './shex-calendar';

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
  'weather_working',
  'wibon',
  'wipon',
  'wifpon',
  'atutc',
  'nor_commencement_schedule',
]);

/** SOF events that open a stoppage (laytime exception). */
const STOPPAGE_START_EVENTS = new Set([
  'BREAKDOWN',
  'STOPPAGE_START',
  'WORK_STOPPED',
]);

/** SOF events that close an open stoppage. */
const STOPPAGE_END_EVENTS = new Set([
  'BREAKDOWN_REPAIRED',
  'STOPPAGE_END',
  'WORK_RESUMED',
]);

interface ExceptionInterval {
  start: Date;
  end: Date;
  clauseId: string | null;
  kind: 'generic' | 'weather' | 'shex';
  /** Every contractual/evidence source contributing to this canonical interval. */
  sourceKinds?: Array<'generic' | 'weather' | 'shex'>;
  calendarDates?: Array<{
    localDate: string;
    reasons: ShexCalendarInterval['reasons'];
  }>;
}

/**
 * Deterministic laytime engine (v1).
 *
 * Laytime commences a notice period after NOR, runs until cargo operations
 * complete, and is suspended for stoppages recorded in the SOF and (under a
 * SHEX clause) for contractual calendar exceptions. Countable time beyond the
 * allowed laytime becomes demurrage; time saved becomes despatch.
 */
export function runLaytimeEngine(
  input: LaytimeEngineInput,
): LaytimeEngineResult {
  const warnings: string[] = [];
  const clauses = indexClauses(input.clauses, warnings);
  const atutc = resolveAtutcState(clauses.atutc);
  const operation = input.operation ?? 'Loading';
  const wifponClause = resolveApplicableWifponClause(
    input.clauses,
    operation,
    warnings,
  );
  const wibonClause = resolveApplicableLocationClause(
    input.clauses,
    operation,
    'wibon',
    warnings,
  );
  const wiponClause = resolveApplicableLocationClause(
    input.clauses,
    operation,
    'wipon',
    warnings,
  );

  const commencement = resolveCommencement(
    input,
    clauses.laytimeRate,
    clauses.norCommencementSchedule,
    wifponClause,
    wibonClause,
    wiponClause,
    warnings,
  );
  const commencedAt = commencement.commencedAt;
  const cargoCompletion = selectCargoCompletion({
    events: input.sofEvents,
    operation: operation,
    bulkOperationType: input.bulkOperationType ?? null,
  });
  warnings.push(...cargoCompletion.warnings);
  const completedAt = cargoCompletion.completionTime;

  if (completedAt.getTime() <= commencedAt.getTime()) {
    throw new LaytimeEngineError(
      'Cargo operations completed at or before laytime commenced; check the NOR and SOF timestamps.',
    );
  }

  const allowedSeconds = resolveAllowedLaytime(
    clauses.laytimeRate,
    input.cargoQuantity,
  );

  const shexCalendar = resolveShexCalendarState(
    clauses.shex,
    commencedAt,
    completedAt,
    warnings,
  );

  const collectedExceptions = collectExceptions(
    input.sofEvents,
    shexCalendar.generatedIntervals,
    clauses.shex?.id ?? null,
    clauses.weatherWorking,
    commencedAt,
    completedAt,
    warnings,
  );

  let exceptions = sortExceptionIntervals(collectedExceptions.intervals);

  if (atutc.enabled) {
    const workingIntervals = deriveCargoWorkingIntervals(
      input.sofEvents.map((event) => ({
        ...event,
        operation,
      })),
      {
        operation,
        laytimeCommencement: commencedAt,
        cargoCompletion: completedAt,
      },
    );
    warnings.push(...workingIntervals.warnings);

    const exceptedIntervals = exceptions;
    const restoredOverlap = intersectWorkingWithExceptedIntervals(
      workingIntervals.intervals as CargoWorkingInterval[],
      exceptedIntervals as TimeInterval[],
    );
    const adjustedExceptedIntervals = subtractIntervals(
      exceptions,
      restoredOverlap.intervals,
    );

    exceptions = mergeIntervals(
      sortExceptionIntervals([...adjustedExceptedIntervals]),
    );

    atutc.applied = restoredOverlap.totalOverlapSeconds > 0;
    atutc.restoredSeconds = restoredOverlap.totalOverlapSeconds;
    atutc.restoredIntervals = restoredOverlap.intervals.map((interval) => ({
      startTime: interval.start,
      endTime: interval.end,
    }));
  } else {
    exceptions = mergeIntervals(exceptions);
  }

  const {
    periods,
    usedSeconds,
    ignoredExceptions,
    demurrageStartedAt,
    weatherDeductedSeconds,
  } = buildPeriods(commencedAt, completedAt, exceptions, allowedSeconds);
  const preDemurragePeriods = buildPreDemurragePeriods(
    commencedAt,
    completedAt,
    exceptions,
  );

  const despatchTimeBasis = resolveDespatchTimeBasis(
    clauses.despatch,
    shexCalendar.contract,
    completedAt,
    allowedSeconds,
    usedSeconds,
  );
  const { demurrageAmount, despatchAmount } = priceResult(
    usedSeconds,
    allowedSeconds,
    despatchTimeBasis.selectedSavedSeconds,
    clauses,
    warnings,
  );

  return {
    commencement,
    commencedAt,
    completedAt,
    cargoCompletion,
    demurrageStartedAt,
    weatherDeductedSeconds,
    allowedSeconds,
    usedSeconds,
    demurrageAmount,
    despatchAmount,
    periods,
    preDemurragePeriods,
    ignoredExceptions,
    shexCalendar: shexCalendar.audit,
    warnings,
    atutc,
    despatchTimeBasis,
  };
}

function resolveShexCalendarState(
  clause: EngineClause | undefined,
  commencedAt: Date,
  completedAt: Date,
  warnings: string[],
): {
  contract: ShexCalendarContract | null;
  generatedIntervals: ShexCalendarInterval[];
  audit: LaytimeEngineResult['shexCalendar'];
} {
  if (!clause) {
    return {
      contract: null,
      generatedIntervals: [],
      audit: {
        clauseId: null,
        shex: null,
        calendarVersion: null,
        operation: null,
        timeZone: null,
        saturdayExcepted: null,
        holidayDates: [],
        sourceType: 'none',
        legacyCompatibilityUsed: false,
        generatedIntervals: [],
      },
    };
  }

  try {
    const contract = resolveShexCalendarContract(clause.parameters);
    if (contract.legacyCompatibilityUsed) {
      warnings.push(LEGACY_SHEX_CALENDAR_WARNING);
    }
    const generatedIntervals = collectShexCalendarIntervals({
      contract,
      rangeStart: commencedAt,
      rangeEnd: completedAt,
    });
    return {
      contract,
      generatedIntervals,
      audit: {
        clauseId: clause.id,
        shex: contract.shex,
        calendarVersion: contract.calendarVersion,
        operation: contract.operation,
        timeZone: contract.timeZone,
        saturdayExcepted: contract.shex ? contract.saturdayExcepted : null,
        holidayDates: [...contract.holidayDates],
        sourceType: contract.sourceType,
        legacyCompatibilityUsed: contract.legacyCompatibilityUsed,
        generatedIntervals: generatedIntervals.map((interval) => ({
          startTime: new Date(interval.start),
          endTime: new Date(interval.end),
          localDate: interval.localDate,
          reasons: [...interval.reasons],
        })),
      },
    };
  } catch (error) {
    if (error instanceof ShexCalendarError) {
      throw new LaytimeEngineError(
        `The SHEX/SHINC calendar clause is invalid: ${error.message}`,
      );
    }
    throw error;
  }
}

function resolveDespatchTimeBasis(
  clause: EngineClause | undefined,
  shexCalendar: ShexCalendarContract | null,
  completedAt: Date,
  allowedSeconds: number,
  usedSeconds: number,
): LaytimeEngineResult['despatchTimeBasis'] {
  const persistedTimeBasis = clause?.parameters.timeBasis;
  const requestedTimeBasis =
    persistedTimeBasis === 'all_time_saved' ||
    persistedTimeBasis === 'working_time_saved'
      ? persistedTimeBasis
      : null;
  const effectiveTimeBasis = requestedTimeBasis ?? 'all_time_saved';
  const source = requestedTimeBasis ? 'explicit' : 'legacy-default';
  const workingTimeSavedSeconds = Math.max(allowedSeconds - usedSeconds, 0);

  if (effectiveTimeBasis === 'working_time_saved') {
    return {
      requestedTimeBasis,
      effectiveTimeBasis,
      source,
      workingTimeSavedSeconds,
      selectedSavedSeconds: workingTimeSavedSeconds,
      theoreticalExpiry: null,
      projectedExceptedIntervals: [],
    };
  }

  const projection = projectLaytimeExpiry({
    completionTime: completedAt,
    remainingCountableSeconds: workingTimeSavedSeconds,
    calendarContract: shexCalendar,
  });

  return {
    requestedTimeBasis,
    effectiveTimeBasis,
    source,
    workingTimeSavedSeconds,
    selectedSavedSeconds: projection.calendarSecondsSaved,
    theoreticalExpiry: projection.theoreticalExpiry,
    projectedExceptedIntervals: projection.projectedExceptedIntervals.map(
      (interval) => ({
        startTime: interval.start,
        endTime: interval.end,
        localDate: interval.localDate,
        reasons: [...interval.reasons],
      }),
    ),
  };
}

interface IndexedClauses {
  laytimeRate?: EngineClause;
  demurrageRate?: EngineClause;
  despatch?: EngineClause;
  shex?: EngineClause;
  weatherWorking?: EngineClause;
  wibon?: EngineClause;
  wipon?: EngineClause;
  atutc?: EngineClause;
  norCommencementSchedule?: EngineClause;
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
      case 'weather_working':
        indexed.weatherWorking ??= clause;
        break;
      case 'wibon':
        indexed.wibon ??= clause;
        break;
      case 'wipon':
        indexed.wipon ??= clause;
        break;
      case 'wifpon':
        break;
      case 'atutc':
        indexed.atutc ??= clause;
        break;
      case 'nor_commencement_schedule':
        indexed.norCommencementSchedule ??= clause;
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
      .filter(
        (clause) =>
          SUPPORTED_CLAUSE_TYPES.has(clause.clauseType) &&
          clause.clauseType !== 'wifpon',
      )
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

function resolveApplicableWifponClause(
  clauses: EngineClause[],
  operation: 'Loading' | 'Discharge',
  warnings: string[],
): SelectedWifponClause | null {
  const selected = resolveClausesForOperation(
    clauses.filter((clause) => clause.clauseType === 'wifpon'),
    operation,
    warnings,
  )[0];

  return selected
    ? {
        id: selected.id,
        clauseType: 'wifpon',
        parameters: selected.parameters,
      }
    : null;
}

function resolveApplicableLocationClause(
  clauses: EngineClause[],
  operation: 'Loading' | 'Discharge',
  clauseType: 'wibon' | 'wipon',
  warnings: string[],
): NorLocationClauseInput | null {
  const selected = resolveClausesForOperation(
    clauses.filter((clause) => clause.clauseType === clauseType),
    operation,
    warnings,
  )[0];

  return selected ? { id: selected.id, parameters: selected.parameters } : null;
}

function resolveAtutcState(
  atutcClause: EngineClause | undefined,
): LaytimeEngineResult['atutc'] {
  const enabled = readBoolean(atutcClause?.parameters, ['enabled']) === true;

  return {
    clauseId: atutcClause?.id ?? null,
    clauseParameters: atutcClause ? atutcClause.parameters : null,
    enabled,
    applied: false,
    restoredSeconds: 0,
    restoredIntervals: [],
    limitation: enabled
      ? 'ATUTC restores actual cargo-working time inside supported contractual exception periods before demurrage.'
      : 'ATUTC is not enabled by the persisted Charter Party rule.',
  };
}

function resolveCommencement(
  input: LaytimeEngineInput,
  laytimeClause: EngineClause | undefined,
  scheduleClause: EngineClause | undefined,
  wifponClause: SelectedWifponClause | null,
  wibonClause: NorLocationClauseInput | null,
  wiponClause: NorLocationClauseInput | null,
  warnings: string[],
): LaytimeEngineResult['commencement'] {
  const candidateResolution = resolveNorCommencementCandidate({
    norDocuments: input.norDocuments,
    sofEvents: input.sofEvents,
    operation: input.operation,
    wifponClause,
    voyageId: input.voyageId,
    locationEvidence: input.norTenderLocationEvidence,
    wibonClause,
    wiponClause,
  });
  for (const warning of candidateResolution.warnings) {
    if (!warnings.includes(warning)) warnings.push(warning);
  }

  if (candidateResolution.validityStatus === 'no-valid-candidate') {
    throw new LaytimeEngineError(
      'No valid NOR exists after applying NOR qualification requirements.',
    );
  }

  const selected = candidateResolution.selectedCandidate;
  if (!selected) {
    throw new LaytimeEngineError(
      'No Notice of Readiness found for this voyage; attach a NOR document or a NOR_TENDERED SOF event before calculating laytime.',
    );
  }

  const base = selected.effectiveTime;
  if (
    selected.source === 'nor-document' &&
    !selected.acceptedTime &&
    candidateResolution.validityStatus === 'unavailable'
  ) {
    warnings.push(
      'NOR has no accepted time; laytime commencement was measured from the tender time.',
    );
  }
  if (
    selected.source === 'sof-event' &&
    candidateResolution.validityStatus === 'unavailable'
  ) {
    warnings.push(
      'No NOR document found; laytime commencement was derived from the NOR_TENDERED SOF event.',
    );
  }

  const commencementRule = selectCommencementRule({
    laytimeRateClause: laytimeClause,
    norCommencementScheduleClause: scheduleClause,
  });
  if (commencementRule.rule === 'conflict') {
    throw new LaytimeEngineError(commencementRule.conflict.reason);
  }

  let commencedAt: Date;
  let noticeHours: number | null = null;
  let noticeSource: LaytimeEngineResult['commencement']['noticeSource'] = null;
  let scheduleAudit: ReturnType<typeof resolveNorCommencementSchedule> | null =
    null;
  let schedule: NorCommencementSchedule | null = null;
  let scheduleCutoffReference: LaytimeEngineResult['commencement']['scheduleCutoffReference'] =
    null;
  let scheduleGoverningTime: Date | null = null;
  let scheduleLegacyCompatibilityUsed = false;

  if (commencementRule.rule === 'notice-hours') {
    noticeHours = commencementRule.noticeHours;
    noticeSource = commencementRule.noticeSource;
    if (commencementRule.noticeSource === 'default') {
      warnings.push(
        `No notice period in the charter party; the default of ${DEFAULT_NOTICE_HOURS} hours was applied.`,
      );
    }
    commencedAt = new Date(
      base.getTime() + commencementRule.noticeHours * HOUR_SECONDS * 1000,
    );
  } else {
    schedule = readNorCommencementSchedule(scheduleClause);
    if (schedule.cutoffReference === 'tenderTime') {
      scheduleCutoffReference = 'tenderTime';
      scheduleGoverningTime = new Date(selected.tenderTime);
    } else if (schedule.cutoffReference === 'acceptedTime') {
      if (!selected.acceptedTime) {
        throw new LaytimeEngineError(
          'The NOR commencement schedule requires an acceptedTime for cutoffReference acceptedTime.',
        );
      }
      scheduleCutoffReference = 'acceptedTime';
      scheduleGoverningTime = new Date(selected.acceptedTime);
    } else {
      scheduleCutoffReference = 'legacy-effectiveTime';
      scheduleGoverningTime = new Date(base);
      scheduleLegacyCompatibilityUsed = true;
      warnings.push(
        'NOR commencement schedule has no cutoffReference; legacy effective-time cutoff behavior was preserved.',
      );
    }

    try {
      scheduleAudit = resolveNorCommencementSchedule({
        governingNorTime: scheduleGoverningTime,
        schedule,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LaytimeEngineError(
        `The NOR commencement schedule could not be applied: ${message}`,
      );
    }
    commencedAt = scheduleAudit.commencedAt;
  }

  return {
    basis:
      selected.source === 'sof-event'
        ? 'sof_nor_tendered'
        : selected.acceptedTime
          ? 'nor_accepted'
          : 'nor_tendered',
    norDocumentId: selected.norDocumentId,
    norTenderedEventId: selected.norTenderedEventId,
    tenderTime: new Date(selected.tenderTime),
    acceptedTime: selected.acceptedTime
      ? new Date(selected.acceptedTime)
      : null,
    baseTime: new Date(base),
    commencementRule: commencementRule.rule,
    noticeHours,
    noticeSource,
    scheduleClauseId: scheduleClause?.id ?? null,
    scheduleBasis: scheduleAudit?.basis ?? null,
    scheduleCutoffReference,
    scheduleGoverningTime,
    scheduleCutoffTime: schedule?.tenderCutoffTime ?? null,
    scheduleLegacyCompatibilityUsed,
    scheduleTimeZone: scheduleAudit?.timeZone ?? null,
    scheduleWorkingDays: schedule ? [...schedule.workingDays] : null,
    scheduleLocalNorDate: scheduleAudit?.localNorDate ?? null,
    scheduleLocalNorTime: scheduleAudit?.localNorTime ?? null,
    scheduleSelectedWorkingDate: scheduleAudit?.selectedWorkingDate ?? null,
    scheduleSelectedLocalCommencementTime:
      scheduleAudit?.selectedLocalCommencementTime ?? null,
    scheduleSkippedDates:
      scheduleAudit?.skippedDates.map((entry) => ({ ...entry })) ?? [],
    commencedAt,
    readinessEventId: candidateResolution.readiness.selectedEventId,
    readinessTime: candidateResolution.readiness.readinessTime
      ? new Date(candidateResolution.readiness.readinessTime)
      : null,
    readinessSource: candidateResolution.readiness.source,
    validityStatus: candidateResolution.validityStatus,
    validityBasis: selected.validityBasis,
    validityWarnings: [...candidateResolution.warnings],
    freePratique: {
      ...selected.freePratique,
      grantedTime: selected.freePratique.grantedTime
        ? new Date(selected.freePratique.grantedTime)
        : null,
      warnings: [...selected.freePratique.warnings],
    },
    location: cloneLocationAudit(selected.location),
    rejectedNorCandidates: candidateResolution.rejectedCandidates.map(
      (candidate) => ({
        ...candidate,
        tenderTime: new Date(candidate.tenderTime),
        warnings: [...candidate.warnings],
        freePratique: {
          ...candidate.freePratique,
          grantedTime: candidate.freePratique.grantedTime
            ? new Date(candidate.freePratique.grantedTime)
            : null,
          warnings: [...candidate.freePratique.warnings],
        },
      }),
    ),
    freePratiqueRejectedCandidates:
      candidateResolution.freePratiqueRejectedCandidates.map((candidate) => ({
        ...candidate,
        tenderTime: new Date(candidate.tenderTime),
        freePratique: {
          ...candidate.freePratique,
          grantedTime: candidate.freePratique.grantedTime
            ? new Date(candidate.freePratique.grantedTime)
            : null,
          warnings: [...candidate.freePratique.warnings],
        },
      })),
    locationRejectedCandidates:
      candidateResolution.locationRejectedCandidates.map((candidate) => ({
        ...candidate,
        tenderTime: new Date(candidate.tenderTime),
        rejectionReasons: [...candidate.rejectionReasons],
        location: cloneLocationAudit(candidate.location),
      })),
  };
}

function readNorCommencementSchedule(
  clause: EngineClause | undefined,
): NorCommencementSchedule {
  const parameters = clause?.parameters;
  const workingDays = parameters?.workingDays;
  if (
    !parameters ||
    (parameters.cutoffReference !== undefined &&
      parameters.cutoffReference !== 'tenderTime' &&
      parameters.cutoffReference !== 'acceptedTime') ||
    typeof parameters.tenderCutoffTime !== 'string' ||
    typeof parameters.sameDayCommencementTime !== 'string' ||
    typeof parameters.nextWorkingDayCommencementTime !== 'string' ||
    !Array.isArray(workingDays) ||
    workingDays.length === 0 ||
    !workingDays.every((day) => typeof day === 'string') ||
    typeof parameters.timeZone !== 'string'
  ) {
    throw new LaytimeEngineError(
      'The NOR commencement schedule is incomplete and cannot be applied safely.',
    );
  }

  return {
    cutoffReference:
      parameters.cutoffReference === 'tenderTime' ||
      parameters.cutoffReference === 'acceptedTime'
        ? parameters.cutoffReference
        : undefined,
    tenderCutoffTime: parameters.tenderCutoffTime,
    sameDayCommencementTime: parameters.sameDayCommencementTime,
    nextWorkingDayCommencementTime: parameters.nextWorkingDayCommencementTime,
    workingDays: workingDays as NorCommencementSchedule['workingDays'],
    timeZone: parameters.timeZone,
  };
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

interface CollectedExceptions {
  intervals: ExceptionInterval[];
}

function collectExceptions(
  sofEvents: EngineSofEvent[],
  calendarIntervals: ShexCalendarInterval[],
  shexClauseId: string | null,
  weatherWorkingClause: EngineClause | undefined,
  commencedAt: Date,
  completedAt: Date,
  warnings: string[],
): CollectedExceptions {
  const weatherWorkingEnabled =
    readBoolean(weatherWorkingClause?.parameters, ['enabled']) === true;
  const raw: ExceptionInterval[] = [
    ...collectGenericStoppages(sofEvents, completedAt, warnings),
    ...(weatherWorkingEnabled
      ? collectWeatherStoppages(sofEvents, completedAt, warnings)
      : []),
    ...calendarIntervals.map((interval) => ({
      start: interval.start,
      end: interval.end,
      clauseId: shexClauseId,
      kind: 'shex' as const,
      calendarDates: [
        { localDate: interval.localDate, reasons: [...interval.reasons] },
      ],
    })),
  ];

  const clamped = raw
    .map(({ start, end, clauseId, kind, calendarDates }) => ({
      start: new Date(Math.max(start.getTime(), commencedAt.getTime())),
      end: new Date(Math.min(end.getTime(), completedAt.getTime())),
      clauseId,
      kind,
      sourceKinds: [kind],
      calendarDates,
    }))
    .filter((interval) => interval.end.getTime() > interval.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return {
    intervals: clamped,
  };
}

function cloneLocationAudit(
  location: LaytimeEngineResult['commencement']['location'],
): LaytimeEngineResult['commencement']['location'] {
  return {
    ...location,
    selectedEvidence: location.selectedEvidence
      ? {
          ...location.selectedEvidence,
          evidenceTime: new Date(location.selectedEvidence.evidenceTime),
          createdAt: new Date(location.selectedEvidence.createdAt),
        }
      : null,
    conflictingEvidenceIds: [...location.conflictingEvidenceIds],
    ignoredUnassociatedEvidenceIds: [
      ...location.ignoredUnassociatedEvidenceIds,
    ],
    ineligibleAfterTenderEvidenceIds: [
      ...location.ineligibleAfterTenderEvidenceIds,
    ],
    berth: { ...location.berth },
    port: { ...location.port },
    warnings: [...location.warnings],
  };
}

function collectGenericStoppages(
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
      stoppages.push({
        start: openedAt,
        end: event.eventTime,
        clauseId: null,
        kind: 'generic',
        sourceKinds: ['generic'],
      });
      openedAt = null;
    }
  }

  if (openedAt) {
    warnings.push(
      'A stoppage recorded in the SOF was never closed; it was treated as lasting until cargo completion.',
    );
    stoppages.push({
      start: openedAt,
      end: completedAt,
      clauseId: null,
      kind: 'generic',
      sourceKinds: ['generic'],
    });
  }

  return stoppages;
}

function collectWeatherStoppages(
  sofEvents: EngineSofEvent[],
  completedAt: Date,
  warnings: string[],
): ExceptionInterval[] {
  const ordered = [...sofEvents].sort(
    (a, b) => a.eventTime.getTime() - b.eventTime.getTime(),
  );

  const weatherStartEvents = new Set([
    'RAIN_STOPPAGE',
    'RAIN_COMMENCED',
    'WEATHER_STOPPAGE',
  ]);
  const weatherEndEvents = new Set(['RAIN_STOPPED', 'WEATHER_CLEARED']);

  const stoppages: ExceptionInterval[] = [];
  let openedAt: Date | null = null;

  for (const event of ordered) {
    if (weatherStartEvents.has(event.eventType)) {
      openedAt ??= event.eventTime;
    } else if (weatherEndEvents.has(event.eventType) && openedAt) {
      stoppages.push({
        start: openedAt,
        end: event.eventTime,
        clauseId: null,
        kind: 'weather',
        sourceKinds: ['weather'],
      });
      openedAt = null;
    }
  }

  if (openedAt) {
    warnings.push(
      'A weather stoppage recorded in the SOF was never closed; it was treated as lasting until cargo completion.',
    );
    stoppages.push({
      start: openedAt,
      end: completedAt,
      clauseId: null,
      kind: 'weather',
      sourceKinds: ['weather'],
    });
  }

  return stoppages;
}

/**
 * Canonicalizes exception intervals into non-overlapping segments. Every
 * segment retains the complete set of rules contributing to that exact
 * second, so overlap arithmetic and audit attribution cannot diverge.
 */
function mergeIntervals(sorted: ExceptionInterval[]): ExceptionInterval[] {
  const positive = sorted.filter(
    (interval) => interval.end.getTime() > interval.start.getTime(),
  );
  const boundaries = [
    ...new Set(
      positive.flatMap((interval) => [
        interval.start.getTime(),
        interval.end.getTime(),
      ]),
    ),
  ].sort((left, right) => left - right);
  const segments: ExceptionInterval[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const active = positive.filter(
      (interval) =>
        interval.start.getTime() <= start && interval.end.getTime() >= end,
    );
    if (active.length === 0 || end <= start) continue;

    const sourceKinds = [
      ...new Set(
        active.flatMap((interval) => interval.sourceKinds ?? [interval.kind]),
      ),
    ];
    const segment: ExceptionInterval = {
      start: new Date(start),
      end: new Date(end),
      clauseId: active.find((interval) => interval.clauseId)?.clauseId ?? null,
      kind: active[0].kind,
      sourceKinds,
      calendarDates: active.reduce<ExceptionInterval['calendarDates']>(
        (dates, interval) => mergeCalendarDates(dates, interval.calendarDates),
        undefined,
      ),
    };

    const previous = segments.at(-1);
    if (
      previous &&
      previous.end.getTime() === segment.start.getTime() &&
      previous.clauseId === segment.clauseId &&
      JSON.stringify(previous.sourceKinds) ===
        JSON.stringify(segment.sourceKinds) &&
      JSON.stringify(previous.calendarDates) ===
        JSON.stringify(segment.calendarDates)
    ) {
      previous.end = segment.end;
    } else {
      segments.push(segment);
    }
  }

  return segments;
}

function mergeCalendarDates(
  left: ExceptionInterval['calendarDates'],
  right: ExceptionInterval['calendarDates'],
): ExceptionInterval['calendarDates'] {
  const merged = new Map<
    string,
    NonNullable<ExceptionInterval['calendarDates']>[number]
  >();
  for (const entry of [...(left ?? []), ...(right ?? [])]) {
    const existing = merged.get(entry.localDate);
    if (!existing) {
      merged.set(entry.localDate, {
        localDate: entry.localDate,
        reasons: [...entry.reasons],
      });
      continue;
    }
    existing.reasons = [...new Set([...existing.reasons, ...entry.reasons])];
  }
  return merged.size > 0 ? [...merged.values()] : undefined;
}

function sortExceptionIntervals(
  intervals: ExceptionInterval[],
): ExceptionInterval[] {
  return [...intervals].sort(
    (left, right) =>
      left.start.getTime() - right.start.getTime() ||
      left.end.getTime() - right.end.getTime(),
  );
}

function subtractIntervals(
  source: ExceptionInterval[],
  removals: TimeInterval[],
): ExceptionInterval[] {
  if (source.length === 0 || removals.length === 0) {
    return source.map((interval) => ({ ...interval }));
  }

  const result: ExceptionInterval[] = [];
  const orderedSource = sortExceptionIntervals(source);
  const orderedRemovals = [...removals].sort(
    (left, right) =>
      left.start.getTime() - right.start.getTime() ||
      left.end.getTime() - right.end.getTime(),
  );

  let removalIndex = 0;

  for (const interval of orderedSource) {
    while (
      removalIndex < orderedRemovals.length &&
      orderedRemovals[removalIndex].end.getTime() <= interval.start.getTime()
    ) {
      removalIndex += 1;
    }

    let cursor = interval.start;
    let currentRemovalIndex = removalIndex;

    while (currentRemovalIndex < orderedRemovals.length) {
      const removal = orderedRemovals[currentRemovalIndex];
      if (removal.start.getTime() >= interval.end.getTime()) {
        break;
      }

      const fragmentEnd = new Date(
        Math.min(removal.start.getTime(), interval.end.getTime()),
      );
      if (fragmentEnd.getTime() > cursor.getTime()) {
        result.push({
          start: new Date(cursor),
          end: fragmentEnd,
          clauseId: interval.clauseId,
          kind: interval.kind,
          sourceKinds: interval.sourceKinds,
          calendarDates: interval.calendarDates,
        });
      }

      if (removal.end.getTime() > cursor.getTime()) {
        cursor = new Date(Math.max(cursor.getTime(), removal.end.getTime()));
      }

      if (cursor.getTime() >= interval.end.getTime()) {
        break;
      }

      currentRemovalIndex += 1;
    }

    if (cursor.getTime() < interval.end.getTime()) {
      result.push({
        start: new Date(cursor),
        end: new Date(interval.end),
        clauseId: interval.clauseId,
        kind: interval.kind,
        sourceKinds: interval.sourceKinds,
        calendarDates: interval.calendarDates,
      });
    }
  }

  return result.filter(
    (interval) => interval.end.getTime() > interval.start.getTime(),
  );
}

function buildPeriods(
  commencedAt: Date,
  completedAt: Date,
  exceptions: ExceptionInterval[],
  allowedSeconds: number,
): {
  periods: EnginePeriod[];
  usedSeconds: number;
  demurrageStartedAt: Date | null;
  ignoredExceptions: EngineIgnoredException[];
  weatherDeductedSeconds: number;
} {
  const periods: EnginePeriod[] = [];
  let usedSeconds = 0;
  let cursor = commencedAt;
  let demurrageStartedAt: Date | null = null;
  const ignoredExceptions: EngineIgnoredException[] = [];
  let weatherDeductedSeconds = 0;

  const pushCountable = (start: Date, end: Date): void => {
    const segmentSeconds = (end.getTime() - start.getTime()) / 1000;
    if (segmentSeconds <= 0) {
      return;
    }

    if (demurrageStartedAt) {
      periods.push({
        startTime: start,
        endTime: end,
        periodType: 'demurrage',
        appliedClauseId: null,
      });
      usedSeconds += segmentSeconds;
      return;
    }

    const remainingAllowed = Math.max(0, allowedSeconds - usedSeconds);
    if (remainingAllowed === 0) {
      demurrageStartedAt = start;
      periods.push({
        startTime: start,
        endTime: end,
        periodType: 'demurrage',
        appliedClauseId: null,
      });
      usedSeconds += segmentSeconds;
      return;
    }

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
      demurrageStartedAt = splitAt;
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
    if (!demurrageStartedAt && usedSeconds >= allowedSeconds) {
      demurrageStartedAt = exception.start;
    }
    if (demurrageStartedAt) {
      ignoredExceptions.push({
        startTime: exception.start,
        endTime: exception.end,
        appliedClauseId: exception.clauseId,
        ...(exception.sourceKinds && exception.sourceKinds.length > 1
          ? {
              exceptionKinds: [...exception.sourceKinds],
            }
          : {}),
        calendarDates: exception.calendarDates,
      });
      periods.push({
        startTime: exception.start,
        endTime: exception.end,
        periodType: 'demurrage',
        appliedClauseId: null,
        calendarDates: exception.calendarDates,
      });
      usedSeconds +=
        (exception.end.getTime() - exception.start.getTime()) / 1000;
    } else {
      periods.push({
        startTime: exception.start,
        endTime: exception.end,
        periodType: 'exception',
        appliedClauseId: exception.clauseId,
        ...(exception.sourceKinds && exception.sourceKinds.length > 1
          ? {
              exceptionKinds: [...exception.sourceKinds],
            }
          : {}),
        calendarDates: exception.calendarDates,
      });
      if ((exception.sourceKinds ?? [exception.kind]).includes('weather')) {
        weatherDeductedSeconds +=
          (exception.end.getTime() - exception.start.getTime()) / 1000;
      }
    }
    cursor = exception.end;
  }

  pushCountable(cursor, completedAt);

  return {
    periods,
    usedSeconds,
    demurrageStartedAt,
    ignoredExceptions,
    weatherDeductedSeconds,
  };
}

function buildPreDemurragePeriods(
  commencedAt: Date,
  completedAt: Date,
  exceptions: ExceptionInterval[],
): EnginePeriod[] {
  const periods: EnginePeriod[] = [];
  let cursor = commencedAt;

  const pushCountable = (startTime: Date, endTime: Date): void => {
    if (endTime.getTime() <= startTime.getTime()) return;
    periods.push({
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      periodType: 'laytime',
      appliedClauseId: null,
    });
  };

  for (const exception of exceptions) {
    pushCountable(cursor, exception.start);
    periods.push({
      startTime: new Date(exception.start),
      endTime: new Date(exception.end),
      periodType: 'exception',
      appliedClauseId: exception.clauseId,
      exceptionKind: exception.kind,
      ...(exception.sourceKinds && exception.sourceKinds.length > 1
        ? {
            exceptionKinds: [...exception.sourceKinds],
          }
        : {}),
      calendarDates: exception.calendarDates?.map((entry) => ({
        localDate: entry.localDate,
        reasons: [...entry.reasons],
      })),
    });
    cursor = exception.end;
  }

  pushCountable(cursor, completedAt);
  return periods;
}

function priceResult(
  usedSeconds: number,
  allowedSeconds: number,
  selectedSavedSeconds: number,
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

  const savedDays = secondsToDays(selectedSavedSeconds);
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
