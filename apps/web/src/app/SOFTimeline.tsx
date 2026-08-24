import { useEffect, useState } from "react";
import { useParams } from "react-router";
import {
  Plus, ArrowUpRight,
  FileText, RefreshCw, AlertTriangle, Edit2,
} from "lucide-react";
import { PageHeader } from "./Layout";
import { useShipments } from "./data/ShipmentsContext";
import {
  createSofDocument,
  createSofEvent,
  createNorTenderLocationEvidence,
  createBulkDispute,
  getLaytimeCalculations,
  getLaytimeOperationResults,
  getSofDocuments,
  getSofEvents,
  getNorTenderLocationEvidence,
  reversibleSettlementStatusLabel,
  runLaytimeCalculation,
  updateSofEvent,
  type LaytimeDecisionSnapshot,
  type LaytimeCalculation,
  type LaytimeOperationResult,
  type SofDocument,
  type SofEvent,
  type NorTenderLocationEvidence,
  type NorPortRelation,
  type NorBerthRelation,
  type NorWaitingPlace,
  type ReversibleLaytimeOperationAnalysis,
  type ReversibleSettlementStatus,
} from "../lib/api";
import { formatCurrencyAmount } from "../lib/currency";

type EventOperation = SofEvent["operation"];

type CalcRowProps = {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
};

function CalcRow({ label, value, valueColor = "#374151", bold = false }: CalcRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span style={{ fontSize: "11px", color: "#6B7280" }}>{label}</span>
      <span
        style={{
          fontSize: "11px",
          color: valueColor,
          fontWeight: bold ? 600 : 400,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

type AnnotationFlagProps = {
  evLabel: string;
  desc: string;
  color: string;
  bg: string;
};

function AnnotationFlag({ evLabel, desc, color, bg }: AnnotationFlagProps) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: bg }}>
      <p style={{ fontSize: "11px", color, fontWeight: 600, marginBottom: "3px" }}>{evLabel}</p>
      <p style={{ fontSize: "11px", color: "#374151", lineHeight: 1.45 }}>{desc}</p>
    </div>
  );
}

type EventState = "normal" | "deductible" | "pending";

type TimelineRow = {
  eventId?: string;
  eventTimeIso?: string;
  eventType?: string;
  operation?: EventOperation | null;
  remarks?: string | null;
  isManualOverride?: boolean;
  n: string;
  state: EventState;
  timestamp: string;
  name: string;
  detail: string;
  tag: string;
  tagBg: string;
  tagText: string;
  duration: string;
  cause: string;
  causeActive: boolean;
  category?: string;
  evidenceStatus?: "selected" | "excluded";
};

type ManualEventForm = {
  eventTime: string;
  eventType: string;
  operation: EventOperation;
  cause: string;
  duration: string;
  deductible: boolean;
  notes: string;
  overrideReason?: string;
};

type ManualEventDetails = {
  cause?: string;
  duration?: string;
  deductible?: boolean;
  notes?: string;
};

type LocationEvidenceForm = {
  evidenceTime: string;
  operation: "Loading" | "Discharge";
  portRelation: NorPortRelation;
  berthRelation: NorBerthRelation;
  waitingPlace: NorWaitingPlace;
  source: "MANUAL" | "SOF";
  sourceReference: string;
  note: string;
  norTenderedEventId: string;
};

