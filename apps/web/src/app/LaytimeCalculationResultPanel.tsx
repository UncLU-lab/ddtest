import { type ReactNode, useEffect, useState } from "react";
import {
  getLaytimeCalculationAudit,
  getLaytimeOperationResults,
  reversibleSettlementStatusLabel,
  type LaytimeCalculation,
  type LaytimeCalculationAudit,
  type LaytimeOperationResult,
  type ReversibleSettlementStatus,
} from "../lib/api";
import { formatCurrencyAmount } from "../lib/currency";
import { CalculationExplanation } from "./CalculationExplanation";
import { PersistedLaytimeTimeline } from "./LaytimeTimeline";

type ResultCalculation = LaytimeCalculation | LaytimeOperationResult;

type Props = {
  calculation?: ResultCalculation | null;
};

function displayValue(value?: unknown, fallback = "Not available") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDateTime(value?: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatInterval(value?: string | null) {
  if (!value) return "Not available";
  const match = String(value).match(/^(?:(-?\d+) days? )?(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return String(value);
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const totalHours = days * 24 + hours;
  return `${totalHours}h ${minutes}m`;
}

function formatSeconds(value?: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  const totalMinutes = Math.max(0, Math.round(value / 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

function intervalSeconds(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/^(?:(-?\d+) days? )?(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 86400 + Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
}

function decisionSnapshot(calculation: ResultCalculation) {
  return (calculation.decisionSnapshot ?? null) as Record<string, any> | null;
}

function auditDecisions(audit?: LaytimeCalculationAudit | null) {
  return audit?.decisions && typeof audit.decisions === "object"
    ? (audit.decisions as Record<string, any>)
    : null;
}

function persistedSnapshot(
  calculation: ResultCalculation,
  audit?: LaytimeCalculationAudit | null,
) {
  const decisions = auditDecisions(audit);
  return decisions && Object.keys(decisions).length > 0
    ? decisions
    : decisionSnapshot(calculation);
}

function persistedPeriods(
  calculation: ResultCalculation,
  audit?: LaytimeCalculationAudit | null,
): Array<Record<string, any>> {
  const auditPeriods = auditDecisions(audit)?.periods;
  if (Array.isArray(auditPeriods)) return auditPeriods as Array<Record<string, any>>;

  const snapshotPeriods = decisionSnapshot(calculation)?.periods;
  if (Array.isArray(snapshotPeriods)) return snapshotPeriods as Array<Record<string, any>>;

  const calculationPeriods = (calculation as any).periods;
  return Array.isArray(calculationPeriods)
    ? (calculationPeriods as Array<Record<string, any>>)
    : [];
}

function readableLabel(value?: unknown, fallback = "Not available") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatEvidenceBasis(value?: unknown) {
  switch (value) {
    case "nor_accepted":
      return "Accepted NOR evidence";
    case "nor_tendered":
      return "NOR tender evidence";
    case "readiness_and_nor":
      return "Readiness and NOR evidence";
    default:
      return readableLabel(value, "Persisted commencement evidence");
  }
}

function formatPeriodDuration(period: Record<string, any>) {
  const start = new Date(String(period.startTime ?? ""));
  const end = new Date(String(period.endTime ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return "Not available";
  }
  return formatSeconds((end.getTime() - start.getTime()) / 1000);
}

function periodReason(period: Record<string, any>) {
  const kinds = Array.isArray(period.exceptionKinds)
    ? period.exceptionKinds
    : period.exceptionKind
      ? [period.exceptionKind]
      : [];
  const calendarReasons = Array.isArray(period.calendarDates)
    ? period.calendarDates.flatMap((entry: any) =>
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

function periodTypeLabel(periodType?: unknown) {
  switch (periodType) {
    case "laytime":
      return "Countable laytime";
    case "demurrage":
      return "Demurrage time";
    case "exception":
      return "Excluded time";
    default:
      return readableLabel(periodType, "Calculation period");
  }
}

function periodCountingLabel(periodType?: unknown) {
  if (periodType === "exception") return "No";
  if (periodType === "demurrage") return "Yes · after allowance";
  if (periodType === "laytime") return "Yes";
  return "Not specified";
}

function commercialOutcome(calculation: ResultCalculation, authoritative = true) {
  if (!authoritative) return "Commercial outcome not authoritative at parent level";
  const hasDemurrage = calculation.demurrageAmount !== null && calculation.demurrageAmount !== undefined && calculation.demurrageAmount !== "" && Number.isFinite(Number(calculation.demurrageAmount));
  const hasDespatch = calculation.despatchAmount !== null && calculation.despatchAmount !== undefined && calculation.despatchAmount !== "" && Number.isFinite(Number(calculation.despatchAmount));
  if (hasDemurrage && Number(calculation.demurrageAmount) > 0) return "Vessel on demurrage";
  if (hasDespatch && Number(calculation.despatchAmount) > 0) return "Despatch due";
  if (!hasDemurrage || !hasDespatch) return "Monetary result not available";
  return "Balanced · no demurrage or despatch";
}

function resultCardLabel(calculation: ResultCalculation) {
  return "operation" in calculation && calculation.operation
    ? calculation.operation
    : "Parent voyage";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
      <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ fontSize: "15px", color: "#111827", fontWeight: 600, marginTop: "4px" }}>{value}</p>
    </div>
  );
}

function EvidenceNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 rounded-lg border px-3 py-2" style={{ fontSize: "11px", lineHeight: 1.45, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#475569" }}>
      {children}
    </p>
  );
}

function PeriodTable({
  calculation,
  audit,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
}) {
  const periods = persistedPeriods(calculation, audit);
  const operation = "operation" in calculation && calculation.operation
    ? calculation.operation
    : "Voyage result";

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Counting timeline</p>
          <h4 style={{ fontSize: "15px", color: "#111827", fontWeight: 600, marginTop: "3px" }}>Persisted calculation periods</h4>
        </div>
        <span style={{ fontSize: "11px", color: "#6B7280" }}>{periods.length} period{periods.length === 1 ? "" : "s"}</span>
      </div>

      {periods.length === 0 ? (
        <EvidenceNote>No persisted period detail is available for this result.</EvidenceNote>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full" style={{ minWidth: "680px", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ color: "#6B7280", textAlign: "left", borderBottom: "1px solid #E5E7EB" }}>
                <th className="px-2 py-2 font-medium">Start</th>
                <th className="px-2 py-2 font-medium">End</th>
                <th className="px-2 py-2 font-medium">Duration</th>
                <th className="px-2 py-2 font-medium">Event / reason</th>
                <th className="px-2 py-2 font-medium">Counts as laytime?</th>
                <th className="px-2 py-2 font-medium">Operation</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period, index) => (
                <tr key={`${String(period.startTime)}-${String(period.endTime)}-${index}`} style={{ borderBottom: "1px solid #F1F5F9", color: "#334155" }}>
                  <td className="px-2 py-2 align-top">{formatDateTime(period.startTime)}</td>
                  <td className="px-2 py-2 align-top">{formatDateTime(period.endTime)}</td>
                  <td className="px-2 py-2 align-top font-medium">{formatPeriodDuration(period)}</td>
                  <td className="px-2 py-2 align-top">
                    <div style={{ color: "#111827", fontWeight: 500 }}>{periodTypeLabel(period.periodType)}</div>
                    <div className="mt-0.5" style={{ color: "#64748B" }}>{periodReason(period)}</div>
                  </td>
                  <td className="px-2 py-2 align-top">{periodCountingLabel(period.periodType)}</td>
                  <td className="px-2 py-2 align-top">{"operation" in calculation && calculation.operation ? calculation.operation : operation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DecisionEvidence({
  calculation,
  audit,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
}) {
  const snapshot = persistedSnapshot(calculation, audit);
  const commencement = snapshot?.commencement;
  const completion = snapshot?.cargoCompletion;

  if (!commencement && !completion) return null;

  const completionTime = completion?.selectedTime ?? completion?.eventTime ?? completion?.completionTime;
  const excludedCompletionCount = Array.isArray(completion?.excludedEventIds)
    ? completion.excludedEventIds.length
    : 0;

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Evidence traceability</p>
      <div className="grid gap-2 mt-3 sm:grid-cols-2">
        {commencement && <Metric label="Commencement evidence" value={formatEvidenceBasis(commencement.basis)} />}
        {completion && <Metric label="Completion evidence" value={readableLabel(completion.selectionBasis, "Selected cargo completion")} />}
      </div>
      <div className="grid gap-2 mt-2 sm:grid-cols-2">
        {commencement && <Metric label="Selected readiness / NOR" value={commencement.readinessEventId || commencement.norTenderedEventId || commencement.norDocumentId ? "Persisted evidence selected" : "Not identified in snapshot"} />}
        {completion && <Metric label="Selected completion time" value={formatDateTime(completionTime)} />}
      </div>
      {excludedCompletionCount > 0 && (
        <EvidenceNote>{excludedCompletionCount} alternative completion event{excludedCompletionCount === 1 ? " was" : "s were"} excluded by the persisted selection.</EvidenceNote>
      )}
    </section>
  );
}

function WeatherExplanation({
  calculation,
  audit,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
}) {
  const weather = persistedSnapshot(calculation, audit)?.weatherWorking;
  if (!weather) return null;
  const deducted = weather.totalWeatherTimeDeductedBeforeDemurrage;

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Weather decision</p>
      <div className="grid gap-2 mt-3 sm:grid-cols-3">
        <Metric label="Weather rule" value={weather.enabled === true ? "Enabled" : weather.enabled === false ? "Disabled" : "Not recorded"} />
        <Metric label="Applied to result" value={weather.applied === true ? "Yes" : weather.applied === false ? "No" : "Not recorded"} />
        <Metric label="Weather time excluded" value={formatSeconds(deducted)} />
      </div>
      <EvidenceNote>
        {weather.applied === true
          ? "The persisted calculation records weather time as excluded before demurrage."
          : weather.applied === false
            ? "The persisted calculation records no weather exclusion for this result."
            : "The persisted calculation does not record whether weather was applied."}
      </EvidenceNote>
    </section>
  );
}

function ShexExplanation({
  calculation,
  audit,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
}) {
  const shex = persistedSnapshot(calculation, audit)?.shexCalendar;
  if (!shex) return null;
  const generatedIntervals = Array.isArray(shex.generatedIntervals) ? shex.generatedIntervals.length : null;

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Calendar counting decision</p>
      <div className="grid gap-2 mt-3 sm:grid-cols-3">
        <Metric label="Counting basis" value={shex.shex === true ? "SHEX" : shex.shex === false ? "SHINC" : "Not recorded"} />
        <Metric label="Calendar intervals" value={generatedIntervals === null ? "Not available" : String(generatedIntervals)} />
        <Metric label="Legacy calendar handling" value={shex.legacyCompatibilityUsed === true ? "Used" : shex.legacyCompatibilityUsed === false ? "Not used" : "Not recorded"} />
      </div>
      {typeof shex.timeZone === "string" && shex.timeZone && <EvidenceNote>Persisted calendar timezone: {shex.timeZone}.</EvidenceNote>}
    </section>
  );
}

function AtutcExplanation({
  calculation,
  audit,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
}) {
  const atutc = persistedSnapshot(calculation, audit)?.atutc;
  if (!atutc) return null;
  const restoredIntervals = Array.isArray(atutc.restoredIntervals) ? atutc.restoredIntervals.length : null;

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>ATUTC decision</p>
      <div className="grid gap-2 mt-3 sm:grid-cols-3">
        <Metric label="Rule status" value={atutc.enabled === true ? "Enabled" : atutc.enabled === false ? "Disabled" : "Not recorded"} />
        <Metric label="Restored working time" value={formatSeconds(atutc.restoredSeconds)} />
        <Metric label="Restored intervals" value={restoredIntervals === null ? "Not available" : String(restoredIntervals)} />
      </div>
      <EvidenceNote>
        {atutc.applied === true
          ? "The persisted calculation records actual working time restored inside supported exception periods."
          : atutc.applied === false
            ? "The persisted calculation records no ATUTC restoration for this result."
            : "The persisted calculation does not record whether ATUTC was applied."}
        {typeof atutc.limitation === "string" && atutc.limitation ? ` ${atutc.limitation}` : ""}
      </EvidenceNote>
    </section>
  );
}

function ReversibleSummary({
  calculation,
  audit,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
}) {
  const snapshot = persistedSnapshot(calculation, audit);
  const settlement = snapshot?.reversibleSettlement;
  const analysis = snapshot?.reversibleLaytimeAnalysis;
  if (!settlement && !analysis) return null;

  const pool = analysis?.pool ?? {};
  const allowed = settlement?.combinedAllowedSeconds ?? pool.totalAllowedSeconds;
  const used = settlement?.combinedUsedSeconds ?? pool.totalUsedSeconds;
  const excess = settlement?.combinedOverrunSeconds ?? pool.netPooledOverrunSeconds;
  const saved = settlement?.combinedSavedSeconds ?? pool.netPooledSurplusSeconds;
  const status = settlement?.settlementStatus ?? "LEGACY";
  const authoritative = status === "FINAL_AUTHORITATIVE";

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: authoritative ? "#BBF7D0" : "#FCD34D", backgroundColor: authoritative ? "#F0FDF4" : "#FFFBEB" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p style={{ fontSize: "11px", color: authoritative ? "#166534" : "#92400E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reversible laytime result</p>
          <h4 style={{ fontSize: "15px", color: "#111827", fontWeight: 600, marginTop: "3px" }}>Combined Loading and Discharge pool</h4>
        </div>
        <span className="rounded-full px-2.5 py-1" style={{ fontSize: "11px", backgroundColor: authoritative ? "#DCFCE7" : "#FEF3C7", color: authoritative ? "#166534" : "#92400E" }}>
          {reversibleSettlementStatusLabel(status)}
        </span>
      </div>
      <div className="grid gap-2 mt-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Pooled allowed" value={formatSeconds(allowed)} />
        <Metric label="Pooled used" value={formatSeconds(used)} />
        <Metric label="Pooled excess" value={formatSeconds(excess)} />
        <Metric label="Pooled time saved" value={formatSeconds(saved)} />
      </div>
      <EvidenceNote>
        {authoritative
          ? "This persisted combined result is the authoritative commercial settlement; Loading and Discharge cards below provide supporting operation evidence."
          : settlement?.reason ?? "The persisted reversible pool is available for audit but is not an authoritative commercial settlement."}
      </EvidenceNote>
    </section>
  );
}

function ResultCard({
  calculation,
  audit,
  parent = false,
  referenceOnly = false,
  authorityStatus,
}: {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
  parent?: boolean;
  referenceOnly?: boolean;
  authorityStatus?: ReversibleSettlementStatus;
}) {
  const snapshot = persistedSnapshot(calculation, audit);
  const settlement = snapshot?.reversibleSettlement;
  const reversibleEnabled = Boolean(settlement) || snapshot?.reversibleLaytimeRule?.enabled === true;
  const settlementStatus = (
    settlement?.settlementStatus ??
    (reversibleEnabled ? "LEGACY" : undefined)
  ) as ReversibleSettlementStatus | undefined;
  const parentCommerciallyAuthoritative = !parent || !reversibleEnabled || settlementStatus === "FINAL_AUTHORITATIVE";
  const unavailableParentTime = parent && reversibleEnabled && (settlementStatus === "NONAUTHORITATIVE" || settlementStatus === "LEGACY");
  const completion = snapshot?.cargoCompletion?.selectedTime ?? snapshot?.cargoCompletion?.eventTime ?? snapshot?.cargoCompletion?.completionTime;
  const commenced = snapshot?.commencement?.commencedAt;
  const excessTime = audit?.calculation?.excessLaytime ?? formatSeconds(snapshot?.demurrage?.excessSeconds);
  const savedTime = audit?.calculation?.savedLaytime ?? formatSeconds(snapshot?.despatch?.savedSeconds);
  const excessSeconds = intervalSeconds(audit?.calculation?.excessLaytime) ?? (typeof snapshot?.demurrage?.excessSeconds === "number" ? snapshot.demurrage.excessSeconds : null);
  const savedSeconds = intervalSeconds(audit?.calculation?.savedLaytime) ?? (typeof snapshot?.despatch?.savedSeconds === "number" ? snapshot.despatch.savedSeconds : null);
  const timeBalance = excessSeconds === null && savedSeconds === null
    ? "Not available"
    : excessSeconds !== null && excessSeconds > 0
      ? `Over ${formatSeconds(excessSeconds)}`
      : savedSeconds !== null && savedSeconds > 0
        ? `Saved ${formatSeconds(savedSeconds)}`
        : "Balanced";
  const persistedAuthority = authorityStatus ?? calculation.settlementAuthorityStatus ?? (parent && reversibleEnabled ? settlementStatus : null);
  const statusLabel = referenceOnly
    ? "Reference only · parent settlement authoritative"
    : persistedAuthority === "FINAL_AUTHORITATIVE"
      ? "Final · authoritative"
      : persistedAuthority
        ? `${reversibleSettlementStatusLabel(persistedAuthority)} · ${calculation.status === "Final" ? "final calculation" : "draft calculation"}`
        : calculation.status === "Final"
          ? "Final · authoritative"
          : "Draft · provisional";

  return (
    <>
      <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{resultCardLabel(calculation)}</p>
            <h3 style={{ fontSize: "16px", color: "#111827", fontWeight: 600, marginTop: "3px" }}>Laytime calculation result</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="rounded-full px-2.5 py-1" style={{ fontSize: "11px", backgroundColor: referenceOnly ? "#EFF6FF" : parentCommerciallyAuthoritative ? "#DCFCE7" : "#FEF3C7", color: referenceOnly ? "#1E40AF" : parentCommerciallyAuthoritative ? "#166534" : "#92400E" }}>
              {statusLabel}
            </span>
            <span className="rounded-full px-2.5 py-1" style={{ fontSize: "11px", backgroundColor: "#F1F5F9", color: "#475569" }}>
              {referenceOnly ? "Supporting operation evidence" : commercialOutcome(calculation, parentCommerciallyAuthoritative)}
            </span>
          </div>
        </div>

        <div className="grid gap-2 mt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Laytime allowed" value={unavailableParentTime ? "Not authoritative" : formatInterval(calculation.allowedLaytime)} />
          <Metric label="Laytime used" value={unavailableParentTime ? "Not authoritative" : formatInterval(calculation.usedLaytime)} />
          <Metric label="Excess time" value={unavailableParentTime ? "Not authoritative" : excessTime} />
          <Metric label="Time saved" value={unavailableParentTime ? "Not authoritative" : savedTime} />
        </div>

        <div className="grid gap-2 mt-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Time balance" value={unavailableParentTime ? "Not authoritative" : timeBalance} />
          <Metric label="Laytime commenced" value={formatDateTime(commenced)} />
          <Metric label="Cargo completed" value={formatDateTime(completion)} />
          <Metric label="Calculated" value={formatDateTime(calculation.calculatedAt)} />
        </div>

        <div className="grid gap-2 mt-2 sm:grid-cols-2">
          <Metric label={referenceOnly ? "Demurrage (reference only)" : "Demurrage"} value={parentCommerciallyAuthoritative || referenceOnly ? formatCurrencyAmount(calculation.demurrageAmount, calculation.currency) : "Not authoritative at parent level"} />
          <Metric label={referenceOnly ? "Despatch (reference only)" : "Despatch"} value={parentCommerciallyAuthoritative || referenceOnly ? formatCurrencyAmount(calculation.despatchAmount, calculation.currency) : "Not authoritative at parent level"} />
        </div>

        {parent && reversibleEnabled && (
          <EvidenceNote>
            {settlementStatus === "FINAL_AUTHORITATIVE"
              ? "Loading and Discharge were settled against the combined V1 allowance. This parent result is the authoritative commercial outcome."
              : settlement?.reason ?? "This reversible result is not an authoritative final commercial settlement."}
          </EvidenceNote>
        )}
      </section>

      <PersistedLaytimeTimeline
        calculation={calculation}
        audit={audit}
        referenceOnly={referenceOnly}
        authorityStatus={authorityStatus}
      />
      <CalculationExplanation
        calculation={calculation}
        audit={audit}
        referenceOnly={referenceOnly}
        authorityStatus={authorityStatus}
      />
      <DecisionEvidence calculation={calculation} audit={audit} />
      <PeriodTable calculation={calculation} audit={audit} />
      <WeatherExplanation calculation={calculation} audit={audit} />
      <ShexExplanation calculation={calculation} audit={audit} />
      <AtutcExplanation calculation={calculation} audit={audit} />
    </>
  );
}

function NonReversibleSummary({ calculation, audit }: { calculation: ResultCalculation; audit?: LaytimeCalculationAudit | null }) {
  const settlement = persistedSnapshot(calculation, audit)?.nonReversibleSettlement;
  const status = (calculation.settlementAuthorityStatus ?? settlement?.settlementStatus ?? "LEGACY") as ReversibleSettlementStatus;
  const expected = (settlement?.expectedOperations ?? []) as string[];
  const missing = (settlement?.missingOperations ?? []) as string[];
  const monetary = settlement?.monetaryAggregation;
  const monetaryAvailable = monetary?.status === "AVAILABLE";

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Voyage settlement status</p>
          <h3 style={{ fontSize: "16px", color: "#111827", fontWeight: 600, marginTop: "3px" }}>Separate operation results</h3>
        </div>
        <span className="rounded-full px-2.5 py-1" style={{ fontSize: "11px", backgroundColor: status === "FINAL_AUTHORITATIVE" ? "#DCFCE7" : "#FEF3C7", color: status === "FINAL_AUTHORITATIVE" ? "#166534" : "#92400E" }}>
          {reversibleSettlementStatusLabel(status)}
        </span>
      </div>
      <div className="grid gap-2 mt-4 sm:grid-cols-2">
        <Metric label="Calculation lifecycle" value={calculation.status === "Final" ? "Final" : "Draft · provisional"} />
        <Metric label="Expected operations" value={expected.length ? expected.join(" and ") : "Contractual scope unresolved"} />
        <Metric label="Missing operations" value={missing.length ? missing.join(", ") : "None"} />
      </div>
      {monetaryAvailable && (
        <div className="grid gap-2 mt-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Gross demurrage" value={formatCurrencyAmount(monetary.grossDemurrage, monetary.currency)} />
          <Metric label="Gross despatch" value={formatCurrencyAmount(monetary.grossDespatch, monetary.currency)} />
          <Metric label="Informational net exposure" value={formatCurrencyAmount(monetary.netExposure, monetary.currency)} />
          <Metric label="Net direction" value={displayValue(monetary.netDirection)} />
        </div>
      )}
      <EvidenceNote>
        {monetaryAvailable
          ? "Operation results remain legally separate. Gross values and net exposure are informational only and cannot create an aggregate claim."
          : monetary?.status === "CURRENCY_MISMATCH"
            ? "Operation amounts cannot be aggregated because calculation currencies do not match. No FX conversion is applied."
          : "Operation amounts are shown separately. Voyage monetary totals require an authoritative calculation currency."}
      </EvidenceNote>
    </section>
  );
}

export function LaytimeCalculationResultPanel({ calculation }: Props) {
  const [children, setChildren] = useState<LaytimeOperationResult[]>([]);
  const [audits, setAudits] = useState<Record<string, LaytimeCalculationAudit>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadResults() {
      if (!calculation?.id) {
        setChildren([]);
        setAudits({});
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [childResults, parentAudit] = await Promise.all([
          getLaytimeOperationResults(calculation.id),
          getLaytimeCalculationAudit(calculation.id),
        ]);
        const childAudits = await Promise.all(childResults.map(async (child) => [child.id, await getLaytimeCalculationAudit(child.id)] as const));
        if (!active) return;
        setChildren(childResults);
        setAudits(Object.fromEntries([[calculation.id, parentAudit], ...childAudits]));
      } catch (loadError: any) {
        if (!active) return;
        setChildren([]);
        setAudits({});
        setError(loadError?.status === 404 ? "Calculation result details are not available yet." : "Unable to load the calculation result details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadResults();
    return () => { active = false; };
  }, [calculation?.id]);

  if (!calculation) {
    return (
      <section className="rounded-xl border p-5" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
        <h2 style={{ fontSize: "16px", color: "#111827", fontWeight: 600 }}>Laytime calculation result</h2>
        <p className="mt-2" style={{ fontSize: "12px", color: "#6B7280" }}>No persisted laytime calculation is available for this voyage.</p>
      </section>
    );
  }

  const nonReversibleSettlement = decisionSnapshot(calculation)?.nonReversibleSettlement;
  const isNonReversibleSummary = Boolean(nonReversibleSettlement);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Commercial outcome</p>
        <h2 style={{ fontSize: "20px", color: "#111827", fontWeight: 600, marginTop: "3px" }}>Laytime calculation result</h2>
        <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>Values below come from the persisted backend calculation and audit snapshot.</p>
      </div>
      {isNonReversibleSummary
        ? <NonReversibleSummary calculation={calculation} audit={audits[calculation.id]} />
        : <ResultCard calculation={calculation} audit={audits[calculation.id]} parent />}
      {!isNonReversibleSummary && <ReversibleSummary calculation={calculation} audit={audits[calculation.id]} />}
      {loading && <p style={{ fontSize: "12px", color: "#6B7280" }}>Loading persisted operation results and audit details...</p>}
      {error && <p className="rounded-lg border px-3 py-2" style={{ fontSize: "12px", color: "#92400E", borderColor: "#FCD34D", backgroundColor: "#FFFBEB" }}>{error}</p>}
      {children.map((child) => <ResultCard key={child.id} calculation={child} audit={audits[child.id]} referenceOnly={decisionSnapshot(calculation)?.reversibleSettlement?.settlementStatus === "FINAL_AUTHORITATIVE"} authorityStatus={isNonReversibleSummary ? (child.settlementAuthorityStatus ?? "PROVISIONAL") : undefined} />)}
    </div>
  );
}
