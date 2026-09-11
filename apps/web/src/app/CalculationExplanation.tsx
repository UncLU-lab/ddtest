import {
  reversibleSettlementStatusLabel,
  type LaytimeCalculation,
  type LaytimeCalculationAudit,
  type LaytimeOperationResult,
  type ReversibleSettlementStatus,
} from "../lib/api";
import { formatCurrencyAmount } from "../lib/currency";
import type { ReactNode } from "react";

type ResultCalculation = LaytimeCalculation | LaytimeOperationResult;
type PersistedRecord = Record<string, any>;

type Props = {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
  referenceOnly?: boolean;
  authorityStatus?: ReversibleSettlementStatus;
};

function snapshotFor(
  calculation: ResultCalculation,
  audit?: LaytimeCalculationAudit | null,
) {
  if (audit?.decisions && Object.keys(audit.decisions).length > 0) {
    return audit.decisions as PersistedRecord;
  }
  return (calculation.decisionSnapshot ?? null) as PersistedRecord | null;
}

function explanationSnapshotFor(
  calculation: ResultCalculation,
  audit?: LaytimeCalculationAudit | null,
) {
  const snapshot = snapshotFor(calculation, audit);
  const primaryReference = snapshot?.referencePrimaryOperation;
  if (!snapshot || !primaryReference || typeof primaryReference !== "object") {
    return snapshot;
  }

  return {
    ...snapshot,
    commencement: snapshot.commencement ?? primaryReference.commencement,
    cargoCompletion: snapshot.cargoCompletion ?? primaryReference.cargoCompletion,
    periods:
      Array.isArray(snapshot.periods) && snapshot.periods.length > 0
        ? snapshot.periods
        : primaryReference.periods,
  } as PersistedRecord;
}

function inputSnapshotFor(calculation: ResultCalculation) {
  return (calculation.inputSnapshot ?? null) as PersistedRecord | null;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function textValue(value: unknown, fallback = "Not available in this calculation version") {
  return hasValue(value) ? String(value) : fallback;
}

function humanize(value: unknown, fallback = "Not recorded") {
  if (!hasValue(value)) return fallback;
  const raw = String(value).trim();
  const knownLabels: Record<string, string> = {
    nor_accepted: "Accepted NOR",
    nor_tendered: "Tendered NOR",
    sof_nor_tendered: "SOF NOR tendered",
    operation_specific: "Operation-specific evidence",
    "legacy-null": "Legacy null-operation fallback",
    unscoped: "Unscoped evidence",
    missing: "Evidence missing",
    "granted-before-nor": "Free pratique granted before NOR",
    "granted-after-nor": "Free pratique granted after NOR",
    "waived-by-wifpon": "WIFPON waiver applied",
    unavailable: "Unavailable",
    "dry-bulk-hatches-closed": "Dry-bulk hatches closed",
    "dry-bulk-cargo-secured-fallback": "Dry-bulk cargo secured fallback",
    "tanker-hoses-disconnected": "Tanker hoses disconnected",
    "legacy-completion-fallback": "Legacy completion fallback",
    "FINAL_AUTHORITATIVE": "FINAL - AUTHORITATIVE",
    PROVISIONAL: "PROVISIONAL",
    NONAUTHORITATIVE: "NON-AUTHORITATIVE",
    LEGACY: "LEGACY",
  };
  if (knownLabels[raw]) return knownLabels[raw];
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: unknown) {
  if (!hasValue(value)) return "Not available in this calculation version";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Not available in this calculation version"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatInterval(value: unknown) {
  if (!hasValue(value)) return "Not available in this calculation version";
  const match = String(value).match(
    /^(?:(-?\d+) days? )?(\d{1,2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return String(value);
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return `${days * 24 + hours}h ${minutes}m`;
}

function formatSeconds(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not available in this calculation version";
  }
  const totalMinutes = Math.max(0, Math.round(value / 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

function formatDuration(start: unknown, end: unknown) {
  const startTime = new Date(String(start ?? ""));
  const endTime = new Date(String(end ?? ""));
  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime()) ||
    endTime <= startTime
  ) {
    return "Not available in this calculation version";
  }
  return formatSeconds((endTime.getTime() - startTime.getTime()) / 1000);
}

function formatBoolean(value: unknown) {
  return typeof value === "boolean"
    ? value
      ? "Yes"
      : "No"
    : "Not recorded";
}

function formatIdentifier(value: unknown) {
  return hasValue(value) ? String(value) : "Not available in this calculation version";
}

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function asRecords(value: unknown): PersistedRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is PersistedRecord =>
          Boolean(entry) && typeof entry === "object",
      )
    : [];
}

function operationLabel(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
) {
  const operation = (calculation as any).operation;
  if (operation === "Loading" || operation === "Discharge") return operation;
  return (
    snapshot?.shexCalendar?.operation ??
    inputSnapshotFor(calculation)?.operationSelection?.voyageLaytimeOperation ??
    inputSnapshotFor(calculation)?.operationResult?.operation ??
    "Operation scope not recorded"
  );
}

function getAuthorityStatus(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
  referenceOnly: boolean,
  authorityStatusOverride?: ReversibleSettlementStatus,
) {
  const status =
    authorityStatusOverride ??
    calculation.settlementAuthorityStatus ??
    snapshot?.reversibleSettlement?.settlementStatus;
  if (referenceOnly) return "Supporting evidence only";
  if (status) return reversibleSettlementStatusLabel(status);
  return calculation.status === "Final"
    ? "FINAL - AUTHORITATIVE"
    : "PROVISIONAL";
}

function valueLabel(value: unknown) {
  if (typeof value === "boolean") return formatBoolean(value);
  return textValue(value);
}

function ValueRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: unknown;
  emphasize?: boolean;
}) {
  if (!hasValue(value)) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span style={{ fontSize: "11px", color: "#6B7280" }}>{label}</span>
      <span
        style={{
          fontSize: "11px",
          color: emphasize ? "#1E40AF" : "#374151",
          fontWeight: emphasize ? 600 : 400,
          textAlign: "right",
          maxWidth: "68%",
        }}
      >
        {valueLabel(value)}
      </span>
    </div>
  );
}

