import {
  reversibleSettlementStatusLabel,
  type LaytimeCalculation,
  type LaytimeCalculationAudit,
  type LaytimeOperationResult,
  type ReversibleSettlementStatus,
} from "../lib/api";

type ResultCalculation = LaytimeCalculation | LaytimeOperationResult;
type PersistedRecord = Record<string, any>;

type TimelineCategoryKey =
  | "counted"
  | "demurrage"
  | "weather"
  | "shex"
  | "operational"
  | "excluded"
  | "unknown";

type TimelineCategory = {
  key: TimelineCategoryKey;
  label: string;
  counts: string;
  backgroundColor: string;
  borderColor: string;
  pattern: string;
};

type TimelinePeriod = {
  period: PersistedRecord;
  index: number;
  start: number;
  end: number;
  category: TimelineCategory;
};

type TimelineMarker = {
  key: "commencement" | "allowance" | "completion";
  label: string;
  timestamp: number;
};

const CATEGORY_STYLES: Record<
  TimelineCategoryKey,
  Omit<TimelineCategory, "key" | "label" | "counts">
> = {
  counted: {
    backgroundColor: "#BFDBFE",
    borderColor: "#2563EB",
    pattern: "none",
  },
  demurrage: {
    backgroundColor: "#FECACA",
    borderColor: "#DC2626",
    pattern:
      "repeating-linear-gradient(135deg, rgba(153,27,27,.16) 0 4px, transparent 4px 8px)",
  },
  weather: {
    backgroundColor: "#FEF3C7",
    borderColor: "#D97706",
    pattern:
      "repeating-linear-gradient(135deg, rgba(146,64,14,.18) 0 3px, transparent 3px 7px)",
  },
  shex: {
    backgroundColor: "#EDE9FE",
    borderColor: "#7C3AED",
    pattern:
      "repeating-linear-gradient(45deg, rgba(91,33,182,.16) 0 3px, transparent 3px 7px)",
  },
  operational: {
    backgroundColor: "#FDE68A",
    borderColor: "#B45309",
    pattern:
      "repeating-linear-gradient(135deg, rgba(120,53,15,.15) 0 2px, transparent 2px 6px)",
  },
  excluded: {
    backgroundColor: "#E5E7EB",
    borderColor: "#6B7280",
    pattern:
      "repeating-linear-gradient(45deg, rgba(55,65,81,.14) 0 2px, transparent 2px 6px)",
  },
  unknown: {
    backgroundColor: "#F1F5F9",
    borderColor: "#64748B",
    pattern:
      "repeating-linear-gradient(90deg, rgba(71,85,105,.12) 0 2px, transparent 2px 6px)",
  },
};

function readableLabel(value: unknown, fallback = "Not available") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(start: unknown, end: unknown) {
  const startTime = new Date(String(start ?? ""));
  const endTime = new Date(String(end ?? ""));
  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime()) ||
    endTime <= startTime
  ) {
    return "Not available";
  }
  const totalMinutes = Math.max(
    0,
    Math.round((endTime.getTime() - startTime.getTime()) / 60000),
  );
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

