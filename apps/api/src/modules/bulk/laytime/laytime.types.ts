import { CalculationPeriodType } from '../entities/calculation-period.entity';
import type { BulkOperationType } from '../entities/voyage.entity';
import type {
  FreePratiqueCandidateAudit,
  FreePratiqueRejectedNorCandidate,
} from './nor-commencement-candidate';
import type { ShexCalendarReason } from './shex-calendar';
import type {
  NorLocationEvidenceInput,
  NorLocationQualificationResult,
} from './nor-location-qualification';

export interface EngineCalendarDateAudit {
  localDate: string;
  reasons: ShexCalendarReason[];
}

/** A charter-party clause reduced to what the engine needs. */
export interface EngineClause {
  id: string;
  clauseType: string;
  parameters: Record<string, unknown>;
}

/** A Notice of Readiness reduced to what the engine needs. */
export interface EngineNor {
  id?: string | null;
  tenderTime: Date;
  acceptedTime?: Date | null;
}

/** A Statement of Facts event reduced to what the engine needs. */
export interface EngineSofEvent {
  id?: string | null;
  eventTime: Date;
  eventType: string;
  operation?: 'Loading' | 'Discharge' | null;
}

export interface LaytimeEngineInput {
  /** Tenant-scoped Voyage identity used to bind persisted NOR location evidence. */
  voyageId?: string;
  /** Metric tons, from `voyages.cargo_quantity`. */
  cargoQuantity: number;
  clauses: EngineClause[];
  norDocuments: EngineNor[];
  sofEvents: EngineSofEvent[];
  norTenderLocationEvidence?: NorLocationEvidenceInput[];
  /** Voyage operation already selected for this calculation stream. */
  operation?: 'Loading' | 'Discharge';
  bulkOperationType?: BulkOperationType | null;
}

export type CargoCompletionSelectionBasis =
  | 'dry-bulk-hatches-closed'
  | 'dry-bulk-cargo-secured-fallback'
  | 'tanker-hoses-disconnected'
  | 'legacy-completion-fallback';

export interface CargoCompletionSelection {
  selectedEventId: string;
  selectedEventType: string;
  completionTime: Date;
  bulkOperationType: BulkOperationType | null;
  selectionBasis: CargoCompletionSelectionBasis;
  candidateEventIds: string[];
  excludedEventIds: string[];
  warnings: string[];
}

export interface EnginePeriod {
  startTime: Date;
  endTime: Date;
  periodType: CalculationPeriodType;
  appliedClauseId: string | null;
  /** Original exception category before once-on-demurrage treatment. */
  exceptionKind?: 'generic' | 'weather' | 'shex';
  /** All exception categories contributing to a canonical merged interval. */
  exceptionKinds?: Array<'generic' | 'weather' | 'shex'>;
  calendarDates?: EngineCalendarDateAudit[];
}

export interface EngineIgnoredException {
  startTime: Date;
  endTime: Date;
  appliedClauseId: string | null;
  exceptionKind?: 'generic' | 'weather' | 'shex';
  exceptionKinds?: Array<'generic' | 'weather' | 'shex'>;
  calendarDates?: EngineCalendarDateAudit[];
}