function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "success" }) {
  const palette = {
    neutral: { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#475569" },
    warning: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB", color: "#92400E" },
    success: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", color: "#166534" },
  }[tone];
  return (
    <p
      className="mt-2 rounded-lg border px-3 py-2"
      style={{ fontSize: "11px", lineHeight: 1.45, ...palette }}
    >
      {children}
    </p>
  );
}

function ExplanationSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <h5 style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{title}</h5>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BulletList({ values, label }: { values: string[]; label?: string }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-2">
      {label && <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px" }}>{label}</p>}
      <ul className="list-disc pl-4 space-y-1" style={{ fontSize: "11px", color: "#475569" }}>
        {values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}
      </ul>
    </div>
  );
}

function CandidateLabel(candidate: PersistedRecord) {
  const source = humanize(candidate.source, "NOR candidate");
  const id = candidate.norDocumentId ?? candidate.norTenderedEventId;
  return id ? `${source} · ${id}` : source;
}

function periodClassification(period: PersistedRecord) {
  if (period.periodType === "laytime") return "Countable laytime";
  if (period.periodType === "demurrage") return "Demurrage time";
  if (period.periodType === "exception") {
    const kinds = Array.isArray(period.exceptionKinds)
      ? period.exceptionKinds
      : period.exceptionKind
        ? [period.exceptionKind]
        : [];
    if (kinds.includes("weather")) return "Weather exclusion";
    if (kinds.includes("shex")) return "SHEX / calendar exclusion";
    if (kinds.includes("generic")) return "Operational stoppage";
    return "Excluded / deducted";
  }
  return humanize(period.periodType, "Persisted period");
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
    ...kinds.map((kind: unknown) => humanize(kind, "Exception")),
    ...calendarReasons.map((reason: unknown) => humanize(reason, "Calendar rule")),
  ];
  return uniqueStrings(labels).join("; ") || humanize(period.periodType, "Persisted classification");
}

function persistedPeriods(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
) {
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
  const periods = (calculation as any).periods;
  return Array.isArray(periods) ? periods : [];
}

