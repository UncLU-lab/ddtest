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
  createBulkDispute,
  getLaytimeCalculations,
  getSofDocuments,
  getSofEvents,
  runLaytimeCalculation,
  updateSofEvent,
  type LaytimeCalculation,
  type SofDocument,
  type SofEvent,
} from "../lib/api";

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
};

type ManualEventForm = {
  eventTime: string;
  eventType: string;
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

function formatMoney(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "—";

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);

  return `$${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function getCalculationSnapshot(calc?: LaytimeCalculation | null): any {
  return (calc as any)?.decisionSnapshot ?? null;
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
    "cargo completed": "CARGO_COMPLETED",
    "loading completed": "LOADING_COMPLETED",
    "discharge completed": "DISCHARGE_COMPLETED",
    "completion of cargo": "COMPLETION_OF_CARGO",
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
  { value: "CARGO_COMPLETED", label: "Cargo completed" },
  { value: "LOADING_COMPLETED", label: "Loading completed" },
  { value: "DISCHARGE_COMPLETED", label: "Discharge completed" },
  { value: "WORK_STOPPED", label: "Work stopped" },
  { value: "WORK_RESUMED", label: "Work resumed" },
  { value: "RAIN_STOPPAGE", label: "Rain stoppage" },
  { value: "RAIN_STOPPED", label: "Rain stopped" },
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
    remarks: event.remarks,
    isManualOverride: event.isManualOverride,
    n: String(index + 1).padStart(2, "0"),
    state,
    timestamp: formatDateTime(event.eventTime),
    name: humanizeLabel(event.eventType),
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
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimRunning, setClaimRunning] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

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
        setTimelineError(error?.message ?? "Unable to load SOF timeline.");
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

  const activeDocument = documents[0] ?? null;
  const displayEvents = id ? timelineEvents : initialEvents;
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

      setShowAddEvent(false);
      setEditingEvent(null);
      setRefreshKey((current) => current + 1);
    } catch (error: any) {
      setTimelineError(error?.message ?? "Unable to save SOF event.");
    } finally {
      setSavingEvent(false);
    }
  }

  const sourceStatusLabel = documentStatusLabel(activeDocument);
  const sourceStatusBg = documentStatusBg(activeDocument);
  const sourceStatusText = documentStatusText(activeDocument);
  const sourceFileName = fileNameFromPath(activeDocument?.filePath);
  const sourceSubtext = activeDocument
    ? `Uploaded ${formatDate(activeDocument.uploadDate)} · backend record`
    : "No persisted SOF document found for this voyage yet.";

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
  const calculationPeriods = getCalculationPeriods(laytimeCalculation);
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
  const demurrageAmount = formatMoney((laytimeCalculation as any)?.demurrageAmount);
  const despatchAmount = formatMoney((laytimeCalculation as any)?.despatchAmount);
  const netPositionValue =
    laytimeCalculation && Number((laytimeCalculation as any)?.demurrageAmount) > 0
      ? `${demurrageAmount} demurrage`
      : laytimeCalculation && Number((laytimeCalculation as any)?.despatchAmount) > 0
        ? `${despatchAmount} despatch`
        : laytimeCalculation
          ? "$0.00"
          : "—";
  const supplierClockStart = formatDateTime(calculationSnapshot?.commencement?.commencedAt);
  const demurrageAmountValue = Number((laytimeCalculation as any)?.demurrageAmount ?? 0);
  const despatchAmountValue = Number((laytimeCalculation as any)?.despatchAmount ?? 0);
  const hasClaimableAmount = Boolean(laytimeCalculation) && (demurrageAmountValue > 0 || despatchAmountValue > 0);
  const claimHelperText = !laytimeCalculation
    ? "No persisted laytime calculation yet."
    : hasClaimableAmount
      ? "Create a claim from the persisted laytime calculation."
      : "No claimable amount from this laytime calculation.";

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

    if (demurrageAmountValue <= 0 && despatchAmountValue <= 0) {
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

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      {(showAddEvent || editingEvent) && (
        <AddEventModal
          mode={editingEvent ? "edit" : "add"}
          event={editingEvent}
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
          { label: "Net position", value: netPositionValue, vc: "#B45309", sub: hasLaytimeCalculation ? "Backend demurrage/despatch result" : "No persisted calculation yet" },
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
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">                <button
                  className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
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
                  { label: "8 counting", bg: "#C6F6D5", text: "#22543D" },
                  { label: "2 deductible", bg: "#F3F4F6", text: "#374151" },
                  { label: "1 pending", bg: "#EFF6FF", text: "#1E40AF" },
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

            {/* Warning strip */}
            <div
              className="flex items-center gap-2.5 px-4 py-2.5"
              style={{
                backgroundColor: "#FFFBEB",
                borderLeft: "2.5px solid #F59E0B",
                borderBottom: "0.5px solid #E5E7EB",
              }}
            >
              <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: "11px", color: "#7B341E", lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 500 }}>Event 05 disputed:</strong> Counterparty contests weather deductibility. Awaiting supporting documentation from terminal agent. Event 10 pending classification.
              </p>
            </div>

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
                  {displayEvents.map((ev, i) => (
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
                          className="w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer"
                          style={{ color: "#9CA3AF", border: "none", backgroundColor: "transparent" }}
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
                className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ height: "32px", fontSize: "12px", color: "#6B7280", border: "0.5px dashed #D1D5DB", backgroundColor: "transparent" }}
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
            <p className="mb-1.5" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>Supplier clock</p>
            <CalcRow label="NOR tendered" value="23 Oct 08:00" />
            <CalcRow label="Laytime starts" value="23 Oct 14:00" />
            <CalcRow label="Allowed" value="72h 00m" valueColor="#1A4ED8" bold />
            <CalcRow label="Used (gross)" value="58h 20m" />
            <CalcRow label="Deductions" value="−4h 00m" valueColor="#22543D" />
            <CalcRow label="Net used" value="54h 20m" valueColor="#B45309" bold />
            <CalcRow label="Remaining" value="17h 40m" valueColor="#22543D" bold />

            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0" }} />

            {/* Receiver clock */}
            <p className="mb-1.5" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>Receiver clock</p>
            <CalcRow label="Clock starts" value="24 Oct 00:00" />
            <CalcRow label="Allowed" value="48h 00m" valueColor="#1A4ED8" bold />
            <CalcRow label="Net used" value="44h 20m" valueColor="#B45309" bold />
            <CalcRow label="Remaining" value="3h 40m" valueColor="#22543D" bold />
          </div>

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