function createLocationEvidenceForm(
  operation: "Loading" | "Discharge" = "Discharge",
): LocationEvidenceForm {
  return {
    evidenceTime: formatDateTimeInput(new Date().toISOString()),
    operation,
    portRelation: "UNKNOWN",
    berthRelation: "UNKNOWN",
    waitingPlace: "UNKNOWN",
    source: "MANUAL",
    sourceReference: "",
    note: "",
    norTenderedEventId: "",
  };
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const initialEvents: TimelineRow[] = [
  {
    n: "01", state: "normal", timestamp: "23 Oct 08:00", name: "NOR tendered",
    detail: "Notice of Readiness presented at pilot station",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "—", cause: "Vessel", causeActive: true,
  },
  {
    n: "02", state: "normal", timestamp: "23 Oct 14:30", name: "Laytime commences",
    detail: "6h NOR notice period expired — clock starts",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "6h 30m", cause: "Vessel", causeActive: true,
  },
  {
    n: "03", state: "normal", timestamp: "24 Oct 02:15", name: "Berthing completed",
    detail: "Fast at berth. All fast 02:15 LT",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "11h 45m", cause: "Terminal", causeActive: false,
  },
  {
    n: "04", state: "normal", timestamp: "24 Oct 04:00", name: "Loading commenced",
    detail: "First hose connected. Pumps started",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "1h 45m", cause: "Vessel", causeActive: true,
  },
  {
    n: "05", state: "deductible", timestamp: "24 Oct 11:20", name: "Rain squall — operations suspended",
    detail: "Operations halted due to adverse weather conditions",
    tag: "Deductible", tagBg: "#F3F4F6", tagText: "#374151",
    duration: "2h 30m", cause: "Weather", causeActive: true,
  },
  {
    n: "06", state: "normal", timestamp: "24 Oct 13:50", name: "Loading resumed",
    detail: "Weather cleared. Pumps restarted. Rate 12,000 MT/h",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "—", cause: "Vessel", causeActive: true,
  },
  {
    n: "07", state: "deductible", timestamp: "25 Oct 03:40", name: "Terminal breakdown — arm fault",
    detail: "Loading arm hydraulics failed. Terminal responsibility",
    tag: "Deductible", tagBg: "#F3F4F6", tagText: "#374151",
    duration: "1h 30m", cause: "Terminal", causeActive: true,
  },
  {
    n: "08", state: "normal", timestamp: "25 Oct 05:10", name: "Loading resumed",
    detail: "Arm repaired. Loading recommenced at reduced rate",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "—", cause: "Terminal", causeActive: false,
  },
  {
    n: "09", state: "normal", timestamp: "25 Oct 21:20", name: "Loading completed",
    detail: "Last hose disconnected. Final quantity: 65,000 MT",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "16h 10m", cause: "Vessel", causeActive: true,
  },
  {
    n: "10", state: "pending", timestamp: "26 Oct 00:00", name: "Completion to NOR — under review",
    detail: "Post-loading period — deductibility disputed",
    tag: "Pending", tagBg: "#FFFBEB", tagText: "#B45309",
    duration: "TBC", cause: "Disputed", causeActive: false,
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

function formatDateTimeInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
}

function intervalStringToSeconds(value?: string | null) {
  if (!value) return null;

  const match = String(value).trim().match(/^(?:(-?\d+)\s+days?\s+)?(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4]);

  if ([days, hours, minutes, seconds].some((n) => Number.isNaN(n))) {
    return null;
  }

  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
}

function formatInterval(value?: string | null) {
  const totalSeconds = intervalStringToSeconds(value);
  if (totalSeconds === null) return "—";

  const rounded = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(rounded / 86400);
  const hours = Math.floor((rounded % 86400) / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function formatSecondsAsInterval(seconds?: number | null) {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) {
    return "—";
  }

  const rounded = Math.max(0, Math.round(seconds));
  const days = Math.floor(rounded / 86400);
  const hours = Math.floor((rounded % 86400) / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function getCalculationSnapshot(
  calc?: LaytimeCalculation | null,
): LaytimeDecisionSnapshot | null {
  return (calc?.decisionSnapshot as LaytimeDecisionSnapshot | null | undefined) ?? null;
}

function getEvidenceAuditIds(calc?: LaytimeCalculation | null) {
  const snapshot = getCalculationSnapshot(calc) as any;
  const commencement = snapshot?.commencement ?? null;
  const completion = snapshot?.cargoCompletion ?? null;
  const selectedIds = new Set<string>();
  const excludedIds = new Set<string>();

  if (commencement?.readinessEventId) selectedIds.add(commencement.readinessEventId);
  if (commencement?.norTenderedEventId) selectedIds.add(commencement.norTenderedEventId);
  if (completion?.selectedEventId) selectedIds.add(completion.selectedEventId);
  for (const candidate of commencement?.rejectedNorCandidates ?? []) {
    if (candidate?.norTenderedEventId) excludedIds.add(candidate.norTenderedEventId);
  }
  for (const eventId of completion?.excludedEventIds ?? []) {
    if (eventId) excludedIds.add(eventId);
  }

  return { selectedIds, excludedIds, completion };
}

function validateDurationHours(value?: string | null) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    return "Enter a valid number of hours between 0 and 168.";
  }

  if (numeric < 0) {
    return "Duration cannot be negative.";
  }

  if (numeric > 168) {
    return "Duration cannot exceed 168 hours.";
  }

  return null;
}

function getCalculationPeriods(calc?: LaytimeCalculation | null): any[] {
  const periods = getCalculationSnapshot(calc)?.periods;
  return Array.isArray(periods) ? periods : [];
}

function getInputSnapshot(calc?: LaytimeCalculation | null) {
  return ((calc as any)?.inputSnapshot as
    | LaytimeCalculation["inputSnapshot"]
    | undefined
    | null) ?? null;
}

function getOperationResultSnapshot(
  result?: LaytimeOperationResult | null,
) {
  return ((result as any)?.inputSnapshot?.operationResult as
    | {
        source?: string | null;
        operation?: "Loading" | "Discharge" | null;
        [key: string]: unknown;
      }
    | undefined
    | null) ?? null;
}

function getSofDocumentSelectionAudit(calc?: LaytimeCalculation | null) {
  const snapshot = getInputSnapshot(calc);
  const documentSelection = snapshot?.sofDocumentSelection ?? null;

  const candidateDocumentIds = Array.isArray(documentSelection?.candidateDocumentIds)
    ? documentSelection.candidateDocumentIds
    : [];
  const includedDocumentIds = Array.isArray(documentSelection?.includedDocumentIds)
    ? documentSelection.includedDocumentIds
    : [];
  const matchingDocumentIds = Array.isArray(documentSelection?.matchingDocumentIds)
    ? documentSelection.matchingDocumentIds
    : [];
  const legacyNullDocumentIds = Array.isArray(documentSelection?.legacyNullDocumentIds)
    ? documentSelection.legacyNullDocumentIds
    : [];
  const oppositeOperationDocumentIds = Array.isArray(
    documentSelection?.oppositeOperationDocumentIds,
  )
    ? documentSelection.oppositeOperationDocumentIds
    : [];

  return {
    available: Boolean(snapshot && documentSelection),
    voyageLaytimeOperation: documentSelection?.voyageLaytimeOperation ?? null,
    candidateDocumentCount: candidateDocumentIds.length,
    includedDocumentCount: includedDocumentIds.length,
    matchingDocumentCount: matchingDocumentIds.length,
    legacyNullDocumentCount: legacyNullDocumentIds.length,
    oppositeOperationDocumentCount: oppositeOperationDocumentIds.length,
    hasLegacyNullDocuments: legacyNullDocumentIds.length > 0,
    hasOppositeOperationDocuments: oppositeOperationDocumentIds.length > 0,
  };
}

function getDemurrageAudit(calc?: LaytimeCalculation | null) {
  const snapshot = getCalculationSnapshot(calc);
  const demurrage = snapshot?.demurrage ?? null;

  return {
    startedAt: demurrage?.startedAt ?? null,
    ignoredExceptions: Array.isArray(demurrage?.ignoredExceptions)
      ? demurrage.ignoredExceptions
      : [],
  };
}

function getOperationSelectionAudit(calc?: LaytimeCalculation | null) {
  const snapshot = getInputSnapshot(calc);
  const operationSelection = snapshot?.operationSelection ?? null;

  return {
    available: Boolean(snapshot && operationSelection),
    voyageLaytimeOperation: operationSelection?.voyageLaytimeOperation ?? null,
    hasLoadingCompletion:
      typeof operationSelection?.hasLoadingCompletion === "boolean"
        ? operationSelection.hasLoadingCompletion
        : null,
    hasDischargeCompletion:
      typeof operationSelection?.hasDischargeCompletion === "boolean"
        ? operationSelection.hasDischargeCompletion
        : null,
    mixedOperationEvidence:
      typeof operationSelection?.mixedOperationEvidence === "boolean"
        ? operationSelection.mixedOperationEvidence
        : null,
    excludedCompletionCount: Array.isArray(
      operationSelection?.excludedCompletionEventIds,
    )
      ? operationSelection.excludedCompletionEventIds.length
      : null,
  };
}

function getWeatherWorkingAudit(calc?: LaytimeCalculation | null) {
  const snapshot = getCalculationSnapshot(calc);
  const weatherWorking = snapshot?.weatherWorking ?? null;

  return {
    available: Boolean(snapshot && weatherWorking),
    clauseId: weatherWorking?.clauseId ?? null,
    clauseParameters: weatherWorking?.clauseParameters ?? null,
    enabled:
      typeof weatherWorking?.enabled === "boolean"
        ? weatherWorking.enabled
        : null,
    applied:
      typeof weatherWorking?.applied === "boolean"
        ? weatherWorking.applied
        : null,
    totalWeatherTimeDeductedBeforeDemurrage:
      typeof weatherWorking?.totalWeatherTimeDeductedBeforeDemurrage === "number"
        ? weatherWorking.totalWeatherTimeDeductedBeforeDemurrage
        : null,
  };
}

function getReversibleLaytimeAudit(calc?: LaytimeCalculation | null) {
  const snapshot = getCalculationSnapshot(calc);
  const reversibleRule = snapshot?.reversibleLaytimeRule ?? null;
  const reversibleAnalysis = snapshot?.reversibleLaytimeAnalysis ?? null;
  const settlement = snapshot?.reversibleSettlement ?? null;
  const ruleEnabled =
    typeof reversibleRule?.enabled === "boolean" ? reversibleRule.enabled : null;

  const operationAnalysis = (
    allowedSeconds?: number | null,
    usedSeconds?: number | null,
    fallback?: ReversibleLaytimeOperationAnalysis | null,
  ) =>
    typeof allowedSeconds === "number" && typeof usedSeconds === "number"
      ? {
          allowedSeconds,
          usedSeconds,
          surplusSeconds: Math.max(allowedSeconds - usedSeconds, 0),
          overrunSeconds: Math.max(usedSeconds - allowedSeconds, 0),
        }
      : fallback ?? null;
  const loading = operationAnalysis(
    settlement?.loadingAllowance?.allowedSeconds,
    settlement?.loadingCountableInputSeconds,
    reversibleAnalysis?.loading,
  );
  const discharge = operationAnalysis(
    settlement?.dischargeAllowance?.allowedSeconds,
    settlement?.dischargeCountableInputSeconds,
    reversibleAnalysis?.discharge,
  );
  const pool = settlement
    ? {
        totalAllowedSeconds: settlement.combinedAllowedSeconds,
        totalUsedSeconds: settlement.combinedUsedSeconds,
        transferableSurplusSeconds:
          (loading?.surplusSeconds ?? 0) + (discharge?.surplusSeconds ?? 0),
        netPooledOverrunSeconds: settlement.combinedOverrunSeconds,
        netPooledSurplusSeconds: settlement.combinedSavedSeconds,
      }
    : reversibleAnalysis?.pool ?? null;
  const settlementStatus = settlement?.settlementStatus ?? null;

  return {
    available: Boolean(snapshot && (reversibleRule || reversibleAnalysis || settlement)),
    hasAnalysis: Boolean(reversibleAnalysis),
    statusLabel: reversibleSettlementStatusLabel(settlementStatus),
    contractRuleApplied: settlementStatus === "FINAL_AUTHORITATIVE",
    ruleEnabled,
    reason: settlement?.reason ?? reversibleAnalysis?.reason ?? null,
    note:
      settlementStatus === "FINAL_AUTHORITATIVE"
        ? "The persisted parent result is the authoritative V1 combined Loading and Discharge settlement."
        : settlement
          ? "The operation results remain available for reference, but this parent result is not a final authoritative reversible settlement."
          : reversibleAnalysis
            ? "The pooled result is analysis only and does not change the commercial settlement."
            : null,
    loading,
    discharge,
    pool,
    warnings: [
      ...(Array.isArray(settlement?.warnings) ? settlement.warnings : []),
      ...(Array.isArray(reversibleRule?.warnings) ? reversibleRule.warnings : []),
    ],
  };
}

function fileNameFromPath(filePath?: string | null) {
  if (!filePath) return "SOF document";
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

function humanizeLabel(value?: string | null) {
  if (!value) return "Event";

  const trimmed = String(value).trim();
  if (!trimmed) return "Event";

  if (trimmed.includes(" ") && /[a-z]/.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const EVENT_LABELS: Record<string, string> = {
  NOR_TENDERED: "NOR tendered",
  VESSEL_READY_IN_ALL_RESPECTS: "Vessel ready in all respects",
  FREE_PRATIQUE_GRANTED: "Free pratique granted",
  CARGO_STARTED: "Cargo started",
  CARGO_COMPLETED: "Cargo completed",
  LOADING_COMPLETED: "Loading completed",
  DISCHARGE_COMPLETED: "Discharge completed",
  COMPLETION_OF_CARGO: "Completion of cargo",
  CARGO_SECURED: "Cargo secured",
  HATCHES_CLOSED: "Hatches closed",
  HOSES_DISCONNECTED: "Hoses disconnected",
  WORK_STOPPED: "Work stopped",
  WORK_RESUMED: "Work resumed",
  BREAKDOWN: "Breakdown",
  BREAKDOWN_REPAIRED: "Breakdown repaired",
  STOPPAGE_START: "Stoppage started",
  STOPPAGE_END: "Stoppage ended",
  RAIN_STOPPAGE: "Rain stoppage",
  RAIN_STOPPED: "Rain stopped",
  WEATHER_CLEARED: "Weather cleared",
  WEATHER_STOPPAGE: "Weather stoppage",
  RAIN_COMMENCED: "Rain commenced",
};

function eventLabel(value?: string | null) {
  if (!value) return "Event";
  return EVENT_LABELS[value.trim().toUpperCase()] ?? humanizeLabel(value);
}

function eventCategory(value?: string | null) {
  const type = String(value ?? "").toUpperCase();
  if (["NOR_TENDERED", "VESSEL_READY_IN_ALL_RESPECTS", "FREE_PRATIQUE_GRANTED"].includes(type)) return "NOR / readiness";
  if (["CARGO_STARTED", "CARGO_COMPLETED", "LOADING_COMPLETED", "DISCHARGE_COMPLETED", "COMPLETION_OF_CARGO", "CARGO_SECURED", "HATCHES_CLOSED", "HOSES_DISCONNECTED"].includes(type)) return "Cargo operation";
  if (type.includes("RAIN") || type.includes("WEATHER")) return "Weather";
  if (type.includes("STOP") || type.includes("BREAKDOWN") || type.includes("RESUMED") || type.includes("REPAIRED")) return "Stoppage";
  return "Other operational evidence";
}

function formatOperationLabel(value?: string | null) {
  if (!value) return "Not set";
  return value;
}

function sofErrorMessage(error: any, fallback: string) {
  if (error?.status === 400) return "Check the event time, event type, and operation, then try again.";
  if (error?.status === 404) return "The SOF record could not be found. Refresh the timeline and try again.";
  return error?.message || fallback;
}

function normalizeEngineEventType(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  const normalized = trimmed
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    "nor tendered": "NOR_TENDERED",
    "vessel ready in all respects": "VESSEL_READY_IN_ALL_RESPECTS",
    "free pratique granted": "FREE_PRATIQUE_GRANTED",
    "free pratique": "FREE_PRATIQUE_GRANTED",
    "cargo started": "CARGO_STARTED",
    "cargo completed": "CARGO_COMPLETED",
    "loading completed": "LOADING_COMPLETED",
    "discharge completed": "DISCHARGE_COMPLETED",
    "completion of cargo": "COMPLETION_OF_CARGO",
    "hatches closed": "HATCHES_CLOSED",
    "hatch closed": "HATCHES_CLOSED",
    "hatches secured": "CARGO_SECURED",
    "cargo secured": "CARGO_SECURED",
    "hoses disconnected": "HOSES_DISCONNECTED",
    "rain stoppage": "RAIN_STOPPAGE",
    "rain commenced": "RAIN_COMMENCED",
    "rain stopped": "RAIN_STOPPED",
    "weather stoppage": "WEATHER_STOPPAGE",
    "weather cleared": "WEATHER_CLEARED",
    breakdown: "BREAKDOWN",
    "breakdown repaired": "BREAKDOWN_REPAIRED",
    "stoppage start": "STOPPAGE_START",
    "stoppage end": "STOPPAGE_END",
    "work stopped": "WORK_STOPPED",
    "work resumed": "WORK_RESUMED",
  };

  return aliases[normalized] ?? trimmed;
}

function formatDurationValue(value?: string | null) {
  if (!value) return "—";

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "—" || trimmed === "TBC") {
    return trimmed || "—";
  }

  if (/^\d+:\d{2}(:\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(":").map(Number);

    if (parts.length === 2) {
      const [hours, minutes] = parts;
      const totalMinutes = hours * 60 + minutes;
      const wholeHours = Math.floor(totalMinutes / 60);
      const remainderMinutes = totalMinutes % 60;
      return remainderMinutes > 0
        ? `${wholeHours}h ${String(remainderMinutes).padStart(2, "0")}m`
        : `${wholeHours}h`;
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      const totalMinutes = hours * 60 + minutes + Math.round(seconds / 60);
      const wholeHours = Math.floor(totalMinutes / 60);
      const remainderMinutes = totalMinutes % 60;
      return remainderMinutes > 0
        ? `${wholeHours}h ${String(remainderMinutes).padStart(2, "0")}m`
        : `${wholeHours}h`;
    }
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const hoursValue = Number(trimmed);
    if (!Number.isNaN(hoursValue)) {
      const wholeHours = Math.floor(hoursValue);
      const minutes = Math.round((hoursValue - wholeHours) * 60);
      if (minutes === 0) {
        return `${wholeHours}h`;
      }
      return `${wholeHours}h ${String(minutes).padStart(2, "0")}m`;
    }
  }

  if (/^\d+\s*(m|min|mins|minute|minutes)$/i.test(trimmed)) {
    const minutes = Number(trimmed.replace(/[^\d]/g, ""));
    if (!Number.isNaN(minutes)) {
      const wholeHours = Math.floor(minutes / 60);
      const remainderMinutes = minutes % 60;
      return remainderMinutes > 0
        ? `${wholeHours}h ${String(remainderMinutes).padStart(2, "0")}m`
        : `${wholeHours}h`;
    }
  }

  if (/^\d+\s*(s|sec|secs|second|seconds)$/i.test(trimmed)) {
    const seconds = Number(trimmed.replace(/[^\d]/g, ""));
    if (!Number.isNaN(seconds)) {
      const wholeHours = Math.floor(seconds / 3600);
      const remainderMinutes = Math.floor((seconds % 3600) / 60);
      return remainderMinutes > 0
        ? `${wholeHours}h ${String(remainderMinutes).padStart(2, "0")}m`
        : `${wholeHours}h`;
    }
  }

  return trimmed;
}

const ENGINE_EVENT_PRESETS = [
  { value: "NOR_TENDERED", label: "NOR tendered" },
  { value: "VESSEL_READY_IN_ALL_RESPECTS", label: "Vessel ready in all respects" },
  { value: "FREE_PRATIQUE_GRANTED", label: "Free pratique granted" },
  { value: "CARGO_STARTED", label: "Cargo started" },
  { value: "CARGO_COMPLETED", label: "Cargo completed" },
  { value: "LOADING_COMPLETED", label: "Loading completed" },
  { value: "DISCHARGE_COMPLETED", label: "Discharge completed" },
  { value: "COMPLETION_OF_CARGO", label: "Completion of cargo" },
  { value: "HATCHES_CLOSED", label: "Hatches closed" },
  { value: "CARGO_SECURED", label: "Cargo secured" },
  { value: "HOSES_DISCONNECTED", label: "Hoses disconnected" },
  { value: "WORK_STOPPED", label: "Work stopped" },
  { value: "WORK_RESUMED", label: "Work resumed" },
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "BREAKDOWN_REPAIRED", label: "Breakdown repaired" },
  { value: "STOPPAGE_START", label: "Stoppage started" },
  { value: "STOPPAGE_END", label: "Stoppage ended" },
  { value: "RAIN_STOPPAGE", label: "Rain stoppage" },
  { value: "RAIN_STOPPED", label: "Rain stopped" },
  { value: "WEATHER_CLEARED", label: "Weather cleared" },
] as const;

function parseManualDetails(remarks?: string | null): ManualEventDetails | null {
  if (!remarks) return null;

  try {
    const parsed = JSON.parse(remarks);
    if (parsed && typeof parsed === "object") {
      return parsed as ManualEventDetails;
    }
  } catch {
    // Fall through to plain-text handling.
  }

  return null;
}

function buildManualDetails(details: ManualEventDetails) {
  return JSON.stringify(details);
}

function inferCause(eventType: string, parsed: ManualEventDetails | null) {
  if (parsed?.cause) return parsed.cause;

  const value = eventType.toLowerCase();
  if (value.includes("rain") || value.includes("weather") || value.includes("storm")) {
    return "Weather";
  }
  if (value.includes("breakdown") || value.includes("fault") || value.includes("terminal") || value.includes("shutdown")) {
    return "Terminal";
  }
  if (value.includes("nor") || value.includes("loading") || value.includes("commence") || value.includes("resume") || value.includes("complete")) {
    return "Vessel";
  }
  if (value.includes("review") || value.includes("dispute") || value.includes("pending")) {
    return "Disputed";
  }

  return "Vessel";
}

function inferState(eventType: string, parsed: ManualEventDetails | null, isManualOverride: boolean): EventState {
  if (parsed?.deductible) return "deductible";

  const value = `${eventType} ${parsed?.notes ?? ""}`.toLowerCase();
  if (value.includes("pending") || value.includes("review") || value.includes("dispute")) {
    return "pending";
  }
  if (value.includes("rain") || value.includes("weather") || value.includes("breakdown") || value.includes("fault") || value.includes("stoppage") || value.includes("halt")) {
    return "deductible";
  }

  return isManualOverride ? "pending" : "normal";
}

function inferDetail(eventType: string, parsed: ManualEventDetails | null, isManualOverride: boolean, remarks?: string | null) {
  if (parsed?.notes?.trim()) return parsed.notes.trim();
  if (remarks && !parseManualDetails(remarks)) return remarks;
  if (isManualOverride) return "Manually logged event";
  return `Persisted SOF event: ${humanizeLabel(eventType)}`;
}

function toTimelineRow(event: SofEvent, index: number): TimelineRow {
  const parsed = parseManualDetails(event.remarks);
  const state = inferState(event.eventType, parsed, event.isManualOverride);
  const cause = inferCause(event.eventType, parsed);
  const duration = formatDurationValue(parsed?.duration);

  return {
    eventId: event.id,
    eventTimeIso: event.eventTime,
    eventType: event.eventType,
    operation: event.operation ?? null,
    remarks: event.remarks,
    isManualOverride: event.isManualOverride,
    n: String(index + 1).padStart(2, "0"),
    state,
    timestamp: formatDateTime(event.eventTime),
    name: eventLabel(event.eventType),
    detail: inferDetail(event.eventType, parsed, event.isManualOverride, event.remarks),
    tag:
      state === "deductible"
        ? "Deductible"
        : state === "pending"
          ? "Pending"
          : "Counting",
    tagBg:
      state === "deductible"
        ? "#F3F4F6"
        : state === "pending"
          ? "#FFFBEB"
          : "#EFF6FF",
    tagText:
      state === "deductible"
        ? "#374151"
        : state === "pending"
          ? "#B45309"
          : "#1E40AF",
    duration,
    cause,
    causeActive: cause !== "Disputed",
    category: eventCategory(event.eventType),
  };
}

function documentStatusLabel(document?: SofDocument | null) {
  if (!document) return "No SOF";
  return document.status;
}

function documentStatusBg(document?: SofDocument | null) {
  if (!document) return "#F3F4F6";
  return document.status === "Final" ? "#C6F6D5" : "#FEF3C7";
}

function documentStatusText(document?: SofDocument | null) {
  if (!document) return "#374151";
  return document.status === "Final" ? "#22543D" : "#92400E";
}

// ─── Laytime Bar ──────────────────────────────────────────────────────────────

function LaytimeBar() {
  const segments = [
    { pct: 81, color: "#3B82F6", label: null },
    { pct: 3.5, color: "#D1D5DB", label: null },
    { pct: 2, color: "#D1D5DB", label: null },
    { pct: 13.5, color: "#E5E7EB", label: null },
  ];
  return (
    <div>
      <div className="flex rounded-full overflow-hidden mb-2" style={{ height: "10px", backgroundColor: "#F3F4F6" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="flex justify-between mb-3">
        {["23 Oct 08:00", "24 Oct 00:00", "25 Oct 00:00", "26 Oct 00:00"].map((d) => (
          <span key={d} style={{ fontSize: "9px", color: "#9CA3AF" }}>{d}</span>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {[
          { color: "#3B82F6", label: "Counting" },
          { color: "#D1D5DB", label: "Deductible" },
          { color: "#E5E7EB", label: "Remaining" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="rounded-sm flex-shrink-0" style={{ width: "8px", height: "8px", backgroundColor: item.color }} />
            <span style={{ fontSize: "11px", color: "#6B7280" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type AddEventModalProps = {
  mode: "add" | "edit";
  event: TimelineRow | null;
  defaultOperation: EventOperation;
  onClose: () => void;
  onSave: (form: ManualEventForm) => void;
  submitting: boolean;
};

function AddEventModal({
  mode,
  event,
  defaultOperation,
  onClose,
  onSave,
  submitting,
}: AddEventModalProps) {
  const getInitialForm = (): ManualEventForm => ({
    eventTime: formatDateTimeInput(event?.eventTimeIso ?? new Date().toISOString()),
    eventType: event?.eventType ?? ENGINE_EVENT_PRESETS[0].value,
    operation: (event?.operation ?? defaultOperation) as EventOperation,
    cause: event?.cause ?? "Vessel",
    duration: event?.duration && event.duration !== "â€”" ? event.duration : "",
    deductible: event?.state === "deductible",
    notes: event?.detail ?? "",
    overrideReason: "",
  });

  const [form, setForm] = useState<ManualEventForm>(getInitialForm);

  useEffect(() => {
    setForm(getInitialForm());
    // The modal only mounts when opened, but syncing keeps edit flows predictable.
  }, [event, defaultOperation, mode]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-white shadow-xl"
        style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#E5E7EB" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>
              {mode === "edit" ? "Edit SOF event" : "Add SOF event"}
            </h2>
            <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
              Manual SOF entry only. Calculation behavior is unchanged.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm"
            style={{ color: "#6B7280" }}
          >
            Close
          </button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <div>
            <label htmlFor="sof-event-time" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
              Event time
            </label>
            <input
              id="sof-event-time"
              type="datetime-local"
              value={form.eventTime}
              onChange={(e) => setForm((current) => ({ ...current, eventTime: e.target.value }))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: "#D1D5DB" }}
            />
          </div>

          <div>
            <label htmlFor="sof-event-type" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
              Event type
            </label>
            <select
              id="sof-event-type"
              value={form.eventType}
              onChange={(e) => setForm((current) => ({ ...current, eventType: e.target.value }))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: "#D1D5DB", backgroundColor: "#ffffff" }}
            >
              {ENGINE_EVENT_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sof-event-operation" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
              Operation
            </label>
            <select
              id="sof-event-operation"
              value={form.operation}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  operation: e.target.value ? e.target.value as EventOperation : null,
                }))
              }
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: "#D1D5DB", backgroundColor: "#ffffff" }}
            >
              <option value="">Global / not operation-specific</option>
              <option value="Loading">Loading</option>
              <option value="Discharge">Discharge</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sof-event-cause" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
                Cause
              </label>
              <input
                id="sof-event-cause"
                type="text"
                value={form.cause}
                onChange={(e) => setForm((current) => ({ ...current, cause: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "#D1D5DB" }}
              />
            </div>
            <div>
              <label htmlFor="sof-event-duration" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
                Duration (hours)
              </label>
              <input
                id="sof-event-duration"
                type="number"
                min="0"
                max="168"
                step="0.01"
                placeholder="e.g. 2.5"
                value={form.duration}
                onChange={(e) => setForm((current) => ({ ...current, duration: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "#D1D5DB" }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: "#374151" }}>
            <input
              type="checkbox"
              checked={form.deductible}
              onChange={(e) => setForm((current) => ({ ...current, deductible: e.target.checked }))}
            />
            Mark as deductible
          </label>

          <div>
            <label htmlFor="sof-event-notes" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
              Notes
            </label>
            <textarea
              id="sof-event-notes"
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: "#D1D5DB", minHeight: "84px" }}
            />
          </div>

          {mode === "edit" && (
            <div>
              <label htmlFor="sof-event-override" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
                Override reason
              </label>
              <textarea
                id="sof-event-override"
                value={form.overrideReason ?? ""}
                onChange={(e) => setForm((current) => ({ ...current, overrideReason: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "#D1D5DB", minHeight: "72px" }}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-4" style={{ borderColor: "#E5E7EB" }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "#D1D5DB", color: "#374151", backgroundColor: "#ffffff" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm text-white"
              style={{ backgroundColor: "#1A4ED8", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Saving..." : "Save event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SOFTimeline() {
  const { id } = useParams();
  const { getShipmentById } = useShipments();
  const shipment = getShipmentById(id);

  const [documents, setDocuments] = useState<SofDocument[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingEvent, setSavingEvent] = useState(false);
  const [laytimeCalculation, setLaytimeCalculation] = useState<LaytimeCalculation | null>(null);
  const [laytimeLoading, setLaytimeLoading] = useState(true);
  const [laytimeError, setLaytimeError] = useState<string | null>(null);
  const [laytimeRunning, setLaytimeRunning] = useState(false);
  const [laytimeWarnings, setLaytimeWarnings] = useState<string[]>([]);
  const [operationResults, setOperationResults] = useState<LaytimeOperationResult[]>([]);
  const [operationResultsLoading, setOperationResultsLoading] = useState(false);
  const [operationResultsError, setOperationResultsError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimRunning, setClaimRunning] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [timelineSuccess, setTimelineSuccess] = useState<string | null>(null);
  const [locationEvidence, setLocationEvidence] = useState<NorTenderLocationEvidence[]>([]);
  const [locationEvidenceLoading, setLocationEvidenceLoading] = useState(true);
  const [locationEvidenceError, setLocationEvidenceError] = useState<string | null>(null);
  const [showLocationEvidenceForm, setShowLocationEvidenceForm] = useState(false);
  const [savingLocationEvidence, setSavingLocationEvidence] = useState(false);
  const [locationEvidenceForm, setLocationEvidenceForm] =
    useState<LocationEvidenceForm>(() => createLocationEvidenceForm());

  useEffect(() => {
    let alive = true;

    async function loadTimeline() {
      if (!id) {
        if (alive) {
          setDocuments([]);
          setTimelineEvents([]);
          setTimelineLoading(false);
        }
        return;
      }

      setTimelineLoading(true);
      setTimelineError(null);

      try {
        const documentsResponse = await getSofDocuments(id, { page: 1, limit: 50 });
        if (!alive) return;

        const sortedDocuments = [...(documentsResponse.data ?? [])].sort((a, b) => {
          const aScore = a.status === "Final" ? 1 : 0;
          const bScore = b.status === "Final" ? 1 : 0;
          if (aScore !== bScore) return bScore - aScore;
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        });

        setDocuments(sortedDocuments);

        const activeDocument = sortedDocuments[0];
        if (!activeDocument) {
          setTimelineEvents([]);
          return;
        }

        const eventsResponse = await getSofEvents(activeDocument.id, { page: 1, limit: 200 });
        if (!alive) return;

        const mappedEvents = (eventsResponse.data ?? [])
          .slice()
          .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())
          .map((event, index) => toTimelineRow(event, index));

        setTimelineEvents(mappedEvents);
      } catch (error: any) {
        if (!alive) return;
        setDocuments([]);
        setTimelineEvents([]);
        setTimelineError(sofErrorMessage(error, "Unable to load the Statement of Facts timeline."));
      } finally {
        if (alive) {
          setTimelineLoading(false);
        }
      }
    }

    void loadTimeline();

    return () => {
      alive = false;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    let alive = true;

    async function loadLocationEvidence() {
      if (!id) {
        if (alive) {
          setLocationEvidence([]);
          setLocationEvidenceLoading(false);
        }
        return;
      }

      setLocationEvidenceLoading(true);
      setLocationEvidenceError(null);
      try {
        const response = await getNorTenderLocationEvidence(id, {
          page: 1,
          limit: 200,
        });
        if (alive) setLocationEvidence(response.data ?? []);
      } catch (error: any) {
        if (alive) {
          setLocationEvidence([]);
          setLocationEvidenceError(
            error?.message ?? "Unable to load NOR tender-location evidence.",
          );
        }
      } finally {
        if (alive) setLocationEvidenceLoading(false);
      }
    }

    void loadLocationEvidence();
    return () => {
      alive = false;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    let alive = true;

    async function loadLaytimeCalculation() {
      if (!id) {
        if (alive) {
          setLaytimeCalculation(null);
          setLaytimeWarnings([]);
          setLaytimeLoading(false);
        }
        return;
      }

      setLaytimeLoading(true);
      setLaytimeError(null);

      try {
        const result = await getLaytimeCalculations(id, { page: 1, limit: 1 });
        if (!alive) return;

        const latest = result.data?.[0] ?? null;
        setLaytimeCalculation(latest);
        setLaytimeWarnings((latest as any)?.warnings ?? []);
      } catch (error: any) {
        if (!alive) return;
        setLaytimeCalculation(null);
        setLaytimeWarnings([]);
        setLaytimeError(error?.message ?? "Unable to load laytime calculation.");
      } finally {
        if (alive) {
          setLaytimeLoading(false);
        }
      }
    }

    void loadLaytimeCalculation();

    return () => {
      alive = false;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    let alive = true;

    async function loadOperationResults() {
      if (!laytimeCalculation?.id) {
        if (alive) {
          setOperationResults([]);
          setOperationResultsError(null);
          setOperationResultsLoading(false);
        }
        return;
      }

      setOperationResultsLoading(true);
      setOperationResultsError(null);

      try {
        const results = await getLaytimeOperationResults(laytimeCalculation.id);
        if (!alive) return;

        setOperationResults(results);
      } catch (error: any) {
        if (!alive) return;

        setOperationResults([]);
        setOperationResultsError(
          error?.message ?? "Unable to load operation results.",
        );
      } finally {
        if (alive) {
          setOperationResultsLoading(false);
        }
      }
    }

    void loadOperationResults();

    return () => {
      alive = false;
    };
  }, [laytimeCalculation?.id]);

  const activeDocument = documents[0] ?? null;
  const evidenceAudit = getEvidenceAuditIds(laytimeCalculation);
  const displayEvents = (id ? timelineEvents : initialEvents).map((event) => ({
    ...event,
    evidenceStatus: event.eventId && evidenceAudit.selectedIds.has(event.eventId)
      ? "selected" as const
      : event.eventId && evidenceAudit.excludedIds.has(event.eventId)
        ? "excluded" as const
        : undefined,
  }));
  const eventCounts = displayEvents.reduce(
    (acc, ev) => {
      acc[ev.state] += 1;
      return acc;
    },
    { normal: 0, deductible: 0, pending: 0 } as Record<EventState, number>
  );

  const voyageLabel = shipment
    ? `${shipment.vessel} · ${shipment.id}`
    : id
      ? `Voyage ${id}`
      : "Voyage";

  async function handleSaveEvent(form: ManualEventForm, editTarget?: TimelineRow | null) {
    if (!id) return;

    setSavingEvent(true);
    setTimelineError(null);
    setTimelineSuccess(null);

    const durationError = validateDurationHours(form.duration);
    if (durationError) {
      setTimelineError(durationError);
      setSavingEvent(false);
      return;
    }

    try {
      let targetDocument = activeDocument;

      if (!targetDocument) {
        targetDocument = await createSofDocument(id, {
          filePath: `voyages/${id}/statement-of-facts.pdf`,
          status: "Draft",
        });
      }

      const payload = {
        eventTime: new Date(form.eventTime).toISOString(),
        eventType: form.eventType.trim(),
        ...(form.operation ? { operation: form.operation } : {}),
        remarks: buildManualDetails({
          cause: form.cause,
          duration: form.duration || undefined,
          deductible: form.deductible,
          notes: form.notes || undefined,
        }),
      };

      if (editTarget) {
        if (!editTarget.eventId) {
          throw new Error("Unable to edit this event.");
        }

        const overrideReason = form.overrideReason?.trim();
        const nextEventTime = payload.eventTime;
        const nextEventType = payload.eventType;
        const eventChanged =
          nextEventTime !== editTarget.eventTimeIso || nextEventType !== (editTarget.eventType ?? "");

        await updateSofEvent(editTarget.eventId, {
          ...payload,
          ...(eventChanged && overrideReason ? { overrideReason } : {}),
        });
      } else {
        await createSofEvent(targetDocument.id, payload);
      }

      setTimelineSuccess(
        editTarget ? "SOF event updated successfully." : "SOF event created successfully.",
      );
      setShowAddEvent(false);
      setEditingEvent(null);
      setRefreshKey((current) => current + 1);
    } catch (error: any) {
      setTimelineError(sofErrorMessage(error, "Unable to save this SOF event. Check the event time and try again."));
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleSaveLocationEvidence() {
    if (!id) return;

    setSavingLocationEvidence(true);
    setLocationEvidenceError(null);
    setTimelineSuccess(null);
    try {
      await createNorTenderLocationEvidence(id, {
        evidenceTime: new Date(locationEvidenceForm.evidenceTime).toISOString(),
        operation: locationEvidenceForm.operation,
        portRelation: locationEvidenceForm.portRelation,
        berthRelation: locationEvidenceForm.berthRelation,
        waitingPlace: locationEvidenceForm.waitingPlace,
        source: locationEvidenceForm.source,
        ...(locationEvidenceForm.source === "SOF" && activeDocument
          ? { sofDocumentId: activeDocument.id }
          : {}),
        ...(locationEvidenceForm.sourceReference.trim()
          ? { sourceReference: locationEvidenceForm.sourceReference.trim() }
          : {}),
        ...(locationEvidenceForm.note.trim()
          ? { note: locationEvidenceForm.note.trim() }
          : {}),
        ...(locationEvidenceForm.norTenderedEventId
          ? { norTenderedEventId: locationEvidenceForm.norTenderedEventId }
          : {}),
      });
      setTimelineSuccess("Tender-location evidence recorded successfully.");
      setShowLocationEvidenceForm(false);
      setLocationEvidenceForm(
        createLocationEvidenceForm(locationEvidenceForm.operation),
      );
      setRefreshKey((current) => current + 1);
    } catch (error: any) {
      setLocationEvidenceError(
        error?.message ?? "Unable to record NOR tender-location evidence.",
      );
    } finally {
      setSavingLocationEvidence(false);
    }
  }

  const sourceStatusLabel = documentStatusLabel(activeDocument);
  const sourceStatusBg = documentStatusBg(activeDocument);
  const sourceStatusText = documentStatusText(activeDocument);
  const sourceFileName = fileNameFromPath(activeDocument?.filePath);
  const sourceOperation = activeDocument?.operation ?? null;
  const sourceSubtext = activeDocument
    ? `Uploaded ${formatDate(activeDocument.uploadDate)} · backend record`
    : "No persisted SOF document found for this voyage yet.";
  const sourceOperationText = sourceOperation ? `Operation: ${formatOperationLabel(sourceOperation)}` : null;

  const warningText = eventCounts.deductible + eventCounts.pending > 0
    ? `Persisted SOF loaded from backend. ${eventCounts.deductible} deductible and ${eventCounts.pending} pending event(s) require review.`
    : "Persisted SOF loaded from backend.";

  const shipmentMeta = [
    shipment?.port,
    shipment?.cargoType,
    shipment?.cargoQuantity != null ? `${Number(shipment.cargoQuantity).toLocaleString()} MT` : null,
    shipment?.eta ? `ETA ${formatDateTime(shipment.eta)}` : null,
  ].filter(Boolean) as string[];

  const calculationSnapshot = getCalculationSnapshot(laytimeCalculation);
  const locationQualification = (calculationSnapshot?.commencement as any)?.location ?? null;
  const wibonDecision = (calculationSnapshot as any)?.wibon ?? null;
  const wiponDecision = (calculationSnapshot as any)?.wipon ?? null;
  const calculationPeriods = getCalculationPeriods(laytimeCalculation);
  const sofDocumentSelectionAudit = getSofDocumentSelectionAudit(laytimeCalculation);
  const demurrageAudit = getDemurrageAudit(laytimeCalculation);
  const weatherWorkingAudit = getWeatherWorkingAudit(laytimeCalculation);
  const reversibleLaytimeAudit = getReversibleLaytimeAudit(laytimeCalculation);
  const allowedSeconds = intervalStringToSeconds(laytimeCalculation?.allowedLaytime);
  const grossUsedSeconds = intervalStringToSeconds(laytimeCalculation?.usedLaytime);
  const deductionSeconds = calculationPeriods.reduce((total, period) => {
    if (period?.periodType !== "exception") return total;

    const start = new Date(period.startTime).getTime();
    const end = new Date(period.endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return total;

    return total + Math.floor((end - start) / 1000);
  }, 0);
  const netUsedSeconds =
    grossUsedSeconds !== null ? Math.max(0, grossUsedSeconds - deductionSeconds) : null;
  const remainingSeconds =
    allowedSeconds !== null && netUsedSeconds !== null
      ? Math.max(0, allowedSeconds - netUsedSeconds)
      : null;
  const overrunSeconds =
    allowedSeconds !== null && netUsedSeconds !== null
      ? Math.max(0, netUsedSeconds - allowedSeconds)
      : null;
  const calculationCurrency = laytimeCalculation?.currency ?? null;
  const demurrageAmount = formatCurrencyAmount(laytimeCalculation?.demurrageAmount, calculationCurrency);
  const despatchAmount = formatCurrencyAmount(laytimeCalculation?.despatchAmount, calculationCurrency);
  const nonReversibleSettlement = calculationSnapshot?.nonReversibleSettlement ?? null;
  const monetarySummary = nonReversibleSettlement?.monetaryAggregation;
  const netPositionValue = nonReversibleSettlement
    ? monetarySummary?.status === "AVAILABLE"
      ? `${formatCurrencyAmount(monetarySummary.netExposure, monetarySummary.currency)} ${String(monetarySummary.netDirection ?? "")}`.trim()
      : "Operation results shown separately"
    : laytimeCalculation && Number((laytimeCalculation as any)?.demurrageAmount) > 0
      ? `${demurrageAmount} demurrage`
      : laytimeCalculation && Number((laytimeCalculation as any)?.despatchAmount) > 0
        ? `${despatchAmount} despatch`
        : laytimeCalculation
          ? formatCurrencyAmount(0, calculationCurrency)
          : "—";
  const supplierClockStart = formatDateTime(calculationSnapshot?.commencement?.commencedAt);
  const demurrageAuditVisible = Boolean(demurrageAudit.startedAt);
  const weatherWorkingAuditVisible = Boolean(laytimeCalculation);
  const reversibleLaytimeAuditVisible = Boolean(laytimeCalculation);
  const sofDocumentSelectionAuditVisible = Boolean(laytimeCalculation);
  const operationSelectionAuditVisible = Boolean(laytimeCalculation);
  const demurrageAmountValue = Number((laytimeCalculation as any)?.demurrageAmount ?? 0);
  const despatchAmountValue = Number((laytimeCalculation as any)?.despatchAmount ?? 0);
  const reversibleSettlement = calculationSnapshot?.reversibleSettlement ?? null;
  const reversibleConfigured =
    Boolean(reversibleSettlement) ||
    calculationSnapshot?.reversibleLaytimeRule?.enabled === true;
  const reversibleSettlementStatus = (
    reversibleSettlement?.settlementStatus ??
    (reversibleConfigured ? "LEGACY" : null)
  ) as ReversibleSettlementStatus | null;
  const laytimeClaimAllowed =
    reversibleConfigured &&
    reversibleSettlementStatus === "FINAL_AUTHORITATIVE" &&
    laytimeCalculation?.status === "Final" &&
    Boolean(calculationCurrency);
  const hasPositiveClaimAmount =
    demurrageAmountValue > 0 || despatchAmountValue > 0;
  const hasClaimableAmount =
    Boolean(laytimeCalculation) &&
    hasPositiveClaimAmount &&
    laytimeClaimAllowed;
  const claimHelperText = !laytimeCalculation
    ? "No persisted laytime calculation yet."
    : !reversibleConfigured
      ? calculationCurrency
        ? "Non-reversible claims require an operation-linked claim source."
        : "Non-reversible claims require an authoritative calculation currency."
      : !calculationCurrency
      ? "Reversible claims require an authoritative calculation currency."
      : reversibleConfigured && !laytimeClaimAllowed
      ? `${reversibleSettlementStatusLabel(reversibleSettlementStatus)} reversible results cannot create a final claim.`
      : hasClaimableAmount
      ? "Create a claim from the persisted laytime calculation."
      : "No claimable amount from this laytime calculation.";
  const hasOperationResults = operationResults.length > 0;

  async function handleRunLaytimeCalculation() {
    if (!id) return;

    setLaytimeRunning(true);
    setLaytimeError(null);

    try {
      const result = await runLaytimeCalculation(id);
      setLaytimeCalculation(result.calculation);
      setLaytimeWarnings(result.warnings ?? []);
      setRefreshKey((current) => current + 1);
    } catch (error: any) {
      setLaytimeError(error?.message ?? "Unable to run laytime calculation.");
    } finally {
      setLaytimeRunning(false);
    }
  }

  async function handleCreateClaim() {
    if (!id || !laytimeCalculation) return;

    if (!laytimeClaimAllowed) {
      setClaimError(
        reversibleConfigured
          ? calculationCurrency
            ? "A reversible claim requires a FINAL - AUTHORITATIVE calculation result."
            : "A reversible claim requires an authoritative calculation currency."
          : calculationCurrency
            ? "Non-reversible claims require an operation-linked claim source."
            : "Non-reversible claims require an authoritative calculation currency.",
      );
      setClaimSuccess(null);
      return;
    }

    if (!hasPositiveClaimAmount) {
      setClaimError("No claimable amount from this laytime calculation.");
      setClaimSuccess(null);
      return;
    }

    setClaimRunning(true);
    setClaimError(null);
    setClaimSuccess(null);

    try {
      const type = demurrageAmountValue > 0 ? "demurrage_counter" : "despatch_claim";
      const amountDisputed = demurrageAmountValue > 0 ? demurrageAmountValue : despatchAmountValue;

      const createdClaim = await createBulkDispute({
        voyageId: id,
        type,
        amountDisputed,
        status: "Open",
      });

      setClaimSuccess(
        createdClaim?.id
          ? `Claim created successfully. Claim ID: ${createdClaim.id}`
          : "Claim created successfully."
      );
    } catch (error: any) {
      setClaimSuccess(null);
      setClaimError(error?.message ?? "Unable to create claim.");
    } finally {
      setClaimRunning(false);
    }
  }

  const hasLaytimeCalculation = Boolean(laytimeCalculation);
  const allowedDisplay = formatInterval(laytimeCalculation?.allowedLaytime);
  const grossUsedDisplay = formatInterval(laytimeCalculation?.usedLaytime);
  const deductionsDisplay = hasLaytimeCalculation ? formatSecondsAsInterval(deductionSeconds) : "—";
  const netUsedDisplay = hasLaytimeCalculation ? formatSecondsAsInterval(netUsedSeconds) : "—";
  const remainingDisplay = hasLaytimeCalculation ? formatSecondsAsInterval(remainingSeconds) : "—";
  const overrunDisplay = hasLaytimeCalculation ? formatSecondsAsInterval(overrunSeconds) : "—";
  const supplierClockNote = laytimeCalculation
    ? `Calculated ${formatDateTime(laytimeCalculation.calculatedAt)}`
    : laytimeLoading
      ? "Loading latest backend calculation..."
      : "No persisted laytime calculation yet.";
  const defaultManualEventOperation = activeDocument?.operation ?? shipment?.laytimeOperation ?? "Discharge";
  const norTenderEvents = timelineEvents.filter(
    (event) => event.eventType === "NOR_TENDERED" && event.eventId,
  );
  const laytimeBannerTitle = laytimeError
    ? "Laytime calculation failed"
    : laytimeLoading
      ? "Loading latest backend calculation..."
      : !hasLaytimeCalculation
        ? "No persisted laytime calculation yet"
        : "Laytime warnings";
  const laytimeBannerText = laytimeError
    ? laytimeError
    : laytimeLoading
      ? "Loading latest backend calculation..."
      : laytimeWarnings.length > 0
      ? laytimeWarnings[0]
      : laytimeCalculation
        ? "Backend laytime calculation loaded."
        : "No persisted laytime calculation yet.";
  const operationResultsSectionVisible =
    Boolean(laytimeCalculation) ||
    Boolean(operationResultsError) ||
    hasOperationResults ||
    (Boolean(laytimeCalculation) && operationResultsLoading);

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      {(showAddEvent || editingEvent) && (
        <AddEventModal
          mode={editingEvent ? "edit" : "add"}
          event={editingEvent}
          defaultOperation={defaultManualEventOperation}
          onClose={() => {
            setShowAddEvent(false);
            setEditingEvent(null);
          }}
          onSave={(form) => void handleSaveEvent(form, editingEvent)}
          submitting={savingEvent}
        />
      )}
      <PageHeader
        crumbs={[
          { label: "Operations", to: "/" },
          { label: voyageLabel, to: id ? `/shipments/${id}` : "/" },
          { label: "Laytime timeline" },
        ]}
        actions={
          <>
            <button
              onClick={() => setShowAddEvent(true)}
              className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <Plus size={11} /> Add event
            </button>
            <button
              onClick={() => {
                setLocationEvidenceForm(
                  createLocationEvidenceForm(defaultManualEventOperation),
                );
                setShowLocationEvidenceForm(true);
              }}
              className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <Plus size={11} /> Add location evidence
            </button>
            <button
              onClick={() => void handleRunLaytimeCalculation()}
              className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none", opacity: laytimeRunning ? 0.7 : 1 }}
              disabled={laytimeRunning}
            >
              {laytimeRunning ? "Running..." : "Run laytime calculation"} <ArrowUpRight size={12} />
            </button>
          </>
        }
      />

      {(laytimeError || laytimeLoading || !hasLaytimeCalculation || laytimeWarnings.length > 0) && (
        <div
          className="mx-6 mt-4 rounded-lg border px-4 py-3"
          style={{
            borderColor: laytimeError ? "#FCA5A5" : "#BFDBFE",
            backgroundColor: laytimeError ? "#FEF2F2" : "#EFF6FF",
            color: laytimeError ? "#991B1B" : "#1E40AF",
          }}
        >
          <p style={{ fontSize: "12px", fontWeight: 500, marginBottom: "2px" }}>
            {laytimeBannerTitle}
          </p>
          <p style={{ fontSize: "11px", lineHeight: 1.4 }}>
            {laytimeBannerText}
          </p>
        </div>
      )}
      {timelineSuccess && (
        <div
          className="mx-6 mt-3 rounded-lg border px-4 py-3"
          style={{ borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", color: "#166534" }}
        >
          <p style={{ fontSize: "12px", fontWeight: 500 }}>{timelineSuccess}</p>
        </div>
      )}
      <section className="mx-6 mt-3 rounded-lg border bg-white p-4" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>
              NOR tender-location evidence
            </p>
            <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>
              Factual observations only. Candidate-linked evidence supports WIBON/WIPON evaluation; unassociated observations remain timeline evidence.
            </p>
          </div>
          <span style={{ fontSize: "11px", color: "#6B7280" }}>
            {locationEvidenceLoading ? "Loading..." : `${locationEvidence.length} observation(s)`}
          </span>
        </div>

        {locationEvidenceError && (
          <p className="mt-3 rounded-md border px-3 py-2" style={{ fontSize: "11px", color: "#991B1B", borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }}>
            {locationEvidenceError}
          </p>
        )}

        {locationQualification && (
          <div className="mt-3 grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "#D1D5DB", backgroundColor: "#F9FAFB" }}>
            <CalcRow label="Berth qualification" value={locationQualification.berth?.status ?? "UNAVAILABLE"} />
            <CalcRow label="Port qualification" value={locationQualification.port?.status ?? "UNAVAILABLE"} />
            <CalcRow label="WIBON" value={wibonDecision?.applied ? "Applied" : wibonDecision?.configured ? "Configured / not applied" : "Not configured"} />
            <CalcRow label="WIPON" value={wiponDecision?.applied ? "Applied" : wiponDecision?.configured ? "Configured / not applied" : "Not configured"} />
            <p className="sm:col-span-2 lg:col-span-4" style={{ fontSize: "10px", color: "#6B7280" }}>
              {locationQualification.selectedEvidence
                ? `Evidence ${locationQualification.selectedEvidence.id} observed ${formatDateTime(locationQualification.selectedEvidence.evidenceTime)} from ${locationQualification.selectedEvidence.source}.`
                : `Evidence unavailable: ${locationQualification.berth?.reason ?? locationQualification.port?.reason ?? "NO_ASSOCIATED_LOCATION_EVIDENCE"}.`}
            </p>
          </div>
        )}

        {showLocationEvidenceForm && (
          <form
            className="mt-4 grid gap-3 rounded-lg border p-3 md:grid-cols-3"
            style={{ borderColor: "#D1D5DB", backgroundColor: "#F9FAFB" }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveLocationEvidence();
            }}
          >
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Observed at
              <input
                type="datetime-local"
                required
                value={locationEvidenceForm.evidenceTime}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, evidenceTime: event.target.value }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              />
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Operation
              <select
                value={locationEvidenceForm.operation}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, operation: event.target.value as "Loading" | "Discharge" }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              >
                <option value="Loading">Loading</option>
                <option value="Discharge">Discharge</option>
              </select>
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Source
              <select
                value={locationEvidenceForm.source}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, source: event.target.value as "MANUAL" | "SOF" }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              >
                <option value="MANUAL">Manual observation</option>
                <option value="SOF" disabled={!activeDocument}>Current SOF document</option>
              </select>
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Port relation
              <select
                value={locationEvidenceForm.portRelation}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, portRelation: event.target.value as NorPortRelation }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="INSIDE_PORT_LIMITS">Inside port limits</option>
                <option value="OUTSIDE_PORT_LIMITS">Outside port limits</option>
              </select>
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Berth relation
              <select
                value={locationEvidenceForm.berthRelation}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, berthRelation: event.target.value as NorBerthRelation }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="AT_BERTH">At berth</option>
                <option value="NOT_AT_BERTH">Not at berth</option>
              </select>
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Waiting place
              <select
                value={locationEvidenceForm.waitingPlace}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, waitingPlace: event.target.value as NorWaitingPlace }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="NONE">None</option>
                <option value="ANCHORAGE">Anchorage</option>
                <option value="PILOT_STATION">Pilot station</option>
                <option value="CUSTOMARY_WAITING_PLACE">Customary waiting place</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Associated NOR tender
              <select
                value={locationEvidenceForm.norTenderedEventId}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, norTenderedEventId: event.target.value }))}
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              >
                <option value="">Unassociated observation (not used for v1 validity)</option>
                {norTenderEvents.map((event) => (
                  <option key={event.eventId} value={event.eventId}>
                    {formatDateTime(event.eventTimeIso)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block" style={{ fontSize: "10px", color: "#6B7280" }}>
                Select the exact NOR tender this evidence describes. The evidence time must be at or before that tender.
              </span>
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Source reference
              <input
                value={locationEvidenceForm.sourceReference}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, sourceReference: event.target.value }))}
                placeholder="SOF page, agent email, log reference"
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              />
            </label>
            <label style={{ fontSize: "11px", color: "#374151" }}>
              Evidence note
              <input
                value={locationEvidenceForm.note}
                onChange={(event) => setLocationEvidenceForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Factual basis for this observation"
                className="mt-1 w-full rounded-md border bg-white px-2 py-2"
                style={{ borderColor: "#D1D5DB" }}
              />
            </label>
            <div className="flex items-end justify-end gap-2 md:col-span-3">
              <button type="button" onClick={() => setShowLocationEvidenceForm(false)} className="rounded-md border bg-white px-3 py-2" style={{ fontSize: "11px", borderColor: "#D1D5DB" }}>
                Cancel
              </button>
              <button type="submit" disabled={savingLocationEvidence} className="rounded-md px-3 py-2 text-white" style={{ fontSize: "11px", backgroundColor: "#1A4ED8", opacity: savingLocationEvidence ? 0.7 : 1 }}>
                {savingLocationEvidence ? "Saving..." : "Record evidence"}
              </button>
            </div>
          </form>
        )}

        {!locationEvidenceLoading && locationEvidence.length === 0 && !locationEvidenceError && (
          <p className="mt-3" style={{ fontSize: "11px", color: "#6B7280" }}>
            No tender-location evidence has been recorded. No location is inferred.
          </p>
        )}
        {locationEvidence.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {locationEvidence.map((evidence) => (
              <article key={evidence.id} className="rounded-md border px-3 py-2" style={{ borderColor: "#E5E7EB" }}>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#111827" }}>{evidence.operation}</span>
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>{formatDateTime(evidence.evidenceTime)}</span>
                </div>
                <p className="mt-1" style={{ fontSize: "11px", color: "#374151" }}>
                  Port: {humanizeLabel(evidence.portRelation)} · Berth: {humanizeLabel(evidence.berthRelation)}
                </p>
                <p style={{ fontSize: "11px", color: "#374151" }}>
                  Waiting place: {humanizeLabel(evidence.waitingPlace)} · Source: {evidence.source}
                </p>
                <p style={{ fontSize: "10px", color: "#6B7280" }}>
                  {evidence.norDocumentId || evidence.norTenderedEventId
                    ? "Candidate-linked evidence"
                    : "Unassociated timeline observation"}
                </p>
                {evidence.note && <p className="mt-1" style={{ fontSize: "11px", color: "#6B7280" }}>{evidence.note}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
      {claimError && (
        <div className="mx-6 mt-3 rounded-lg border px-4 py-3" style={{ borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", color: "#991B1B" }}>
          <p style={{ fontSize: "12px", fontWeight: 500 }}>{claimError}</p>
        </div>
      )}
      {claimSuccess && (
        <div className="mx-6 mt-3 rounded-lg border px-4 py-3" style={{ borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", color: "#166534" }}>
          <p style={{ fontSize: "12px", fontWeight: 500, marginBottom: "2px" }}>Claim created successfully.</p>
          <p style={{ fontSize: "11px", lineHeight: 1.4 }}>{claimSuccess.replace("Claim created successfully. ", "")}</p>
        </div>
      )}

      <div className="flex items-start justify-between flex-shrink-0" style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>
              SOF timeline &amp; laytime calculation
            </h1>
            {["Supplier clock active", "Receiver clock active"].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
                style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}
              >
                <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
                {label}
              </span>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            {shipment ? `${shipment.vessel} · ${shipment.id}` : voyageLabel}{" "}
            {shipmentMeta.length > 0 ? `· ${shipmentMeta.join(" · ")}` : ""}
          </p>
        </div>
      </div>

      <div className="flex gap-4 flex-shrink-0" style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        {[
          { label: "Laytime allowed", value: allowedDisplay, vc: "#1A4ED8", sub: hasLaytimeCalculation ? "Backend result from charter party" : "No persisted calculation yet" },
          { label: "Laytime used", value: grossUsedDisplay, vc: "#B45309", sub: hasLaytimeCalculation ? "Gross elapsed time from the backend" : "No persisted calculation yet" },
          { label: "Deductions", value: deductionsDisplay, vc: "#374151", sub: hasLaytimeCalculation ? "Backend exception periods" : "No persisted calculation yet" },
          { label: "Remaining", value: remainingDisplay, vc: "#22543D", sub: hasLaytimeCalculation ? (overrunDisplay === "—" ? "Net laytime balance from backend" : `${overrunDisplay} over`) : "No persisted calculation yet" },
          { label: "Net position", value: netPositionValue, vc: "#B45309", sub: hasLaytimeCalculation ? (reversibleConfigured ? reversibleSettlementStatusLabel(reversibleSettlementStatus) : monetarySummary?.status === "AVAILABLE" ? "Informational only - operation results remain separate" : "Authoritative calculation currency unavailable") : "No persisted calculation yet" },
        ].map(({ label, value, vc, sub }) => (
          <div
            key={label}
            className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
          >
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "19px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">
          <div className="rounded-xl border p-[16px_18px]" style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                SOF source
              </span>
              <span className="rounded-full px-2 py-0.5 font-medium" style={{ fontSize: "10px", backgroundColor: sourceStatusBg, color: sourceStatusText }}>
                {sourceStatusLabel}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-[10px_12px] mb-5" style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
              <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: "36px", height: "36px", backgroundColor: "#DBEAFE" }}>
                <FileText size={16} color="#1A4ED8" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{sourceFileName}</p>
                <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{sourceSubtext}</p>
                {sourceOperationText ? (
                  <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>{sourceOperationText}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">                <button
                  className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
                  onClick={() => setRefreshKey((current) => current + 1)}
                >
                  <RefreshCw size={10} />
                  Refresh SOF
                </button>
              </div>
            </div>

            <LaytimeBar />
          </div>

          {/* Card 2 — SOF Event Log */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "0.5px solid #E5E7EB" }}
            >
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                SOF event log
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: `${eventCounts.normal} recorded`, bg: "#C6F6D5", text: "#22543D" },
                  { label: `${eventCounts.deductible} review`, bg: "#F3F4F6", text: "#374151" },
                  { label: `${eventCounts.pending} pending`, bg: "#EFF6FF", text: "#1E40AF" },
                ].map(({ label, bg, text }) => (
                  <span
                    key={label}
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{ fontSize: "10px", backgroundColor: bg, color: text }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {eventCounts.deductible + eventCounts.pending > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ backgroundColor: "#FFFBEB", borderLeft: "2.5px solid #F59E0B", borderBottom: "0.5px solid #E5E7EB" }}>
                <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: "11px", color: "#7B341E", lineHeight: 1.4 }}>
                  {eventCounts.deductible + eventCounts.pending} event(s) are marked for review in the persisted SOF evidence.
                </p>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                    <th className="pl-4 py-2.5 text-left" style={{ width: "36px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>#</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left" style={{ width: "110px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Timestamp</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left">
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Event</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left" style={{ width: "72px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Duration</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left" style={{ width: "100px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cause · party</span>
                    </th>
                    <th className="py-2.5 pr-4 text-left" style={{ width: "32px" }} />
                  </tr>
                </thead>
                <tbody>
                  {displayEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <p style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>No Statement of Facts events yet.</p>
                        <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>Add the first operational event to begin building the laytime evidence timeline.</p>
                      </td>
                    </tr>
                  ) : displayEvents.map((ev, i) => (
                    <tr
                      key={ev.n}
                      style={{
                        backgroundColor:
                          ev.state === "deductible" ? "#FFFBEB"
                          : ev.state === "pending" ? "#F9FAFB"
                          : "#ffffff",
                        borderBottom: i < displayEvents.length - 1 ? "0.5px solid #F3F4F6" : "none",
                        transition: "background-color 0.12s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          ev.state === "deductible" ? "#FEF3C7"
                          : ev.state === "pending" ? "#F3F4F6"
                          : "#F9FAFB";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          ev.state === "deductible" ? "#FFFBEB"
                          : ev.state === "pending" ? "#F9FAFB"
                          : "#ffffff";
                      }}
                    >
                      {/* # */}
                      <td className="py-2.5 pl-4" style={{ verticalAlign: "middle" }}>
                        {ev.state === "pending" ? (
                          <span
                            className="inline-flex items-center justify-center rounded-full"
                            style={{ width: "20px", height: "20px", border: "1.5px dashed #9CA3AF", fontSize: "10px", color: "#9CA3AF", fontWeight: 500 }}
                          >
                            {ev.n}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center rounded-full"
                            style={{
                              width: "20px", height: "20px",
                              backgroundColor: ev.state === "deductible" ? "#FEEBC8" : "#EFF6FF",
                              fontSize: "10px",
                              color: ev.state === "deductible" ? "#7B341E" : "#1E40AF",
                              fontWeight: 500,
                            }}
                          >
                            {ev.n}
                          </span>
                        )}
                      </td>
                      {/* Timestamp */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <span style={{ fontSize: "11px", color: "#6B7280", whiteSpace: "nowrap" }}>{ev.timestamp}</span>
                      </td>
                      {/* Event */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{ev.name}</p>
                        <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4, marginBottom: "4px" }}>{ev.detail}</p>
                        {ev.operation ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
                            style={{
                              fontSize: "10px",
                              backgroundColor: "#F3F4F6",
                              color: "#374151",
                              marginBottom: "4px",
                            }}
                          >
                            Operation: {formatOperationLabel(ev.operation)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium" style={{ fontSize: "10px", backgroundColor: "#F9FAFB", color: "#6B7280", marginBottom: "4px" }}>
                            Global / not operation-specific
                          </span>
                        )}
                        {ev.category ? <span className="inline-block rounded-full px-2 py-0.5 font-medium" style={{ fontSize: "10px", backgroundColor: "#F3F4F6", color: "#4B5563", margin: "0 4px 4px 0" }}>{ev.category}</span> : null}
                        {ev.evidenceStatus === "selected" ? <span className="inline-block rounded-full px-2 py-0.5 font-medium" style={{ fontSize: "10px", backgroundColor: "#DCFCE7", color: "#166534", marginBottom: "4px" }}>Selected for calculation</span> : null}
                        {ev.evidenceStatus === "excluded" ? <span className="inline-block rounded-full px-2 py-0.5 font-medium" style={{ fontSize: "10px", backgroundColor: "#FEF2F2", color: "#991B1B", marginBottom: "4px" }}>Excluded from calculation</span> : null}
                        <span
                          className="inline-block rounded-full px-2 py-0.5 font-medium"
                          style={{ fontSize: "10px", backgroundColor: ev.tagBg, color: ev.tagText }}
                        >
                          {ev.tag}
                        </span>
                      </td>
                      {/* Duration */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <span style={{ fontSize: "12px", color: "#374151", fontWeight: ev.duration.includes("h") ? 500 : 400 }}>
                          {ev.duration}
                        </span>
                      </td>
                      {/* Cause pill */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <span
                          className="inline-block rounded-full px-2 py-0.5 cursor-pointer transition-colors"
                          style={{
                            fontSize: "11px",
                            border: `0.5px solid ${ev.causeActive ? "#1A4ED8" : "#E5E7EB"}`,
                            backgroundColor: ev.causeActive ? "#EFF6FF" : "#ffffff",
                            color: ev.causeActive ? "#1E40AF" : "#6B7280",
                          }}
                        >
                          {ev.cause}
                        </span>
                      </td>
                    {/* Edit */}
                      <td className="py-2.5 pr-4" style={{ verticalAlign: "middle" }}>
                        <button
                          type="button"
                          className="w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer"
                          style={{ color: "#9CA3AF", border: "none", backgroundColor: "transparent" }}
                          aria-label={`Edit ${ev.name}`}
                          title={`Edit ${ev.name}`}
                          onClick={() => {
                            setTimelineSuccess(null);
                            setShowAddEvent(false);
                            setEditingEvent(ev);
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F3F4F6")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                        >
                          <Edit2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add manual event */}
            <div style={{ borderTop: "0.5px solid #E5E7EB", padding: "10px 16px" }}>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ height: "32px", fontSize: "12px", color: "#6B7280", border: "0.5px dashed #D1D5DB", backgroundColor: "transparent" }}
                onClick={() => {
                  setTimelineSuccess(null);
                  setEditingEvent(null);
                  setShowAddEvent(true);
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
              >
                <Plus size={12} />
                Add manual event
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: "220px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Component 1 — Running totals */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <p className="mb-3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Running totals
            </p>

            {/* Supplier clock */}
            <p className="mb-1.5" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>Calculation evidence</p>
            <CalcRow label="Laytime commenced" value={supplierClockStart} />
            <CalcRow label="Cargo completion" value={formatDateTime(evidenceAudit.completion?.completionTime)} />
            <CalcRow label="Allowed laytime" value={allowedDisplay} valueColor="#1A4ED8" bold />
            <CalcRow label="Used laytime" value={grossUsedDisplay} />
            <CalcRow label="Deductions" value={formatSecondsAsInterval(deductionSeconds)} valueColor="#22543D" />
            <CalcRow label="Time balance" value={remainingDisplay} valueColor="#22543D" bold />
            <CalcRow label="Net position" value={netPositionValue} valueColor="#B45309" bold />
            {reversibleConfigured && (
              <CalcRow
                label="Settlement authority"
                value={reversibleSettlementStatusLabel(reversibleSettlementStatus)}
                valueColor={laytimeClaimAllowed ? "#166534" : "#92400E"}
                bold
              />
            )}
            <button
              type="button"
              onClick={() => void handleCreateClaim()}
              disabled={!hasClaimableAmount || claimRunning}
              className="mt-3 w-full rounded-md px-3 py-2 text-white"
              style={{
                fontSize: "11px",
                backgroundColor: "#1A4ED8",
                opacity: !hasClaimableAmount || claimRunning ? 0.45 : 1,
              }}
            >
              {claimRunning ? "Creating claim..." : "Create claim"}
            </button>
            <p className="mt-1.5" style={{ fontSize: "10px", color: "#6B7280", lineHeight: 1.4 }}>
              {claimHelperText}
            </p>

            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0" }} />

            {/* Receiver clock */}
          </div>

          {operationResultsSectionVisible && (
            <div
              className="rounded-xl border p-[14px_16px]"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <p
                className="mb-2.5"
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Operation result
              </p>

              {operationResultsError ? (
                <p style={{ fontSize: "11px", color: "#991B1B", lineHeight: 1.45 }}>
                  {operationResultsError}
                </p>
              ) : operationResultsLoading ? (
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45 }}>
                  Loading operation results...
                </p>
              ) : hasOperationResults ? (
                <div className="space-y-3">
                  {operationResults.map((result) => {
                    const operationResultSnapshot = getOperationResultSnapshot(result);
                    const operationLabel = formatOperationLabel(result.operation);
                    const sourceLine =
                      operationResultSnapshot?.source &&
                      operationResultSnapshot?.operation
                        ? `Source: ${operationResultSnapshot.source} · Operation: ${formatOperationLabel(operationResultSnapshot.operation)}`
                        : operationResultSnapshot?.source
                          ? `Source: ${operationResultSnapshot.source}`
                          : operationResultSnapshot?.operation
                            ? `Operation: ${formatOperationLabel(operationResultSnapshot.operation)}`
                            : null;

                    return (
                      <div
                        key={result.id}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: "#E5E7EB",
                          borderWidth: "0.5px",
                          backgroundColor: "#F9FAFB",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#374151",
                            fontWeight: 500,
                            marginBottom: "6px",
                          }}
                        >
                          {operationLabel}
                        </p>
                        <CalcRow label="Allowed laytime" value={formatInterval(result.allowedLaytime)} />
                        <CalcRow label="Used laytime" value={formatInterval(result.usedLaytime)} />
                        <CalcRow
                          label={reversibleSettlementStatus === "FINAL_AUTHORITATIVE" ? "Demurrage (reference only)" : "Demurrage"}
                          value={formatCurrencyAmount(result.demurrageAmount, result.currency)}
                        />
                        <CalcRow
                          label={reversibleSettlementStatus === "FINAL_AUTHORITATIVE" ? "Despatch (reference only)" : "Despatch"}
                          value={formatCurrencyAmount(result.despatchAmount, result.currency)}
                        />
                        <CalcRow label="Status" value={result.status} />
                        <CalcRow label="Calculated at" value={formatDateTime(result.calculatedAt)} />
                        {sourceLine ? (
                          <p
                            style={{
                              fontSize: "10px",
                              color: "#6B7280",
                              lineHeight: 1.4,
                              marginTop: "6px",
                            }}
                          >
                            {sourceLine}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45 }}>
                  No operation-specific child results available for this calculation.
                </p>
              )}
            </div>
          )}

          {demurrageAuditVisible && (
            <div
              className="rounded-xl border p-[14px_16px]"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <p
                className="mb-3"
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Demurrage transition
              </p>

              <CalcRow
                label="Demurrage started"
                value={formatDateTime(demurrageAudit.startedAt)}
                valueColor="#B45309"
                bold
              />
              <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45, marginTop: "8px" }}>
                Once demurrage started, these later exceptions did not suspend the clock.
              </p>
              <CalcRow
                label="Post-demurrage exceptions ignored"
                value={String(demurrageAudit.ignoredExceptions.length)}
                valueColor="#1E40AF"
                bold
              />

              {demurrageAudit.ignoredExceptions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {demurrageAudit.ignoredExceptions.map((exception, index) => (
                    <div
                      key={`${exception.startTime}-${exception.endTime}-${index}`}
                      className="rounded-lg border px-3 py-2"
                      style={{
                        borderColor: "#E5E7EB",
                        borderWidth: "0.5px",
                        backgroundColor: "#F9FAFB",
                      }}
                    >
                      <p style={{ fontSize: "11px", color: "#374151", fontWeight: 500, marginBottom: "2px" }}>
                        Type / reason: {exception.reason}
                      </p>
                      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
                        Start: {formatDateTime(exception.startTime)}
                        <br />
                        End: {formatDateTime(exception.endTime)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {weatherWorkingAuditVisible && (
            <div
              className="rounded-xl border p-[14px_16px]"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <p
                className="mb-3"
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Weather working rule
              </p>

              {!weatherWorkingAudit.available ? (
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45 }}>
                  Not available for this calculation version.
                </p>
              ) : (
                <>
                  <CalcRow
                    label="Status"
                    value={
                      weatherWorkingAudit.enabled === true
                        ? "Enabled"
                        : weatherWorkingAudit.enabled === false
                          ? "Disabled"
                          : "Not specified"
                    }
                    valueColor={
                      weatherWorkingAudit.enabled === true ? "#22543D" : "#6B7280"
                    }
                    bold
                  />
                  <CalcRow
                    label="Weather time deducted before demurrage"
                    value={formatSecondsAsInterval(
                      weatherWorkingAudit.totalWeatherTimeDeductedBeforeDemurrage,
                    )}
                    valueColor="#1E40AF"
                    bold
                  />
                  <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45, marginTop: "8px" }}>
                    {weatherWorkingAudit.enabled === true
                      ? "Weather stoppages before demurrage were excluded from counted laytime."
                      : "Weather stoppages were counted unless another applicable rule excluded them."}
                  </p>
                </>
              )}
            </div>
          )}

          {reversibleLaytimeAuditVisible && (
            <div
              className="rounded-xl border p-[14px_16px]"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <p
                className="mb-3"
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Reversible laytime
              </p>

              {!reversibleLaytimeAudit.hasAnalysis ? (
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45 }}>
                  Not available for this calculation version.
                </p>
              ) : reversibleLaytimeAudit.statusLabel === "NOT AVAILABLE" ? (
                <>
                  <CalcRow
                    label="Status"
                    value="NOT AVAILABLE"
                    valueColor="#6B7280"
                    bold
                  />
                  <CalcRow
                    label="Contract rule applied"
                    value={reversibleLaytimeAudit.contractRuleApplied ? "Yes" : "No"}
                    valueColor="#374151"
                  />
                  <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45, marginTop: "8px" }}>
                    {reversibleLaytimeAudit.reason ?? "Not available for this calculation version."}
                  </p>
                </>
              ) : (
                <>
                  <CalcRow
                    label="Status"
                    value={reversibleLaytimeAudit.statusLabel}
                    valueColor={reversibleLaytimeAudit.contractRuleApplied ? "#22543D" : "#6B7280"}
                    bold
                  />
                  <CalcRow
                    label="Contract rule applied"
                    value={reversibleLaytimeAudit.contractRuleApplied ? "Yes" : "No"}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Loading allowed"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.loading?.allowedSeconds)}
                    valueColor="#1E40AF"
                  />
                  <CalcRow
                    label="Loading used"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.loading?.usedSeconds)}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Loading surplus"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.loading?.surplusSeconds)}
                    valueColor="#22543D"
                  />
                  <CalcRow
                    label="Loading overrun"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.loading?.overrunSeconds)}
                    valueColor="#B45309"
                  />
                  <CalcRow
                    label="Discharge allowed"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.discharge?.allowedSeconds)}
                    valueColor="#1E40AF"
                  />
                  <CalcRow
                    label="Discharge used"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.discharge?.usedSeconds)}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Discharge surplus"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.discharge?.surplusSeconds)}
                    valueColor="#22543D"
                  />
                  <CalcRow
                    label="Discharge overrun"
                    value={formatSecondsAsInterval(reversibleLaytimeAudit.discharge?.overrunSeconds)}
                    valueColor="#B45309"
                  />
                  <div className="mt-2 rounded-lg border border-dashed px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
                    <CalcRow
                      label="Total allowed"
                      value={formatSecondsAsInterval(reversibleLaytimeAudit.pool?.totalAllowedSeconds)}
                      valueColor="#1E40AF"
                    />
                    <CalcRow
                      label="Total used"
                      value={formatSecondsAsInterval(reversibleLaytimeAudit.pool?.totalUsedSeconds)}
                      valueColor="#374151"
                    />
                    <CalcRow
                      label="Transferable surplus"
                      value={formatSecondsAsInterval(reversibleLaytimeAudit.pool?.transferableSurplusSeconds)}
                      valueColor="#22543D"
                    />
                    <CalcRow
                      label="Net pooled overrun"
                      value={formatSecondsAsInterval(reversibleLaytimeAudit.pool?.netPooledOverrunSeconds)}
                      valueColor="#B45309"
                    />
                    <CalcRow
                      label="Net pooled surplus"
                      value={formatSecondsAsInterval(reversibleLaytimeAudit.pool?.netPooledSurplusSeconds)}
                      valueColor="#22543D"
                    />
                  </div>
                  {reversibleLaytimeAudit.note ? (
                    <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45, marginTop: "8px" }}>
                      {reversibleLaytimeAudit.note}
                    </p>
                  ) : null}
                  {reversibleLaytimeAudit.warnings.length > 0 ? (
                    <p style={{ fontSize: "11px", color: "#7C2D12", lineHeight: 1.45, marginTop: "8px" }}>
                      {reversibleLaytimeAudit.warnings[0]}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}

          {sofDocumentSelectionAuditVisible && (
            <div
              className="rounded-xl border p-[14px_16px]"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <p
                className="mb-3"
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                SOF document selection
              </p>

              {!sofDocumentSelectionAudit.available ? (
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45 }}>
                  Not available for this calculation version.
                </p>
              ) : (
                <>
                  <CalcRow
                    label="Voyage laytime operation"
                    value={sofDocumentSelectionAudit.voyageLaytimeOperation ?? "Not set"}
                    valueColor="#1E40AF"
                    bold
                  />
                  <CalcRow
                    label="Documents considered"
                    value={String(sofDocumentSelectionAudit.candidateDocumentCount)}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Documents used"
                    value={String(sofDocumentSelectionAudit.includedDocumentCount)}
                    valueColor="#22543D"
                    bold
                  />
                  <CalcRow
                    label="Matching-operation documents"
                    value={String(sofDocumentSelectionAudit.matchingDocumentCount)}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Legacy unscoped documents"
                    value={String(sofDocumentSelectionAudit.legacyNullDocumentCount)}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Opposite-operation documents excluded"
                    value={String(sofDocumentSelectionAudit.oppositeOperationDocumentCount)}
                    valueColor="#9A3412"
                  />
                  {sofDocumentSelectionAudit.hasLegacyNullDocuments && (
                    <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45, marginTop: "8px" }}>
                      Legacy SOF documents without operation context were included for backward compatibility.
                    </p>
                  )}
                  {sofDocumentSelectionAudit.hasOppositeOperationDocuments && (
                    <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45, marginTop: "8px" }}>
                      SOF documents explicitly assigned to the opposite laytime operation were excluded.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {operationSelectionAuditVisible && (
            <div
              className="rounded-xl border p-[14px_16px]"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <p
                className="mb-3"
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Operation selection
              </p>

              {!operationSelectionAudit.available ? (
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.45 }}>
                  Not available for this calculation version.
                </p>
              ) : (
                <>
                  <CalcRow
                    label="Voyage laytime operation"
                    value={
                      operationSelectionAudit.voyageLaytimeOperation ?? "Not set"
                    }
                    valueColor="#1E40AF"
                    bold
                  />
                  <CalcRow
                    label="Loading completion found"
                    value={operationSelectionAudit.hasLoadingCompletion === true ? "Yes" : "No"}
                    valueColor="#374151"
                  />
                  <CalcRow
                    label="Discharge completion found"
                    value={operationSelectionAudit.hasDischargeCompletion === true ? "Yes" : "No"}
                    valueColor="#374151"
                  />
                  {operationSelectionAudit.mixedOperationEvidence === true && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#7B341E",
                        lineHeight: 1.45,
                        marginTop: "8px",
                        backgroundColor: "#FFFBEB",
                        border: "0.5px solid #FCD34D",
                        borderRadius: "8px",
                        padding: "8px 10px",
                      }}
                    >
                      Both Loading and Discharge completion evidence were present. The calculation used the voyage laytime operation to select the applicable completion event.
                    </p>
                  )}
                  {(operationSelectionAudit.excludedCompletionCount ?? 0) > 0 && (
                    <CalcRow
                      label="Excluded mismatched completion events"
                      value={String(operationSelectionAudit.excludedCompletionCount)}
                      valueColor="#9A3412"
                      bold
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Component 2 — Annotation flags */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <p className="mb-2.5" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Annotation flags
            </p>
            <div className="flex flex-col gap-2">
              <AnnotationFlag
                evLabel="Event 05 — Disputed"
                desc="Counterparty contests weather delay classification. Supporting weather report from terminal required."
                color="#B45309"
                bg="#FFFBEB"
              />
              <AnnotationFlag
                evLabel="Event 10 — Pending"
                desc="Post-loading period not yet classified. Affects net laytime position by up to 3h 20m."
                color="#1A4ED8"
                bg="#EFF6FF"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">          </div>
        </div>
      </div>
    </div>
  );
}




