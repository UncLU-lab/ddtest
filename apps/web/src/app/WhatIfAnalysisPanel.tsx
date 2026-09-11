import {
  reversibleSettlementStatusLabel,
  type LaytimeCalculation,
  type LaytimeCalculationAudit,
  type LaytimeOperationResult,
} from "../lib/api";
import { formatCurrencyAmount } from "../lib/currency";

type ResultCalculation = LaytimeCalculation | LaytimeOperationResult;
type PersistedRecord = Record<string, any>;

type Props = {
  calculation: ResultCalculation;
  audit?: LaytimeCalculationAudit | null;
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

function displayValue(value: unknown, fallback = "Not available") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function formatDateTime(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function operationLabel(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
) {
  if ("operation" in calculation && calculation.operation) {
    return calculation.operation;
  }
  return (
    snapshot?.shexCalendar?.operation ??
    calculation.inputSnapshot?.operationSelection?.voyageLaytimeOperation ??
    calculation.inputSnapshot?.operationResult?.operation ??
    "Not recorded"
  );
}

function authorityLabel(
  calculation: ResultCalculation,
  snapshot: PersistedRecord | null,
) {
  const status =
    calculation.settlementAuthorityStatus ??
    snapshot?.reversibleSettlement?.settlementStatus;
  return status
    ? reversibleSettlementStatusLabel(status)
    : "Authority not recorded";
}

function BaselineValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
      <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p className="mt-1" style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{displayValue(value)}</p>
    </div>
  );
}

export function WhatIfAnalysisPanel({ calculation, audit }: Props) {
  const snapshot = snapshotFor(calculation, audit);
  const commencement = snapshot?.commencement?.commencedAt;
  const completion =
    snapshot?.cargoCompletion?.selectedTime ??
    snapshot?.cargoCompletion?.eventTime ??
    snapshot?.cargoCompletion?.completionTime;
  const excess = audit?.calculation?.excessLaytime ?? "Not available";
  const saved = audit?.calculation?.savedLaytime ?? "Not available";

  return (
    <details className="rounded-xl border" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3" style={{ fontSize: "13px", color: "#111827", fontWeight: 600 }}>
        <span>What-if analysis</span>
        <span className="rounded-full px-2 py-1" style={{ fontSize: "10px", fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569" }}>
          Scenario inputs unavailable
        </span>
      </summary>
      <div className="border-t p-3 space-y-3" style={{ borderColor: "#E5E7EB" }}>
        <p style={{ fontSize: "11px", color: "#475569", lineHeight: 1.45 }}>
          Scenario comparison is not available because the backend currently exposes a calculation-creation endpoint that persists a new Draft version from the current voyage data. It accepts no scenario override inputs, so it cannot represent analyst assumptions and is not used for what-if analysis here.
        </p>

        <section className="rounded-lg border p-3" style={{ borderColor: "#DBEAFE", backgroundColor: "#EFF6FF" }} aria-label="Current persisted baseline">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p style={{ fontSize: "10px", color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Current persisted result</p>
              <h4 className="mt-1" style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>Baseline calculation</h4>
            </div>
            <span className="rounded-full px-2 py-1" style={{ fontSize: "10px", color: "#1E40AF", backgroundColor: "#DBEAFE" }}>Version {calculation.version}</span>
          </div>
          <div className="grid gap-2 mt-3 sm:grid-cols-2 lg:grid-cols-4">
            <BaselineValue label="Lifecycle" value={calculation.status} />
            <BaselineValue label="Authority" value={authorityLabel(calculation, snapshot)} />
            <BaselineValue label="Operation" value={operationLabel(calculation, snapshot)} />
            <BaselineValue label="Calculated" value={formatDateTime(calculation.calculatedAt)} />
          </div>
          <div className="grid gap-2 mt-2 sm:grid-cols-2 lg:grid-cols-4">
            <BaselineValue label="Allowed laytime" value={calculation.allowedLaytime} />
            <BaselineValue label="Used laytime" value={calculation.usedLaytime} />
            <BaselineValue label="Excess time" value={excess} />
            <BaselineValue label="Time saved" value={saved} />
          </div>
          <div className="grid gap-2 mt-2 sm:grid-cols-2 lg:grid-cols-4">
            <BaselineValue label="Demurrage" value={formatCurrencyAmount(calculation.demurrageAmount, calculation.currency)} />
            <BaselineValue label="Despatch" value={formatCurrencyAmount(calculation.despatchAmount, calculation.currency)} />
            <BaselineValue label="Commencement" value={formatDateTime(commencement)} />
            <BaselineValue label="Completion" value={formatDateTime(completion)} />
          </div>
        </section>

        <section className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }} aria-label="Scenario unavailable">
          <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Scenario result</p>
          <p className="mt-1" style={{ fontSize: "12px", color: "#374151", fontWeight: 600 }}>No scenario result was created</p>
          <p className="mt-1" style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.45 }}>
            No supported scenario inputs, changed assumptions, comparison, reset, or apply action are exposed. The persisted baseline remains unchanged, and no calculation is performed in the client.
          </p>
        </section>
      </div>
    </details>
  );
}