function collectWarnings(
  calculation: ResultCalculation,
  audit: LaytimeCalculationAudit | null | undefined,
  snapshot: PersistedRecord | null,
) {
  const warnings: unknown[] = [
    ...(calculation.warnings ?? []),
    ...(audit?.warnings ?? []),
    ...(Array.isArray(snapshot?.warnings) ? snapshot.warnings : []),
    ...(snapshot?.commencement?.validityWarnings ?? []),
    ...(snapshot?.commencement?.freePratique?.warnings ?? []),
    ...(snapshot?.commencement?.location?.warnings ?? []),
    ...(snapshot?.cargoCompletion?.warnings ?? []),
    ...(snapshot?.reversibleLaytimeRule?.warnings ?? []),
    ...(snapshot?.reversibleSettlement?.warnings ?? []),
  ];
  const rejected = [
    ...asRecords(snapshot?.commencement?.rejectedNorCandidates),
    ...asRecords(snapshot?.commencement?.freePratiqueRejectedCandidates),
  ];
  rejected.forEach((candidate) => {
    warnings.push(...(candidate.warnings ?? []));
    warnings.push(...(candidate.freePratique?.warnings ?? []));
  });
  return uniqueStrings(warnings);
}

function warningGroup(warning: string) {
  if (/legacy|fallback|unscoped|null-operation/i.test(warning)) return "Legacy fallback";
  if (/authorit|settlement|currency|reversib|pooled|reference/i.test(warning)) return "Authority / settlement limitation";
  if (/ambig|conflict|clause|contract|unsupported|rate/i.test(warning)) return "Contractual ambiguity";
  if (/provisional|draft|final/i.test(warning)) return "Provisional calculation";
  if (/evidence|candidate|readiness|NOR|free-pratique|location/i.test(warning)) return "Evidence quality";
  return "Other persisted note";
}

