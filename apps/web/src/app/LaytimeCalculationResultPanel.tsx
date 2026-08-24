import { useEffect, useState } from "react";
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
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

function decisionSnapshot(calculation: ResultCalculation) {
  return (calculation.decisionSnapshot ?? null) as Record<string, any> | null;
}

function commercialOutcome(calculation: ResultCalculation, authoritative = true) {
  if (!authoritative) return "Commercial outcome not authoritative at parent level";
  if (Number(calculation.demurrageAmount) > 0) return "Vessel on demurrage";
  if (Number(calculation.despatchAmount) > 0) return "Vessel earned despatch";
  return "Balanced - no demurrage or despatch";
}

function resultCardLabel(calculation: ResultCalculation) {
  return "operation" in calculation && calculation.operation ? calculation.operation : "Parent voyage";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
      <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ fontSize: "15px", color: "#111827", fontWeight: 600, marginTop: "4px" }}>{value}</p>
    </div>
  );
}

function ResultCard({ calculation, audit, parent = false, referenceOnly = false, authorityStatus }: { calculation: ResultCalculation; audit?: LaytimeCalculationAudit | null; parent?: boolean; referenceOnly?: boolean; authorityStatus?: ReversibleSettlementStatus }) {
  const snapshot = decisionSnapshot(calculation);
  const settlement = snapshot?.reversibleSettlement;
  const reversibleEnabled = Boolean(settlement) || snapshot?.reversibleLaytimeRule?.enabled === true;
  const settlementStatus = (
    settlement?.settlementStatus ??
    (reversibleEnabled ? "LEGACY" : undefined)
  ) as ReversibleSettlementStatus | undefined;
  const parentCommerciallyAuthoritative = !parent || !reversibleEnabled || settlementStatus === "FINAL_AUTHORITATIVE";
  const completion = snapshot?.cargoCompletion?.completionTime;
  const commenced = snapshot?.commencement?.commencedAt;
  const timeBalance = audit?.calculation?.excessLaytime
    ? `Time over ${formatInterval(audit.calculation.excessLaytime)}`
    : audit?.calculation?.savedLaytime
      ? `Time saved ${formatInterval(audit.calculation.savedLaytime)}`
      : "No time over or saved data available";

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{resultCardLabel(calculation)}</p>
          <h3 style={{ fontSize: "16px", color: "#111827", fontWeight: 600, marginTop: "3px" }}>Laytime calculation result</h3>
        </div>
        <span className="rounded-full px-2.5 py-1" style={{ fontSize: "11px", backgroundColor: referenceOnly ? "#EFF6FF" : parentCommerciallyAuthoritative ? "#DCFCE7" : "#FEF3C7", color: referenceOnly ? "#1E40AF" : parentCommerciallyAuthoritative ? "#166534" : "#92400E" }}>
          {referenceOnly
            ? "REFERENCE ONLY - parent settlement authoritative"
            : authorityStatus
              ? `${reversibleSettlementStatusLabel(authorityStatus)} · ${commercialOutcome(calculation, true)}`
            : parent && reversibleEnabled
              ? reversibleSettlementStatusLabel(settlementStatus)
              : commercialOutcome(calculation, true)}
        </span>
      </div>

      <div className="grid gap-2 mt-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Laytime allowed" value={formatInterval(calculation.allowedLaytime)} />
        <Metric label="Laytime used" value={formatInterval(calculation.usedLaytime)} />
        <Metric label="Time balance" value={timeBalance} />
        <Metric label="Calculated" value={formatDateTime(calculation.calculatedAt)} />
      </div>

      <div className="grid gap-2 mt-2 sm:grid-cols-2">
        <Metric label="Laytime commenced" value={formatDateTime(commenced)} />
        <Metric label="Cargo completed" value={formatDateTime(completion)} />
      </div>

      <div className="grid gap-2 mt-2 sm:grid-cols-2">
        <Metric label={referenceOnly ? "Demurrage (reference only)" : "Demurrage"} value={parentCommerciallyAuthoritative || referenceOnly ? formatCurrencyAmount(calculation.demurrageAmount, calculation.currency) : "Not authoritative at parent level"} />
        <Metric label={referenceOnly ? "Despatch (reference only)" : "Despatch"} value={parentCommerciallyAuthoritative || referenceOnly ? formatCurrencyAmount(calculation.despatchAmount, calculation.currency) : "Not authoritative at parent level"} />
      </div>

      {parent && reversibleEnabled && (
        <p className="mt-3 rounded-lg border px-3 py-2" style={{ fontSize: "11px", lineHeight: 1.45, borderColor: settlementStatus === "FINAL_AUTHORITATIVE" ? "#BBF7D0" : "#FCD34D", backgroundColor: settlementStatus === "FINAL_AUTHORITATIVE" ? "#F0FDF4" : "#FFFBEB", color: settlementStatus === "FINAL_AUTHORITATIVE" ? "#166534" : "#92400E" }}>
          {settlementStatus === "FINAL_AUTHORITATIVE"
            ? "Loading and Discharge were settled against the combined V1 allowance. This parent result is the authoritative commercial outcome."
            : settlement?.reason ?? "This reversible result is not an authoritative final commercial settlement."}
        </p>
      )}
    </section>
  );
}

function NonReversibleSummary({ calculation }: { calculation: ResultCalculation }) {
  const settlement = decisionSnapshot(calculation)?.nonReversibleSettlement;
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
      <p className="mt-3 rounded-lg border px-3 py-2" style={{ fontSize: "11px", lineHeight: 1.45, borderColor: "#FCD34D", backgroundColor: "#FFFBEB", color: "#92400E" }}>
        {monetaryAvailable
          ? "Operation results remain legally separate. Gross values and net exposure are informational only and cannot create an aggregate claim."
          : monetary?.status === "CURRENCY_MISMATCH"
            ? "Operation amounts cannot be aggregated because calculation currencies do not match. No FX conversion is applied."
            : "Operation amounts are shown separately. Voyage monetary totals require an authoritative calculation currency."}
      </p>
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
        <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>Values below come from the persisted backend calculation.</p>
      </div>
      {isNonReversibleSummary
        ? <NonReversibleSummary calculation={calculation} />
        : <ResultCard calculation={calculation} audit={audits[calculation.id]} parent />}
      {loading && <p style={{ fontSize: "12px", color: "#6B7280" }}>Loading Loading and Discharge results...</p>}
      {error && <p className="rounded-lg border px-3 py-2" style={{ fontSize: "12px", color: "#92400E", borderColor: "#FCD34D", backgroundColor: "#FFFBEB" }}>{error}</p>}
      {children.map((child) => <ResultCard key={child.id} calculation={child} audit={audits[child.id]} referenceOnly={decisionSnapshot(calculation)?.reversibleSettlement?.settlementStatus === "FINAL_AUTHORITATIVE"} authorityStatus={isNonReversibleSummary ? (child.settlementAuthorityStatus ?? "PROVISIONAL") : undefined} />)}
    </div>
  );
}