function parsedTime(value: unknown) {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function decisionSnapshot(
  calculation: ResultCalculation,
  audit?: LaytimeCalculationAudit | null,
) {
  if (audit?.decisions && Object.keys(audit.decisions).length > 0) {
    return audit.decisions as PersistedRecord;
  }
  return (calculation.decisionSnapshot ?? null) as PersistedRecord | null;
}

function persistedPeriods(
  calculation: ResultCalculation,
  audit?: LaytimeCalculationAudit | null,
) {
  const snapshot = decisionSnapshot(calculation, audit);
  const settlementTimeline = snapshot?.reversibleSettlement?.timeline;
  if (Array.isArray(settlementTimeline) && settlementTimeline.length > 0) {
    return settlementTimeline.map((segment: PersistedRecord) => ({
      ...segment,
      periodType:
        segment.classification ??
        segment.periodType ??
        segment.originalClassification,
    }));
  }

  if (Array.isArray(snapshot?.periods)) return snapshot.periods;
  const calculationPeriods = (calculation as any).periods;
  return Array.isArray(calculationPeriods) ? calculationPeriods : [];
}

function periodReason(period: PersistedRecord) {
  const kinds = Array.isArray(period.exceptionKinds)
    ? period.exceptionKinds
    : period.exceptionKind
      ? [period.exceptionKind]
      : [];
  const calendarReasons = Array.isArray(period.calendarDates)
    ? period.calendarDates.flatMap((entry: PersistedRecord) =>
        Array.isArray(entry?.reasons) ? entry.reasons : [],
      )
    : [];
  const labels = [
    ...kinds.map((kind: unknown) =>
      kind === "weather"
        ? "Weather stoppage"
        : kind === "shex"
          ? "SHEX calendar exception"
          : "Operational exception",
    ),
    ...calendarReasons.map((reason: unknown) => readableLabel(reason)),
  ].filter(Boolean);

  if (labels.length > 0) return Array.from(new Set(labels)).join("; ");
  if (period.periodType === "exception") return "Contractual exception";
  if (period.periodType === "demurrage") return "Demurrage time";
  if (period.periodType === "laytime") return "Countable laytime";
  return readableLabel(period.periodType, "Persisted calculation period");
}

function timelineCategory(period: PersistedRecord): TimelineCategory {
  if (period.periodType === "laytime") {
    return {
      key: "counted",
      label: "Countable laytime",
      counts: "Yes",
      ...CATEGORY_STYLES.counted,
    };
  }
  if (period.periodType === "demurrage") {
    return {
      key: "demurrage",
      label: "Demurrage time",
      counts: "Yes · after allowance",
      ...CATEGORY_STYLES.demurrage,
    };
  }

  const kinds = Array.isArray(period.exceptionKinds)
    ? period.exceptionKinds
    : period.exceptionKind
      ? [period.exceptionKind]
      : [];
  if (period.periodType === "exception" && kinds.includes("weather")) {
    return {
      key: "weather",
      label: "Weather exclusion",
      counts: "No",
      ...CATEGORY_STYLES.weather,
    };
  }
  if (period.periodType === "exception" && kinds.includes("shex")) {
    return {
      key: "shex",
      label: "SHEX / calendar exclusion",
      counts: "No",
      ...CATEGORY_STYLES.shex,
    };
  }
  if (period.periodType === "exception" && kinds.includes("generic")) {
    return {
      key: "operational",
      label: "Operational stoppage",
      counts: "No",
      ...CATEGORY_STYLES.operational,
    };
  }
  if (period.periodType === "exception") {
    return {
      key: "excluded",
      label: "Excluded / deducted",
      counts: "No",
      ...CATEGORY_STYLES.excluded,
    };
  }

  return {
    key: "unknown",
    label: readableLabel(period.periodType, "Persisted period"),
    counts: "Not recorded",
    ...CATEGORY_STYLES.unknown,
  };
}

function operationLabel(
  calculation: ResultCalculation,
  periods: PersistedRecord[],
) {
  const operation = (calculation as any).operation;
  if (operation === "Loading" || operation === "Discharge") return operation;
  const operations = Array.from(
    new Set(
      periods
        .map((period) => period.operation)
        .filter(
          (value): value is "Loading" | "Discharge" =>
            value === "Loading" || value === "Discharge",
        ),
    ),
  );
  if (operations.length > 0) return operations.join(" + ");
  return (
    calculation.inputSnapshot?.operationSelection?.voyageLaytimeOperation ??
    "Operation scope not recorded"
  );
}

function authorityLabel(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
  referenceOnly: boolean,
  authorityStatus?: ReversibleSettlementStatus,
) {
  const status =
    authorityStatus ??
    calculation.settlementAuthorityStatus ??
    snapshot?.reversibleSettlement?.settlementStatus;
  if (referenceOnly) {
    return status !== "NONAUTHORITATIVE" && status !== "LEGACY"
      ? "Supporting evidence · parent settlement authoritative"
      : "Supporting evidence · parent settlement not authoritative";
  }
  if (status) return reversibleSettlementStatusLabel(status);
  return calculation.status === "Final"
    ? "FINAL - AUTHORITATIVE"
    : "PROVISIONAL";
}

function isAuthoritative(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
  referenceOnly: boolean,
  authorityStatus?: ReversibleSettlementStatus,
) {
  if (referenceOnly) return false;
  const status =
    authorityStatus ??
    calculation.settlementAuthorityStatus ??
    snapshot?.reversibleSettlement?.settlementStatus;
  return status ? status === "FINAL_AUTHORITATIVE" : calculation.status === "Final";
}

function markerValue(
  snapshot: PersistedRecord | null,
  key: TimelineMarker["key"],
) {
  if (key === "commencement") return snapshot?.commencement?.commencedAt;
  if (key === "completion") {
    return (
      snapshot?.cargoCompletion?.selectedTime ??
      snapshot?.cargoCompletion?.eventTime ??
      snapshot?.cargoCompletion?.completionTime
    );
  }
  return (
    snapshot?.reversibleSettlement?.threshold?.timestamp ??
    snapshot?.demurrage?.startedAt
  );
}

function TimelineLegend({
  categories,
  hasRestoration,
}: {
  categories: TimelineCategory[];
  hasRestoration: boolean;
}) {
  const entries = Array.from(
    new Map(categories.map((category) => [category.key, category])).values(),
  );
  return (
    <div
      aria-label="Timeline legend"
      className="flex flex-wrap gap-x-4 gap-y-2 mt-3"
      style={{ fontSize: "11px", color: "#475569" }}
    >
      {entries.map((entry) => (
        <span key={entry.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              border: `1px solid ${entry.borderColor}`,
              backgroundColor: entry.backgroundColor,
              backgroundImage: entry.pattern,
            }}
          />
          {entry.label}
        </span>
      ))}
      {hasRestoration && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              border: "1px solid #047857",
              backgroundColor: "#A7F3D0",
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(6,78,59,.18) 0 3px, transparent 3px 7px)",
            }}
          />
          Restored working time
        </span>
      )}
    </div>
  );
}