function WarningSection({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  const grouped = new Map<string, string[]>();
  warnings.forEach((warning) => {
    const group = warningGroup(warning);
    grouped.set(group, [...(grouped.get(group) ?? []), warning]);
  });
  return (
    <ExplanationSection title="Warnings / limitations">
      <p style={{ fontSize: "10px", color: "#6B7280", lineHeight: 1.4 }}>
        Groups below are presentation groupings only; the backend warning text is preserved.
      </p>
      <div className="mt-2 space-y-2">
        {Array.from(grouped.entries()).map(([group, entries]) => (
          <div key={group} className="rounded-lg border px-3 py-2" style={{ borderColor: "#FCD34D", backgroundColor: "#FFFBEB" }}>
            <p style={{ fontSize: "11px", color: "#92400E", fontWeight: 600 }}>{group}</p>
            <ul className="list-disc pl-4 mt-1 space-y-1" style={{ fontSize: "11px", color: "#78350F" }}>
              {entries.map((entry) => <li key={entry}>{entry}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </ExplanationSection>
  );
}

function CommencementSection({
  calculation,
  snapshot,
}: {
  calculation: ResultCalculation;
  snapshot: PersistedRecord | null;
}) {
  const commencement = snapshot?.commencement;
  if (!commencement || typeof commencement !== "object") return null;
  const input = inputSnapshotFor(calculation);
  return (
    <ExplanationSection title="Commencement">
      <ValueRow label="Commencement basis" value={humanize(commencement.basis)} />
      <ValueRow label="Commencement rule" value={humanize(commencement.commencementRule)} />
      <ValueRow label="NOR tendered" value={formatDateTime(commencement.tenderTime)} />
      <ValueRow label="NOR accepted" value={formatDateTime(commencement.acceptedTime)} />
      <ValueRow label="Notice period" value={hasValue(commencement.noticeHours) ? `${commencement.noticeHours} hours` : null} />
      <ValueRow label="Notice source" value={humanize(commencement.noticeSource)} />
      <ValueRow label="Office schedule basis" value={humanize(commencement.scheduleBasis)} />
      <ValueRow label="Schedule timezone" value={commencement.scheduleTimeZone} />
      <ValueRow label="Selected commencedAt" value={formatDateTime(commencement.commencedAt)} emphasize />
      <ValueRow label="Validity status" value={humanize(commencement.validityStatus)} />
      <ValueRow label="Validity basis" value={humanize(commencement.validityBasis)} />
      <ValueRow label="Voyage operation" value={
        (calculation as any).operation ??
        input?.operationSelection?.voyageLaytimeOperation ??
        input?.operationResult?.operation
      } />
      <BulletList values={uniqueStrings(commencement.validityWarnings ?? [])} label="Persisted commencement warnings" />
    </ExplanationSection>
  );
}

function NorReadinessSection({
  calculation,
  snapshot,
}: {
  calculation: ResultCalculation;
  snapshot: PersistedRecord | null;
}) {
  const commencement = snapshot?.commencement;
  if (!commencement || typeof commencement !== "object") return null;
  const input = inputSnapshotFor(calculation);
  const rejectedNorCandidates = asRecords(commencement.rejectedNorCandidates);
  const locationRejectedCandidates = asRecords(commencement.locationRejectedCandidates);
  const location = commencement.location;
  const hasDetails =
    hasValue(commencement.norDocumentId) ||
    hasValue(commencement.norTenderedEventId) ||
    hasValue(commencement.readinessEventId) ||
    rejectedNorCandidates.length > 0 ||
    locationRejectedCandidates.length > 0 ||
    (location && typeof location === "object");
  if (!hasDetails) return null;
  return (
    <ExplanationSection title="NOR / readiness">
      <ValueRow label="Selected NOR document" value={formatIdentifier(commencement.norDocumentId)} />
      <ValueRow label="Selected NOR tender event" value={formatIdentifier(commencement.norTenderedEventId)} />
      <ValueRow label="Selected readiness event" value={formatIdentifier(commencement.readinessEventId)} />
      <ValueRow label="Readiness timestamp" value={formatDateTime(commencement.readinessTime)} />
      <ValueRow label="Readiness source" value={humanize(commencement.readinessSource)} />
      <ValueRow label="Readiness validity" value={humanize(commencement.validityBasis)} />
      <ValueRow label="Operation scope" value={
        (calculation as any).operation ??
        input?.operationSelection?.voyageLaytimeOperation ??
        input?.operationResult?.operation
      } />
      {input?.sofDocumentSelection?.oppositeOperationDocumentIds?.length > 0 && (
        <ValueRow
          label="Opposite-operation SOF documents excluded"
          value={String(input.sofDocumentSelection.oppositeOperationDocumentIds.length)}
        />
      )}
      {location && typeof location === "object" && (
        <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
          <p style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>NOR location qualification</p>
          <ValueRow label="Overall status" value={humanize(location.overallStatus)} />
          <ValueRow label="Association basis" value={humanize(location.associationBasis)} />
          <ValueRow label="Berth qualification" value={location.berth?.reason ?? location.berth?.status} />
          <ValueRow label="Port qualification" value={location.port?.reason ?? location.port?.status} />
          <ValueRow label="Selected location evidence" value={location.selectedEvidence?.id ?? location.selectedEvidence?.source} />
          <ValueRow label="Location evidence time" value={formatDateTime(location.selectedEvidence?.evidenceTime)} />
        </div>
      )}
      {rejectedNorCandidates.length > 0 && (
        <div className="mt-3 space-y-2">
          <p style={{ fontSize: "11px", color: "#6B7280" }}>Rejected NOR candidates</p>
          {rejectedNorCandidates.map((candidate, index) => (
            <div key={`${CandidateLabel(candidate)}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
              <p style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>{CandidateLabel(candidate)}</p>
              <ValueRow label="Tendered" value={formatDateTime(candidate.tenderTime)} />
              <BulletList values={uniqueStrings(candidate.warnings ?? [])} label="Persisted rejection warnings" />
              {uniqueStrings(candidate.warnings ?? []).length === 0 && (
                <p className="mt-1" style={{ fontSize: "10px", color: "#6B7280" }}>Persisted rejection detail not recorded.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {locationRejectedCandidates.length > 0 && (
        <div className="mt-3 space-y-2">
          <p style={{ fontSize: "11px", color: "#6B7280" }}>Location-rejected NOR candidates</p>
          {locationRejectedCandidates.map((candidate, index) => (
            <div key={`${CandidateLabel(candidate)}-location-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
              <p style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>{CandidateLabel(candidate)}</p>
              <BulletList values={uniqueStrings(candidate.rejectionReasons ?? [])} label="Persisted location rejection reasons" />
            </div>
          ))}
        </div>
      )}
    </ExplanationSection>
  );
}

function FreePratiqueSection({ snapshot }: { snapshot: PersistedRecord | null }) {
  const commencement = snapshot?.commencement;
  const selected = commencement?.freePratique;
  const rejected = [
    ...asRecords(commencement?.freePratiqueRejectedCandidates),
    ...asRecords(commencement?.rejectedNorCandidates).filter((candidate) => candidate.freePratique),
  ];
  if ((!selected || typeof selected !== "object") && rejected.length === 0) return null;
  const uniqueCandidates = Array.from(
    new Map(
      rejected.map((candidate, index) => [
        `${candidate.norDocumentId ?? candidate.norTenderedEventId ?? "candidate"}-${candidate.freePratique?.eventId ?? index}`,
        candidate,
      ]),
    ).values(),
  );
  return (
    <ExplanationSection title="Free pratique">
      {selected && typeof selected === "object" ? (
        <>
          <ValueRow label="Selected evidence" value={formatIdentifier(selected.eventId)} />
          <ValueRow label="Backend status" value={humanize(selected.status)} />
          <ValueRow label="Grant timestamp" value={formatDateTime(selected.grantedTime)} />
          <ValueRow label="Evidence source" value={selected.source} />
          <ValueRow label="WIFPON enabled" value={selected.wifponEnabled} />
          <ValueRow label="WIFPON applied" value={selected.wifponApplied} />
          {selected.wifponApplied === true && (
            <Notice tone="warning">The backend recorded a WIFPON waiver. This does not mean a free-pratique grant event was present.</Notice>
          )}
          <BulletList values={uniqueStrings(selected.warnings ?? [])} label="Persisted free-pratique warnings" />
        </>
      ) : (
        <Notice>No selected free-pratique evidence is recorded.</Notice>
      )}
      {uniqueCandidates.length > 0 && (
        <div className="mt-3 space-y-2">
          <p style={{ fontSize: "11px", color: "#6B7280" }}>Rejected / non-selected evidence</p>
          {uniqueCandidates.map((candidate, index) => (
            <div key={`${CandidateLabel(candidate)}-free-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
              <p style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>{CandidateLabel(candidate)}</p>
              <ValueRow label="Free-pratique evidence" value={formatIdentifier(candidate.freePratique?.eventId)} />
              <ValueRow label="Backend status" value={humanize(candidate.freePratique?.status)} />
              <ValueRow label="Grant timestamp" value={formatDateTime(candidate.freePratique?.grantedTime)} />
              <BulletList values={uniqueStrings(candidate.freePratique?.warnings ?? [])} label="Persisted evidence warnings" />
            </div>
          ))}
        </div>
      )}
    </ExplanationSection>
  );
}

function CompletionSection({
  calculation,
  snapshot,
}: {
  calculation: ResultCalculation;
  snapshot: PersistedRecord | null;
}) {
  const completion = snapshot?.cargoCompletion;
  if (!completion || typeof completion !== "object") return null;
  const excludedEventIds = Array.isArray(completion.excludedEventIds)
    ? completion.excludedEventIds
    : [];
  const operation =
    (calculation as any).operation ??
    inputSnapshotFor(calculation)?.operationSelection?.voyageLaytimeOperation ??
    inputSnapshotFor(calculation)?.operationResult?.operation;
  return (
    <ExplanationSection title="Cargo completion">
      <ValueRow label="Selected evidence event" value={formatIdentifier(completion.selectedEventId ?? completion.eventId)} emphasize />
      <ValueRow label="Selected evidence type" value={humanize(completion.selectedEventType ?? completion.eventType)} />
      <ValueRow label="Selected completion timestamp" value={formatDateTime(completion.selectedTime ?? completion.eventTime)} emphasize />
      <ValueRow label="Canonical evidence basis" value={humanize(completion.selectionBasis)} />
      <ValueRow label="Operation scope" value={operation} />
      <ValueRow label="Candidate evidence count" value={Array.isArray(completion.candidateEventIds) ? String(completion.candidateEventIds.length) : null} />
      <ValueRow label="Excluded candidate count" value={String(excludedEventIds.length)} />
      {excludedEventIds.length > 0 && (
        <BulletList values={excludedEventIds.map((id: unknown) => String(id))} label="Excluded candidate IDs; persisted reasons were not supplied" />
      )}
      <BulletList values={uniqueStrings(completion.warnings ?? [])} label="Persisted completion warnings" />
    </ExplanationSection>
  );
}

function TimeCountingSection({
  calculation,
  snapshot,
}: {
  calculation: ResultCalculation;
  snapshot: PersistedRecord | null;
}) {
  const periods = persistedPeriods(calculation, snapshot);
  if (periods.length === 0) return null;
  const operation = operationLabel(calculation, snapshot);
  const demurrageBoundary =
    snapshot?.demurrage?.startedAt ??
    snapshot?.reversibleSettlement?.threshold?.timestamp;
  return (
    <ExplanationSection title="Time counting">
      <p style={{ fontSize: "11px", color: "#475569", lineHeight: 1.45 }}>
        These persisted classifications explain the segments in the visual timeline. Totals remain the backend result; this section does not recalculate them.
      </p>
      {demurrageBoundary && (
        <ValueRow
          label="Persisted demurrage boundary"
          value={formatDateTime(demurrageBoundary)}
          emphasize
        />
      )}
      <div className="mt-2 space-y-2">
        {periods.map((period: PersistedRecord, index: number) => {
          const classification = periodClassification(period);
          const counts = period.periodType === "laytime" || period.periodType === "demurrage"
            ? period.periodType === "demurrage" ? "Yes, after allowance" : "Yes"
            : period.periodType === "exception" ? "No" : "Not recorded";
          return (
            <div key={`${String(period.startTime)}-${String(period.endTime)}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
              <p style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>{classification}</p>
              <ValueRow label="Start" value={formatDateTime(period.startTime)} />
              <ValueRow label="End" value={formatDateTime(period.endTime)} />
              <ValueRow label="Duration" value={formatDuration(period.startTime, period.endTime)} />
              <ValueRow label="Counts as laytime" value={counts} />
              <ValueRow label="Reason / category" value={periodReason(period)} />
              <ValueRow label="Operation" value={period.operation ?? operation} />
            </div>
          );
        })}
      </div>
    </ExplanationSection>
  );
}

function WeatherSection({ snapshot, periods }: { snapshot: PersistedRecord | null; periods: PersistedRecord[] }) {
  const weather = snapshot?.weatherWorking;
  if (!weather || typeof weather !== "object") return null;
  const weatherPeriods = periods.filter((period) => {
    const kinds = Array.isArray(period.exceptionKinds)
      ? period.exceptionKinds
      : period.exceptionKind
        ? [period.exceptionKind]
        : [];
    return kinds.includes("weather");
  });
  return (
    <ExplanationSection title="Weather">
      <ValueRow label="Weather rule enabled" value={weather.enabled} />
      <ValueRow label="Backend decision applied" value={weather.applied} />
      <ValueRow label="Excluded duration before demurrage" value={formatSeconds(weather.totalWeatherTimeDeductedBeforeDemurrage)} emphasize />
      <ValueRow label="Persisted weather-classified periods" value={String(weatherPeriods.length)} />
      {weather.applied === true ? (
        <Notice tone="success">The backend recorded the weather rule as applied. The affected persisted period classifications are shown above.</Notice>
      ) : weather.applied === false ? (
        <Notice>The backend recorded the weather rule as not applied.</Notice>
      ) : (
        <Notice>The backend did not record whether the weather rule applied.</Notice>
      )}
    </ExplanationSection>
  );
}

function CalendarSection({ snapshot }: { snapshot: PersistedRecord | null }) {
  const calendar = snapshot?.shexCalendar;
  if (!calendar || typeof calendar !== "object") return null;
  const generatedIntervals = Array.isArray(calendar.generatedIntervals)
    ? calendar.generatedIntervals
    : [];
  return (
    <ExplanationSection title="Calendar / SHEX / SHINC">
      <ValueRow label="Counting basis" value={calendar.shex === true ? "SHEX" : calendar.shex === false ? "SHINC" : null} />
      <ValueRow label="Calendar timezone" value={calendar.timeZone} />
      <ValueRow label="Generated calendar interval count" value={String(generatedIntervals.length)} />
      <ValueRow label="Calendar source" value={humanize(calendar.sourceType)} />
      <ValueRow label="Legacy calendar handling used" value={calendar.legacyCompatibilityUsed} />
      <ValueRow label="Saturday excepted" value={calendar.saturdayExcepted} />
      {generatedIntervals.length > 0 && (
        <BulletList
          values={generatedIntervals.slice(0, 8).map((interval: PersistedRecord) => `${formatDateTime(interval.startTime)} to ${formatDateTime(interval.endTime)}${Array.isArray(interval.reasons) && interval.reasons.length > 0 ? ` · ${interval.reasons.map((reason: unknown) => humanize(reason)).join(", ")}` : ""}`)}
          label={generatedIntervals.length > 8 ? "First persisted calendar intervals" : "Persisted calendar intervals"}
        />
      )}
    </ExplanationSection>
  );
}

function AtutcSection({ snapshot }: { snapshot: PersistedRecord | null }) {
  const atutc = snapshot?.atutc;
  if (!atutc || typeof atutc !== "object") return null;
  const intervals = Array.isArray(atutc.restoredIntervals) ? atutc.restoredIntervals : [];
  return (
    <ExplanationSection title="ATUTC">
      <ValueRow label="Rule enabled" value={atutc.enabled} />
      <ValueRow label="Backend decision applied" value={atutc.applied} />
      <ValueRow label="Restored working time" value={formatSeconds(atutc.restoredSeconds)} emphasize />
      <ValueRow label="Restored interval count" value={String(intervals.length)} />
      <BulletList values={intervals.map((interval: PersistedRecord) => `${formatDateTime(interval.startTime)} to ${formatDateTime(interval.endTime)}`)} label="Persisted restoration intervals" />
      {hasValue(atutc.limitation) && <Notice tone="warning">{String(atutc.limitation)}</Notice>}
    </ExplanationSection>
  );
}

function ReversibleSection({
  calculation,
  snapshot,
  referenceOnly,
}: {
  calculation: ResultCalculation;
  snapshot: PersistedRecord | null;
  referenceOnly: boolean;
}) {
  const rule = snapshot?.reversibleLaytimeRule;
  const analysis = snapshot?.reversibleLaytimeAnalysis;
  const settlement = snapshot?.reversibleSettlement;
  if (!rule && !analysis && !settlement && !referenceOnly) return null;
  const status = settlement?.settlementStatus ?? calculation.settlementAuthorityStatus;
  return (
    <ExplanationSection title="Reversible laytime">
      {referenceOnly && (
        <Notice tone="warning">This operation result is supporting evidence only. The parent settlement controls commercial authority.</Notice>
      )}
      <ValueRow label="Rule enabled" value={rule?.enabled} />
      <ValueRow label="Contract status" value={humanize(rule?.contractStatus)} />
      <ValueRow label="Pooled result authority" value={status ? reversibleSettlementStatusLabel(status) : null} emphasize />
      <ValueRow label="Combined allowed" value={formatSeconds(settlement?.combinedAllowedSeconds ?? analysis?.pool?.totalAllowedSeconds)} />
      <ValueRow label="Combined used" value={formatSeconds(settlement?.combinedUsedSeconds ?? analysis?.pool?.totalUsedSeconds)} />
      <ValueRow label="Combined excess" value={formatSeconds(settlement?.combinedOverrunSeconds ?? analysis?.pool?.netPooledOverrunSeconds)} />
      <ValueRow label="Combined time saved" value={formatSeconds(settlement?.combinedSavedSeconds ?? analysis?.pool?.netPooledSurplusSeconds)} />
      {hasValue(settlement?.reason) && <Notice tone={status === "FINAL_AUTHORITATIVE" ? "success" : "warning"}>Backend authority explanation: {String(settlement.reason)}</Notice>}
      {!hasValue(settlement?.reason) && hasValue(analysis?.reason) && <Notice tone="warning">Backend analysis explanation: {String(analysis.reason)}</Notice>}
      {settlement?.warnings && <BulletList values={uniqueStrings(settlement.warnings)} label="Persisted reversible-settlement warnings" />}
    </ExplanationSection>
  );
}

function CommercialSection({
  calculation,
  snapshot,
  referenceOnly,
  authorityStatus,
}: Props) {
  const status = authorityStatus ?? calculation.settlementAuthorityStatus ?? snapshot?.reversibleSettlement?.settlementStatus;
  const commercialStatus = referenceOnly
    ? "Reference-only child result"
    : status
      ? reversibleSettlementStatusLabel(status)
      : calculation.status === "Final"
        ? "FINAL - AUTHORITATIVE"
        : "PROVISIONAL";
  return (
    <ExplanationSection title="Commercial result">
      <ValueRow label="Calculation lifecycle" value={calculation.status === "Final" ? "Final" : "Draft / provisional"} />
      <ValueRow label="Settlement authority" value={commercialStatus} emphasize />
      <ValueRow label="Demurrage" value={formatCurrencyAmount(calculation.demurrageAmount, calculation.currency)} />
      <ValueRow label="Despatch" value={formatCurrencyAmount(calculation.despatchAmount, calculation.currency)} />
      <ValueRow label="Currency" value={calculation.currency} />
      {referenceOnly && <Notice tone="warning">This child result is reference-only because the persisted parent settlement controls commercial authority.</Notice>}
      {!referenceOnly && status && status !== "FINAL_AUTHORITATIVE" && (
        <Notice tone="warning">The persisted settlement authority is {reversibleSettlementStatusLabel(status)}.</Notice>
      )}
    </ExplanationSection>
  );
}

export function CalculationExplanation({
  calculation,
  audit,
  referenceOnly = false,
  authorityStatus,
}: Props) {
  const rawSnapshot = snapshotFor(calculation, audit);
  const snapshot = explanationSnapshotFor(calculation, audit);
  const warnings = collectWarnings(calculation, audit, snapshot);
  const periods = persistedPeriods(calculation, snapshot);
  const hasSnapshot = Boolean(snapshot && Object.keys(snapshot).length > 0);
  const hasAudit = audit?.auditAvailable === true || hasSnapshot;
  const usesPrimaryReference = Boolean(
    rawSnapshot?.referencePrimaryOperation &&
      typeof rawSnapshot.referencePrimaryOperation === "object" &&
      (!rawSnapshot.commencement || !rawSnapshot.cargoCompletion),
  );
  const status = getAuthorityStatus(
    calculation,
    snapshot,
    referenceOnly,
    authorityStatus,
  );

  return (
    <details className="rounded-xl border" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3" style={{ fontSize: "13px", color: "#111827", fontWeight: 600 }}>
        <span>Calculation explanation</span>
        <span className="flex items-center gap-2" style={{ fontSize: "10px", fontWeight: 500 }}>
          <span className="rounded-full px-2 py-1" style={{ backgroundColor: status.includes("AUTHORITATIVE") && !status.includes("NON") ? "#DCFCE7" : "#FEF3C7", color: status.includes("AUTHORITATIVE") && !status.includes("NON") ? "#166534" : "#92400E" }}>{status}</span>
          {warnings.length > 0 && <span style={{ color: "#92400E" }}>{warnings.length} persisted warning{warnings.length === 1 ? "" : "s"}</span>}
        </span>
      </summary>
      <div className="border-t p-3 space-y-3" style={{ borderColor: "#E5E7EB" }}>
        <p style={{ fontSize: "11px", color: "#475569", lineHeight: 1.45 }}>
          This explanation is a readable view of persisted calculation decisions and audit data. It does not recreate contractual rules or recalculate totals.
        </p>
        {usesPrimaryReference && (
          <Notice>
            Commencement, completion, and period detail below come from the persisted primary-operation reference evidence. The pooled reversible settlement remains the commercial authority.
          </Notice>
        )}
        {!hasAudit && (
          <Notice>Detailed audit decisions are not available for this calculation version.</Notice>
        )}
        <CommencementSection calculation={calculation} snapshot={snapshot} />
        <NorReadinessSection calculation={calculation} snapshot={snapshot} />
        <FreePratiqueSection snapshot={snapshot} />
        <CompletionSection calculation={calculation} snapshot={snapshot} />
        <TimeCountingSection calculation={calculation} snapshot={snapshot} />
        <WeatherSection snapshot={snapshot} periods={periods} />
        <CalendarSection snapshot={snapshot} />
        <AtutcSection snapshot={snapshot} />
        <ReversibleSection calculation={calculation} snapshot={snapshot} referenceOnly={referenceOnly} />
        <CommercialSection calculation={calculation} snapshot={snapshot} referenceOnly={referenceOnly} authorityStatus={authorityStatus} />
        <WarningSection warnings={warnings} />
      </div>
    </details>
  );
}
