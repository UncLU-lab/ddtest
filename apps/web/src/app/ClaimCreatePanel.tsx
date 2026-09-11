import { useEffect, useMemo, useState } from "react";
import {
  createBulkDispute,
  getLaytimeCalculations,
  getVoyages,
  type BulkDispute,
  type LaytimeCalculation,
  type VoyageListItem,
} from "../lib/api";

type ClaimType = "demurrage_counter" | "despatch_claim";

type Props = {
  initialVoyageId?: string;
  onCreated?: (claim: BulkDispute) => void;
  onCancel?: () => void;
};

type JsonRecord = Record<string, any>;

function formatMoney(value: unknown, currency?: string | null) {
  if (value === null || value === undefined || value === "" || !currency) {
    return "Not available";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Not available";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed);
  } catch {
    return `${currency} ${parsed.toFixed(2)}`;
  }
}

function displayValue(value: unknown) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : String(value);
}

function latestCalculation(calculations: LaytimeCalculation[]) {
  return [...calculations].sort((a, b) => b.version - a.version)[0] ?? null;
}

function reversibleSettlementFor(calculation: LaytimeCalculation | null): JsonRecord | null {
  const snapshot = calculation?.decisionSnapshot as JsonRecord | null | undefined;
  const settlement = snapshot?.reversibleSettlement;
  return settlement && typeof settlement === "object" && !Array.isArray(settlement)
    ? settlement
    : null;
}

function nonReversibleSettlementFor(calculation: LaytimeCalculation | null): JsonRecord | null {
  const snapshot = calculation?.decisionSnapshot as JsonRecord | null | undefined;
  const settlement = snapshot?.nonReversibleSettlement;
  return settlement && typeof settlement === "object" && !Array.isArray(settlement)
    ? settlement
    : null;
}

function authorityFor(calculation: LaytimeCalculation | null, settlement: JsonRecord | null) {
  return calculation?.settlementAuthorityStatus ?? settlement?.settlementStatus ?? null;
}

function expectedAmountFor(
  settlement: JsonRecord,
  type: ClaimType,
) {
  const settlementValue = type === "demurrage_counter"
    ? settlement?.demurrageAmount
    : settlement?.despatchAmount;

  return settlementValue === null || settlementValue === undefined || settlementValue === ""
    ? ""
    : String(settlementValue);
}

function voyageLabel(voyage: VoyageListItem) {
  return [
    voyage.reference ?? voyage.id,
    voyage.vessel?.name,
    voyage.loadPort && voyage.dischargePort
      ? `${voyage.loadPort} → ${voyage.dischargePort}`
      : null,
  ].filter(Boolean).join(" · ");
}