export interface LaytimeEngineResult {
  /** When the laytime clock started counting. */
  commencedAt: Date;
  commencement: {
    basis: 'nor_accepted' | 'nor_tendered' | 'sof_nor_tendered';
    norDocumentId: string | null;
    norTenderedEventId: string | null;
    tenderTime: Date;
    acceptedTime: Date | null;
    baseTime: Date;
    commencementRule: 'notice-hours' | 'office-schedule';
    noticeHours: number | null;
    noticeSource:
      | 'noticeHours'
      | 'notice_hours'
      | 'turnTimeHours'
      | 'default'
      | null;
    scheduleClauseId: string | null;
    scheduleBasis: 'same-day' | 'next-working-day' | null;
    scheduleCutoffReference:
      | 'tenderTime'
      | 'acceptedTime'
      | 'legacy-effectiveTime'
      | null;
    scheduleGoverningTime: Date | null;
    scheduleCutoffTime: string | null;
    scheduleLegacyCompatibilityUsed: boolean;
    scheduleTimeZone: string | null;
    scheduleWorkingDays: string[] | null;
    scheduleLocalNorDate: string | null;
    scheduleLocalNorTime: string | null;
    scheduleSelectedWorkingDate: string | null;
    scheduleSelectedLocalCommencementTime: string | null;
    scheduleSkippedDates: Array<{
      localDate: string;
      reason: 'non-working-weekday';
    }>;
    commencedAt: Date;
    readinessEventId: string | null;
    readinessTime: Date | null;
    readinessSource:
      | 'operation-specific'
      | 'legacy-null'
      | 'unscoped'
      | 'missing';
    validityStatus: 'valid' | 'unavailable';
    validityBasis: 'accepted' | 'tendered-ready' | null;
    validityWarnings: string[];
    freePratique: FreePratiqueCandidateAudit;
    location: NorLocationQualificationResult;
    rejectedNorCandidates: Array<{
      source: 'nor-document' | 'sof-event';
      norDocumentId: string | null;
      norTenderedEventId: string | null;
      tenderTime: Date;
      validityBasis: 'not-ready';
      warnings: string[];
      freePratique: FreePratiqueCandidateAudit;
    }>;
    locationRejectedCandidates: Array<{
      source: 'nor-document' | 'sof-event';
      norDocumentId: string | null;
      norTenderedEventId: string | null;
      tenderTime: Date;
      rejectionReasons: string[];
      location: NorLocationQualificationResult;
    }>;
    freePratiqueRejectedCandidates: FreePratiqueRejectedNorCandidate[];
  };
  /** When cargo operations completed. */
  completedAt: Date;
  /** How the authoritative completion event was selected. */
  cargoCompletion: CargoCompletionSelection;
  /** When the voyage first entered demurrage, if it did. */
  demurrageStartedAt: Date | null;
  /** Weather stoppage time deducted before demurrage, in seconds. */
  weatherDeductedSeconds: number;
  allowedSeconds: number;
  usedSeconds: number;
  demurrageAmount: number;
  despatchAmount: number;
  periods: EnginePeriod[];
  /** Operation timeline with contractual exceptions resolved before demurrage. */
  preDemurragePeriods: EnginePeriod[];
  /** Exceptions ignored because the vessel was already on demurrage. */
  ignoredExceptions: EngineIgnoredException[];
  /** Selected SHEX/SHINC contractual calendar and generated intervals. */
  shexCalendar: {
    clauseId: string | null;
    shex: boolean | null;
    calendarVersion: 1 | null;
    operation: 'Loading' | 'Discharge' | null;
    timeZone: string | null;
    saturdayExcepted: boolean | null;
    holidayDates: string[];
    sourceType:
      | 'explicit-contractual-dates'
      | 'legacy-utc-calendar'
      | 'shinc'
      | 'none';
    legacyCompatibilityUsed: boolean;
    generatedIntervals: Array<{
      startTime: Date;
      endTime: Date;
      localDate: string;
      reasons: ShexCalendarReason[];
    }>;
  };
  /** ATUTC state and restored SHEX overlap audit. */
  atutc: {
    clauseId: string | null;
    clauseParameters: Record<string, unknown> | null;
    enabled: boolean;
    applied: boolean;
    restoredSeconds: number;
    restoredIntervals: Array<{
      startTime: Date;
      endTime: Date;
    }>;
    limitation: string;
  };
  /** Contractual despatch time basis and selected saved-time audit. */
  despatchTimeBasis: {
    requestedTimeBasis: 'all_time_saved' | 'working_time_saved' | null;
    effectiveTimeBasis: 'all_time_saved' | 'working_time_saved';
    source: 'explicit' | 'legacy-default';
    workingTimeSavedSeconds: number;
    selectedSavedSeconds: number;
    theoreticalExpiry: Date | null;
    projectedExceptedIntervals: Array<{
      startTime: Date;
      endTime: Date;
      localDate: string;
      reasons: ShexCalendarReason[];
    }>;
  };
  /** Non-fatal notes: unsupported clauses, missing rates, applied defaults. */
  warnings: string[];
}

/** Raised when the voyage lacks the inputs needed to compute laytime at all. */
export class LaytimeEngineError extends Error {}