export function PersistedLaytimeTimeline({
  calculation,
  audit,
  referenceOnly = false,
  authorityStatus,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
  referenceOnly?: boolean;
  authorityStatus?: ReversibleSettlementStatus;
}) {
  const snapshot = decisionSnapshot(calculation, audit);
  const rawPeriods = persistedPeriods(calculation, audit);
  const periods = rawPeriods
    .map((period, index): TimelinePeriod | null => {
      const start = parsedTime(period.startTime);
      const end = parsedTime(period.endTime);
      return start !== null && end !== null && end > start
        ? { period, index, start, end, category: timelineCategory(period) }
        : null;
    })
    .filter((period): period is TimelinePeriod => period !== null);
  const restorationIntervals = (
    Array.isArray(snapshot?.atutc?.restoredIntervals)
      ? snapshot.atutc.restoredIntervals
      : []
  )
    .map((interval: PersistedRecord, index: number) => {
      const start = parsedTime(interval.startTime);
      const end = parsedTime(interval.endTime);
      return start !== null && end !== null && end > start
        ? { interval, index, start, end }
        : null;
    })
    .filter(
      (interval): interval is NonNullable<typeof interval> => interval !== null,
    );
  const markers = (
    [
      { key: "commencement", label: "Commencement" },
      { key: "allowance", label: "Laytime allowance exhausted" },
      { key: "completion", label: "Cargo completion" },
    ] as const
  )
    .map((definition) => ({
      ...definition,
      timestamp: parsedTime(markerValue(snapshot, definition.key)),
    }))
    .filter(
      (marker): marker is TimelineMarker => marker.timestamp !== null,
    );
  const operation = operationLabel(calculation, rawPeriods);
  const status = authorityLabel(
    calculation,
    snapshot,
    referenceOnly,
    authorityStatus,
  );
  const authoritative = isAuthoritative(
    calculation,
    snapshot,
    referenceOnly,
    authorityStatus,
  );

  if (periods.length === 0) {
    return (
      <section
        aria-label="Persisted laytime timeline"
        className="rounded-xl border p-4"
        style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p
              style={{
                fontSize: "11px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Visual interpretation
            </p>
            <h4
              style={{
                fontSize: "15px",
                color: "#111827",
                fontWeight: 600,
                marginTop: "3px",
              }}
            >
              Persisted laytime timeline
            </h4>
          </div>
          <span style={{ fontSize: "11px", color: "#64748B" }}>{status}</span>
        </div>
        <p
          className="mt-3 rounded-lg border px-3 py-2"
          style={{
            fontSize: "11px",
            lineHeight: 1.45,
            borderColor: "#E5E7EB",
            backgroundColor: "#F9FAFB",
            color: "#475569",
          }}
        >
          No persisted period detail is available for a visual timeline. The
          existing persisted summary and period table remain available below.
        </p>
      </section>
    );
  }

  const timelineStart = Math.min(
    ...periods.flatMap((period) => [period.start, period.end]),
    ...markers.map((marker) => marker.timestamp),
    ...restorationIntervals.flatMap((interval) => [interval.start, interval.end]),
  );
  const timelineEnd = Math.max(
    ...periods.flatMap((period) => [period.start, period.end]),
    ...markers.map((marker) => marker.timestamp),
    ...restorationIntervals.flatMap((interval) => [interval.start, interval.end]),
  );
  const timelineSpan = Math.max(1, timelineEnd - timelineStart);
  const position = (timestamp: number) =>
    Math.min(100, Math.max(0, ((timestamp - timelineStart) / timelineSpan) * 100));
  const width = (start: number, end: number) =>
    Math.max(0.8, ((end - start) / timelineSpan) * 100);

  return (
    <section
      aria-label="Persisted laytime timeline"
      className="rounded-xl border p-4"
      style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p
            style={{
              fontSize: "11px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Visual interpretation
          </p>
          <h4
            style={{
              fontSize: "15px",
              color: "#111827",
              fontWeight: 600,
              marginTop: "3px",
            }}
          >
            Persisted laytime timeline
          </h4>
          <p style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>
            {operation} · {periods.length} persisted period
            {periods.length === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1"
          style={{
            fontSize: "11px",
            backgroundColor: authoritative ? "#DCFCE7" : "#FEF3C7",
            color: authoritative ? "#166534" : "#92400E",
          }}
        >
          {status}
        </span>
      </div>

      <p className="mt-3" style={{ fontSize: "11px", color: "#475569" }}>
        Segments and markers below are read from persisted calculation periods,
        decisions, and audit data. Hover or focus a segment for its persisted
        detail.
      </p>

      <div
        className="mt-3 overflow-x-auto"
        role="region"
        aria-label={`${operation} persisted laytime timeline`}
      >
        <div style={{ minWidth: "720px" }}>
          <div
            role="list"
            aria-label="Persisted laytime periods"
            style={{
              position: "relative",
              height: "86px",
              borderBottom: "1px solid #CBD5E1",
              borderTop: "1px solid #E2E8F0",
              background:
                "linear-gradient(to bottom, transparent 49%, #F8FAFC 50%, transparent 51%)",
            }}
          >
            {periods.map(({ period, index, start, end, category }) => {
              const reason = periodReason(period);
              const periodOperation = period.operation ?? operation;
              const description = `${category.label}; ${formatDateTime(
                period.startTime,
              )} to ${formatDateTime(period.endTime)}; ${formatDuration(
                period.startTime,
                period.endTime,
              )}; ${reason}; counts as laytime: ${category.counts}; operation: ${periodOperation}`;
              return (
                <div
                  key={`${String(period.startTime)}-${String(period.endTime)}-${index}`}
                  role="listitem"
                  tabIndex={0}
                  title={description}
                  aria-label={description}
                  data-timeline-category={category.key}
                  style={{
                    position: "absolute",
                    left: `${position(start)}%`,
                    width: `${width(start, end)}%`,
                    top: "24px",
                    height: "36px",
                    minWidth: "8px",
                    border: `1px solid ${category.borderColor}`,
                    borderRadius: "5px",
                    backgroundColor: category.backgroundColor,
                    backgroundImage: category.pattern,
                  }}
                />
              );
            })}
            {markers.map((marker) => (
              <div
                key={marker.key}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${position(marker.timestamp)}%`,
                  top: 0,
                  height: "100%",
                  borderLeft:
                    marker.key === "allowance"
                      ? "2px dashed #B91C1C"
                      : "2px solid #334155",
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: "5px",
                    whiteSpace: "nowrap",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: marker.key === "allowance" ? "#991B1B" : "#334155",
                  }}
                >
                  {marker.label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="flex items-start justify-between gap-4 mt-2"
            style={{ fontSize: "10px", color: "#64748B" }}
          >
            <span>{formatDateTime(new Date(timelineStart).toISOString())}</span>
            <span>{formatDateTime(new Date(timelineEnd).toISOString())}</span>
          </div>

          {markers.length > 0 && (
            <ul
              className="flex flex-wrap gap-x-4 gap-y-1 mt-2"
              style={{ fontSize: "10px", color: "#475569" }}
              aria-label="Timeline markers"
            >
              {markers.map((marker) => (
                <li key={marker.key}>
                  <strong>{marker.label}:</strong>{" "}
                  {formatDateTime(new Date(marker.timestamp).toISOString())}
                </li>
              ))}
            </ul>
          )}

          {restorationIntervals.length > 0 && (
            <div className="mt-3">
              <p style={{ fontSize: "10px", color: "#475569", fontWeight: 600 }}>
                ATUTC restored working time (persisted)
              </p>
              <div
                role="list"
                aria-label="Persisted ATUTC restoration intervals"
                style={{
                  position: "relative",
                  height: "28px",
                  marginTop: "4px",
                  borderRadius: "5px",
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                }}
              >
                {restorationIntervals.map(({ interval, index, start, end }) => (
                  <div
                    key={`${String(interval.startTime)}-${String(interval.endTime)}-${index}`}
                    role="listitem"
                    tabIndex={0}
                    title={`Restored working time; ${formatDateTime(
                      interval.startTime,
                    )} to ${formatDateTime(interval.endTime)}; ${formatDuration(
                      interval.startTime,
                      interval.endTime,
                    )}`}
                    aria-label={`Restored working time; ${formatDateTime(
                      interval.startTime,
                    )} to ${formatDateTime(interval.endTime)}; ${formatDuration(
                      interval.startTime,
                      interval.endTime,
                    )}`}
                    style={{
                      position: "absolute",
                      left: `${position(start)}%`,
                      width: `${width(start, end)}%`,
                      top: "5px",
                      height: "16px",
                      minWidth: "8px",
                      border: "1px solid #047857",
                      borderRadius: "4px",
                      backgroundColor: "#A7F3D0",
                      backgroundImage:
                        "repeating-linear-gradient(135deg, rgba(6,78,59,.18) 0 3px, transparent 3px 7px)",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <TimelineLegend
        categories={periods.map((period) => period.category)}
        hasRestoration={restorationIntervals.length > 0}
      />
      {restorationIntervals.length > 0 && (
        <p className="mt-2" style={{ fontSize: "11px", color: "#047857" }}>
          Restored working time is shown as a separate persisted ATUTC overlay;
          the underlying period classifications remain unchanged.
        </p>
      )}
    </section>
  );
}