export default function ClaimCreatePanel({ initialVoyageId, onCreated, onCancel }: Props) {
  const [voyages, setVoyages] = useState<VoyageListItem[]>([]);
  const [voyageId, setVoyageId] = useState(initialVoyageId ?? "");
  const [calculation, setCalculation] = useState<LaytimeCalculation | null>(null);
  const [claimType, setClaimType] = useState<ClaimType>("demurrage_counter");
  const [amount, setAmount] = useState("");
  const [loadingVoyages, setLoadingVoyages] = useState(!initialVoyageId);
  const [loadingCalculation, setLoadingCalculation] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialVoyageId) return;

    let cancelled = false;
    setLoadingVoyages(true);
    getVoyages()
      .then((result) => {
        if (!cancelled) setVoyages(result);
      })
      .catch((error: any) => {
        if (!cancelled) setLoadingError(error?.message ?? "Unable to load voyages.");
      })
      .finally(() => {
        if (!cancelled) setLoadingVoyages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialVoyageId]);

  useEffect(() => {
    if (!voyageId) {
      setCalculation(null);
      setAmount("");
      return;
    }

    let cancelled = false;
    setLoadingCalculation(true);
    setLoadingError(null);
    setSubmitError(null);

    getLaytimeCalculations(voyageId, { page: 1, limit: 200 })
      .then((result) => {
        if (!cancelled) setCalculation(latestCalculation(result.data ?? []));
      })
      .catch((error: any) => {
        if (!cancelled) {
          setCalculation(null);
          setLoadingError(error?.message ?? "Unable to load the persisted calculation.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCalculation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [voyageId]);

  const reversibleSettlement = reversibleSettlementFor(calculation);
  const nonReversibleSettlement = nonReversibleSettlementFor(calculation);
  const authority = authorityFor(calculation, reversibleSettlement ?? nonReversibleSettlement);
  const isFinalAuthoritative =
    calculation?.status === "Final" && authority === "FINAL_AUTHORITATIVE";
  const isReversibleSettlement = Boolean(reversibleSettlement);
  const isReferenceOnlyChild = Boolean(calculation?.parentCalculationId);
  const isEligible = isFinalAuthoritative && isReversibleSettlement && !isReferenceOnlyChild;
  const currency = calculation?.currency ?? null;
  const selectedVoyage = useMemo(
    () => voyages.find((voyage) => voyage.id === voyageId) ?? null,
    [voyages, voyageId],
  );

  useEffect(() => {
    setAmount(isEligible && reversibleSettlement
      ? expectedAmountFor(reversibleSettlement, claimType)
      : "");
  }, [claimType, isEligible, reversibleSettlement]);

  const eligibilityMessage = !calculation
    ? null
    : isReferenceOnlyChild
      ? "This child calculation is supporting evidence only and cannot create an independent claim."
      : calculation.status !== "Final"
        ? "Calculation is still provisional. Finalize an authoritative commercial settlement before creating a claim."
        : authority !== "FINAL_AUTHORITATIVE"
          ? "This result is not commercially authoritative and cannot be used as a final claim basis."
          : nonReversibleSettlement
            ? "This non-reversible result is final and authoritative, but the current claim endpoint requires an operation-linked authoritative source calculation. That link is not supported by the existing claim create contract."
            : !reversibleSettlement
              ? "Settlement authority is unavailable in this calculation version, so a claim cannot be created safely."
              : "Eligible source: final authoritative reversible settlement. The backend will persist the claim in Open status and validate the amount.";

  async function handleSubmit() {
    setSubmitError(null);
    const parsedAmount = Number(amount);

    if (!voyageId) {
      setSubmitError("Select a voyage before creating a claim.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setSubmitError("Enter a valid non-negative claim amount.");
      return;
    }
    if (!isEligible) {
      setSubmitError(eligibilityMessage ?? "This calculation cannot be used to create a claim safely.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createBulkDispute({
        voyageId,
        type: claimType,
        amountDisputed: parsedAmount,
        status: "Open",
      });
      onCreated?.(created);
    } catch (error: any) {
      setSubmitError(error?.message ?? "Unable to create the claim.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }} aria-label="Create claim">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 style={{ fontSize: "15px", color: "#111827", fontWeight: 600 }}>Create claim</h2>
          <p className="mt-1" style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.45 }}>
            Creates a persisted bulk-dispute record through the backend. Claim creation is not available for provisional, legacy, or non-authoritative results.
          </p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ fontSize: "12px", color: "#475569", background: "none", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
        )}
      </div>

      {!initialVoyageId && (
        <label className="mt-4 block" style={{ fontSize: "11px", color: "#475569" }}>
          Voyage
          <select
            value={voyageId}
            onChange={(event) => setVoyageId(event.target.value)}
            disabled={loadingVoyages}
            className="mt-1 w-full rounded-md border px-3 py-2"
            style={{ borderColor: "#D1D5DB", fontSize: "12px", color: "#111827", backgroundColor: "#FFFFFF" }}
          >
            <option value="">{loadingVoyages ? "Loading voyages..." : "Select a voyage"}</option>
            {voyages.map((voyage) => <option key={voyage.id} value={voyage.id}>{voyageLabel(voyage)}</option>)}
          </select>
        </label>
      )}

      {selectedVoyage && (
        <p className="mt-3" style={{ fontSize: "11px", color: "#475569" }}>Voyage: {voyageLabel(selectedVoyage)}</p>
      )}

      {loadingCalculation && <p className="mt-4" style={{ fontSize: "12px", color: "#64748B" }}>Loading latest persisted calculation...</p>}
      {loadingError && <p className="mt-4 rounded-md border p-3" style={{ fontSize: "12px", color: "#991B1B", borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }}>{loadingError}</p>}

      {calculation && !loadingCalculation && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Calculation version", calculation.version],
              ["Lifecycle", calculation.status],
              ["Authority", displayValue(authority)],
              ["Currency", displayValue(currency)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
                <p style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                <p className="mt-1" style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{displayValue(value)}</p>
              </div>
            ))}
          </div>

          {!isEligible ? (
            <p className="mt-3 rounded-md border p-3" style={{ fontSize: "12px", color: "#92400E", borderColor: "#FCD34D", backgroundColor: "#FFFBEB", lineHeight: 1.45 }}>
              {eligibilityMessage}
            </p>
          ) : (
            <p className="mt-3 rounded-md border p-3" style={{ fontSize: "12px", color: "#166534", borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", lineHeight: 1.45 }}>
              {eligibilityMessage}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label style={{ fontSize: "11px", color: "#475569" }}>
              Claim type
              <select value={claimType} onChange={(event) => setClaimType(event.target.value as ClaimType)} className="mt-1 w-full rounded-md border px-3 py-2" style={{ borderColor: "#D1D5DB", fontSize: "12px", color: "#111827", backgroundColor: "#FFFFFF" }}>
                <option value="demurrage_counter">Demurrage counterclaim</option>
                <option value="despatch_claim">Despatch claim</option>
              </select>
            </label>
            <label style={{ fontSize: "11px", color: "#475569" }}>
              Amount disputed ({displayValue(currency)})
              <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" style={{ borderColor: "#D1D5DB", fontSize: "12px", color: "#111827" }} />
            </label>
          </div>

          {submitError && <p className="mt-3 rounded-md border p-3" style={{ fontSize: "12px", color: "#991B1B", borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }}>{submitError}</p>}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !isEligible} className="rounded-md px-3 py-2" style={{ fontSize: "12px", color: "#FFFFFF", backgroundColor: isSubmitting || !isEligible ? "#94A3B8" : "#1A4ED8", border: "none", cursor: isSubmitting || !isEligible ? "not-allowed" : "pointer" }}>
              {isSubmitting ? "Creating..." : "Create claim"}
            </button>
          </div>
        </>
      )}

      {!loadingCalculation && voyageId && !calculation && !loadingError && (
        <p className="mt-4 rounded-md border p-3" style={{ fontSize: "12px", color: "#64748B", borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
          No persisted laytime calculation is available for this voyage. A claim cannot be created safely.
        </p>
      )}
    </section>
  );
}
