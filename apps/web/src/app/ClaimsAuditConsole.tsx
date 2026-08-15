import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "./Layout";
import {
  getBulkDispute,
  getLaytimeCalculations,
  getVoyageSummary,
  updateBulkDispute,
  type BulkDispute,
} from "../lib/api";

// ─── Variance Card ────────────────────────────────────────────────────────────

function VarianceCard({ label, value, sub, bg, border, valueColor, subColor }:
  { label: string; value: string; sub: string; bg: string; border: string; valueColor: string; subColor: string }) {
  return (
    <div className="flex-1 flex flex-col gap-1 rounded-lg p-[12px_14px]"
      style={{ backgroundColor: bg, border: `0.5px solid ${border}` }}>
      <p style={{ fontSize: "10px", color: subColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 500, color: valueColor, lineHeight: 1.2 }}>{value}</p>
      <p style={{ fontSize: "11px", color: subColor }}>{sub}</p>
    </div>
  );
}

// ─── Tag Pill ─────────────────────────────────────────────────────────────────

function TagPill({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: bg, color: text }}>
      {label}
    </span>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

type EventRowState = "normal" | "disputed" | "adjusted";

function EventRow({ n, timestamp, name, detail, tag, tagBg, tagText, state = "normal" }: {
  n: string; timestamp: string; name: string; detail: string;
  tag: string; tagBg: string; tagText: string; state?: EventRowState;
}) {
  const isDisputed = state === "disputed";
  const isAdjusted = state === "adjusted";
  const rowBg = isDisputed ? "#FEF2F2" : isAdjusted ? "#EFF6FF" : "transparent";
  const numBg = isDisputed ? "#FECACA" : isAdjusted ? "#BFDBFE" : "#F3F4F6";
  const numColor = isDisputed ? "#9B2C2C" : isAdjusted ? "#1E40AF" : "#6B7280";

  return (
    <div className="flex gap-3 mb-3 last:mb-0">
      <div
        className="rounded-lg flex-1 p-2"
        style={{ backgroundColor: rowBg, transition: "background-color 0.12s" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0 font-medium"
            style={{ width: "20px", height: "20px", backgroundColor: numBg, color: numColor, fontSize: "10px", marginTop: "1px" }}>
            {n}
          </span>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>{timestamp}</p>
            <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{name}</p>
            <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4, marginBottom: "5px" }}>{detail}</p>
            <TagPill label={tag} bg={tagBg} text={tagText} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Discrepancy Card ─────────────────────────────────────────────────────────

type DiscrepancyLevel = "critical" | "medium" | "low";

const discrepancyAccent: Record<DiscrepancyLevel, { border: string; labelColor: string; valueColor: string }> = {
  critical: { border: "#EF4444", labelColor: "#C53030", valueColor: "#C53030" },
  medium:   { border: "#F59E0B", labelColor: "#B45309", valueColor: "#B45309" },
  low:      { border: "#10B981", labelColor: "#22543D", valueColor: "#22543D" },
};

function DiscrepancyCard({ level, type, title, desc, variance }: {
  level: DiscrepancyLevel; type: string; title: string; desc: string; variance: string;
}) {
  const c = discrepancyAccent[level];
  return (
    <div className="flex flex-col gap-1.5 rounded-r-lg p-[12px_14px]"
      style={{
        border: "0.5px solid #E5E7EB",
        borderLeft: `3px solid ${c.border}`,
        borderRadius: "0 8px 8px 0",
        backgroundColor: "#ffffff",
      }}>
      <p style={{ fontSize: "10px", color: c.labelColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{type}</p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{title}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: c.valueColor }}>{variance}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function formatMoney(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatText(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }

  return String(value);
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function ClaimFieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-[12px_14px] flex flex-col gap-1"
      style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
    >
      <p
        style={{
          fontSize: "10px",
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "12px", color: "#111827", fontWeight: 500, lineHeight: 1.4 }}>
        {value}
      </p>
    </div>
  );
}

const CLAIM_STATUSES = [
  "Open",
  "Evidence Submitted",
  "In Negotiation",
  "Resolved",
] as const;

export default function ClaimsAuditConsole({ onGenerateReport, onSaveForReview, claimId }: {
  onGenerateReport?: () => void;
  onSaveForReview?: () => void;
  claimId?: string;
}) {
  const [notes, setNotes] = useState("");
  const [claim, setClaim] = useState<BulkDispute | null>(null);
  const [claimLoading, setClaimLoading] = useState(Boolean(claimId));
  const [claimError, setClaimError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<string>("Open");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [resolvedDate, setResolvedDate] = useState("");
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [voyageSummary, setVoyageSummary] = useState<any | null>(null);
  const [latestLaytimeCalculation, setLatestLaytimeCalculation] = useState<any | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  async function loadClaim() {
    if (!claimId) {
      return;
    }

    setClaimLoading(true);
    setClaimError(null);

    try {
      const result = await getBulkDispute(claimId);
      setClaim(result);
      setStatusValue(String(result.status ?? "Open"));
      setSettlementAmount(
        result.finalSettlementAmount === undefined ||
        result.finalSettlementAmount === null ||
        result.finalSettlementAmount === ""
          ? ""
          : String(result.finalSettlementAmount)
      );
      setResolvedDate(toDatetimeLocalValue(result.resolvedDate as string | null | undefined));
      setStatusError(null);
    } catch (error: any) {
      setClaim(null);
      setClaimError(error?.message ?? "Unable to load persisted claim.");
    } finally {
      setClaimLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadClaimContext(voyageId: string) {
      setContextLoading(true);

      try {
        const [summaryResult, calculationsResult] = await Promise.allSettled([
          getVoyageSummary(voyageId),
          getLaytimeCalculations(voyageId, { page: 1, limit: 1 }),
        ]);

        if (cancelled) {
          return;
        }

        setVoyageSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
        setLatestLaytimeCalculation(
          calculationsResult.status === "fulfilled"
            ? calculationsResult.value.data?.[0] ?? null
            : null
        );
      } finally {
        if (!cancelled) {
          setContextLoading(false);
        }
      }
    }

    if (!claim?.voyageId) {
      setVoyageSummary(null);
      setLatestLaytimeCalculation(null);
      setContextLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void loadClaimContext(claim.voyageId);

    return () => {
      cancelled = true;
    };
  }, [claim?.voyageId]);

  useEffect(() => {
    void loadClaim();
  }, [claimId]);

  async function handleStatusChange(nextStatus: string) {
    if (!claimId || !claim) {
      return;
    }

    if (nextStatus === claim.status) {
      setStatusValue(nextStatus);
      return;
    }

    setStatusValue(nextStatus);
    setStatusSaving(true);
    setStatusError(null);
    setStatusSuccess(null);

    try {
      await updateBulkDispute(claimId, { status: nextStatus as (typeof CLAIM_STATUSES)[number] });
      await loadClaim();
      setStatusSuccess(`Status updated to ${nextStatus}.`);
    } catch (error: any) {
      setStatusError(error?.message ?? "Unable to update claim status.");
      setStatusValue(String(claim.status ?? "Open"));
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleSettlementSave() {
    if (!claimId || !claim) {
      return;
    }

    const currentStatus = String(claim.status ?? statusValue);
    if (currentStatus !== "Resolved") {
      return;
    }

    const trimmedAmount = settlementAmount.trim();
    const parsedAmount = trimmedAmount === "" ? undefined : Number(trimmedAmount);

    if (trimmedAmount !== "" && Number.isNaN(parsedAmount)) {
      setStatusError("Enter a valid settlement amount.");
      return;
    }

    if (!resolvedDate) {
      setStatusError("Enter a resolved date.");
      return;
    }

    setSettlementSaving(true);
    setStatusError(null);
    setStatusSuccess(null);

    try {
      await updateBulkDispute(claimId, {
        status: "Resolved",
        finalSettlementAmount: parsedAmount,
        resolvedDate: new Date(resolvedDate).toISOString(),
      });
      await loadClaim();
      setStatusSuccess("Settlement details updated.");
    } catch (error: any) {
      setStatusError(error?.message ?? "Unable to update settlement details.");
    } finally {
      setSettlementSaving(false);
    }
  }

  if (claimLoading) {
    return (
      <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
        <PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "Claim detail" }]} />
        <div style={{ padding: "24px", color: "#6B7280", fontSize: "12px" }}>
          Loading persisted claim...
        </div>
      </div>
    );
  }

  if (claimError || !claim) {
    return (
      <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
        <PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "Claim detail" }]} />
        <div style={{ padding: "24px" }}>
          <div
            className="rounded-lg border p-[12px_14px]"
            style={{ backgroundColor: "#ffffff", borderColor: "#FCA5A5", borderWidth: "0.5px" }}
          >
            <p style={{ fontSize: "12px", fontWeight: 500, color: "#9B2C2C", marginBottom: "4px" }}>
              Unable to load persisted claim.
            </p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>
              {claimError ?? "Not available"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (claimId) {
    const summaryVoyage = voyageSummary?.voyage ?? null;
    const currentStatus = String(claim.status ?? statusValue ?? "Open");
    const isResolved = currentStatus === "Resolved";
    const claimAmount = toNumber(claim.amountDisputed);
    const demurrageAmount = toNumber(latestLaytimeCalculation?.demurrageAmount);
    const despatchAmount = toNumber(latestLaytimeCalculation?.despatchAmount);
    const hasCalculation = Boolean(latestLaytimeCalculation);
    const reconstructedAmount = hasCalculation
      ? (demurrageAmount !== null && demurrageAmount > 0
        ? demurrageAmount
        : despatchAmount !== null && despatchAmount > 0
          ? despatchAmount
          : 0)
      : null;
    const varianceAmount =
      claimAmount !== null && reconstructedAmount !== null ? claimAmount - reconstructedAmount : null;
    const isVarianceZero = varianceAmount !== null && Math.abs(varianceAmount) < 0.005;
    const recommendedAction = !hasCalculation
      ? "Calculation data unavailable."
      : isVarianceZero
        ? "Calculated position matches the claim amount."
        : varianceAmount !== null && varianceAmount > 0
          ? "Review and dispute the unsupported variance."
          : "Review whether additional recovery is available.";
    const recommendedStrategy = currentStatus === "Resolved"
      ? "Close-out and reconcile"
      : !hasCalculation
        ? "Await laytime calculation"
        : isVarianceZero
          ? "Accept and reconcile"
          : varianceAmount !== null && varianceAmount > 0
            ? "Dispute & negotiate"
            : "Review for recovery";
    const targetPosition = currentStatus === "Resolved" && claim.finalSettlementAmount !== undefined && claim.finalSettlementAmount !== null
      ? formatMoney(claim.finalSettlementAmount)
      : reconstructedAmount !== null
        ? formatMoney(reconstructedAmount)
        : "Not available";
    const settlementStatus =
      currentStatus === "Resolved"
        ? claim.finalSettlementAmount !== undefined && claim.finalSettlementAmount !== null
          ? `Resolved at ${formatMoney(claim.finalSettlementAmount)}`
          : "Resolved"
        : currentStatus;
    const counterpartyLinks = Array.isArray(summaryVoyage?.counterpartyLinks)
      ? summaryVoyage.counterpartyLinks
      : [];
    const supplierLink = counterpartyLinks.find((link: any) => link?.role === "Supplier");
    const receiverLink = counterpartyLinks.find((link: any) => link?.role === "Receiver");
    const supplierName =
      supplierLink?.counterparty?.name ??
      supplierLink?.counterpartyName ??
      supplierLink?.name ??
      supplierLink?.party?.name ??
      supplierLink?.partyName ??
      null;
    const receiverName =
      receiverLink?.counterparty?.name ??
      receiverLink?.counterpartyName ??
      receiverLink?.name ??
      receiverLink?.party?.name ??
      receiverLink?.partyName ??
      null;

    return (
      <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
        <PageHeader
          crumbs={[
            { label: "Claims", to: "/claims" },
            { label: claim.id },
            { label: "Claim detail" },
          ]}
          actions={
            <button
              className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{
                height: "32px",
                fontSize: "12px",
                color: "#374151",
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#ffffff",
              }}
              onClick={onSaveForReview}
            >
              Back to claims
            </button>
          }
        />

        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
        >
          <div className="flex items-start gap-4">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Claim detail</h1>
            <p style={{ fontSize: "12px", color: "#6B7280" }}>
              Persisted bulk-dispute record loaded from the backend.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "11px", color: "#6B7280" }}>Status</span>
            <select
              value={statusValue}
              disabled={statusSaving}
              onChange={(e) => void handleStatusChange(e.target.value)}
              className="appearance-none outline-none cursor-pointer"
              style={{
                height: "32px",
                border: "0.5px solid #E5E7EB",
                borderRadius: "8px",
                padding: "0 12px",
                fontSize: "12px",
                color: "#374151",
                backgroundColor: "#ffffff",
                opacity: statusSaving ? 0.7 : 1,
              }}
            >
              {CLAIM_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {(statusSuccess || statusError) && (
          <div style={{ padding: "12px 24px 0" }}>
            <div
              className="rounded-lg border px-3 py-2"
              style={{
                backgroundColor: statusError ? "#FEF2F2" : "#F0FDF4",
                borderColor: statusError ? "#FCA5A5" : "#86EFAC",
                borderWidth: "0.5px",
                color: statusError ? "#9B2C2C" : "#22543D",
                fontSize: "12px",
              }}
            >
              {statusError ?? statusSuccess}
            </div>
          </div>
        )}

        <div style={{ padding: "24px" }}>
          <div
            className="rounded-xl border"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                padding: "16px",
              }}
            >
              <ClaimFieldCard label="Claim ID" value={claim.id || "Not available"} />
              <ClaimFieldCard label="Voyage ID" value={claim.voyageId || "Not available"} />
              <ClaimFieldCard label="Type" value={claim.type || "Not available"} />
              <ClaimFieldCard label="Amount disputed" value={formatMoney(claim.amountDisputed)} />
              <ClaimFieldCard label="Status" value={claim.status || "Not available"} />
              <ClaimFieldCard label="Created date" value={formatDate(claim.createdDate as string | null | undefined)} />
            </div>
          </div>
        </div>

        {isResolved && (
          <div style={{ padding: "0 24px 24px" }}>
            <div
              className="rounded-xl border"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            >
              <div style={{ padding: "16px 16px 12px" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                      Resolution & settlement
                    </h2>
                    <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>
                      Persisted settlement details for the resolved claim.
                    </p>
                  </div>
                  <button
                    className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                    style={{
                      height: "32px",
                      fontSize: "12px",
                      color: "#ffffff",
                      border: "none",
                      backgroundColor: "#1A4ED8",
                      opacity: settlementSaving ? 0.75 : 1,
                    }}
                    onClick={() => void handleSettlementSave()}
                    disabled={settlementSaving}
                  >
                    Save settlement
                  </button>
                </div>
              </div>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  padding: "0 16px 16px",
                }}
              >
                <div
                  className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                  style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Final settlement amount
                    </p>
                    <p style={{ fontSize: "12px", color: "#111827", fontWeight: 500, lineHeight: 1.4 }}>
                      {formatMoney(claim.finalSettlementAmount)}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settlementAmount}
                    placeholder="Not available"
                    onChange={(e) => setSettlementAmount(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 outline-none"
                    style={{
                      height: "32px",
                      borderColor: "#E5E7EB",
                      borderWidth: "0.5px",
                      fontSize: "12px",
                      color: "#111827",
                    }}
                  />
                </div>

                <div
                  className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                  style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Resolved date
                    </p>
                    <p style={{ fontSize: "12px", color: "#111827", fontWeight: 500, lineHeight: 1.4 }}>
                      {formatDate(claim.resolvedDate as string | null | undefined)}
                    </p>
                  </div>
                  <input
                    type="datetime-local"
                    value={resolvedDate}
                    onChange={(e) => setResolvedDate(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 outline-none"
                    style={{
                      height: "32px",
                      borderColor: "#E5E7EB",
                      borderWidth: "0.5px",
                      fontSize: "12px",
                      color: "#111827",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "0 24px 24px" }}>
          <div
            className="rounded-xl border"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <div style={{ padding: "16px 16px 12px" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                    Voyage & calculation context
                  </h2>
                  <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>
                    Persisted voyage summary and latest laytime calculation.
                  </p>
                </div>
                {contextLoading && (
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>Loading context...</span>
                )}
              </div>
            </div>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                padding: "0 16px 16px",
              }}
            >
              <ClaimFieldCard label="Vessel name" value={formatText(summaryVoyage?.vessel?.name)} />
              <ClaimFieldCard label="Voyage reference" value={formatText(summaryVoyage?.reference)} />
              <ClaimFieldCard label="Supplier" value={formatText(supplierName)} />
              <ClaimFieldCard label="Receiver" value={formatText(receiverName)} />
              <ClaimFieldCard label="Load port" value={formatText(summaryVoyage?.loadPort)} />
              <ClaimFieldCard label="Discharge port" value={formatText(summaryVoyage?.dischargePort)} />
              <ClaimFieldCard
                label="Laytime calculation ID"
                value={formatText(latestLaytimeCalculation?.id)}
              />
              <ClaimFieldCard
                label="Version"
                value={formatText(latestLaytimeCalculation?.version)}
              />
              <ClaimFieldCard
                label="Allowed laytime"
                value={formatText(latestLaytimeCalculation?.allowedLaytime)}
              />
              <ClaimFieldCard
                label="Used laytime"
                value={formatText(latestLaytimeCalculation?.usedLaytime)}
              />
              <ClaimFieldCard
                label="Demurrage amount"
                value={formatMoney(latestLaytimeCalculation?.demurrageAmount)}
              />
              <ClaimFieldCard
                label="Despatch amount"
                value={formatMoney(latestLaytimeCalculation?.despatchAmount)}
              />
              <ClaimFieldCard
                label="Calculated at"
                value={formatDate(latestLaytimeCalculation?.calculatedAt)}
              />
            </div>
          </div>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <div
            className="rounded-xl border"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <div style={{ padding: "16px 16px 12px" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                    Claim analysis
                  </h2>
                  <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>
                    Real-data reconstruction and negotiation context derived from the persisted claim.
                  </p>
                </div>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  Latest calculation version {formatText(latestLaytimeCalculation?.version)}
                </span>
              </div>
            </div>

            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                padding: "0 16px 16px",
              }}
            >
              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    AI reconstruction
                  </p>
                  <span style={{ fontSize: "10px", color: "#1E40AF" }}>
                    {formatDate(latestLaytimeCalculation?.calculatedAt)}
                  </span>
                </div>
                <ClaimFieldCard label="Claim amount" value={formatMoney(claim.amountDisputed)} />
                <ClaimFieldCard
                  label="Reconstructed amount"
                  value={formatMoney(reconstructedAmount)}
                />
                <ClaimFieldCard
                  label="Allowed laytime"
                  value={formatText(latestLaytimeCalculation?.allowedLaytime)}
                />
                <ClaimFieldCard
                  label="Used laytime"
                  value={formatText(latestLaytimeCalculation?.usedLaytime)}
                />
              </div>

              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-3"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Variance strip
                </p>
                <div className="flex gap-2.5 flex-wrap">
                  <VarianceCard
                    label="Their claim value"
                    value={formatMoney(claim.amountDisputed)}
                    sub="Persisted claim amount"
                    bg="#FEF2F2"
                    border="#FECACA"
                    valueColor="#C53030"
                    subColor="#9B2C2C"
                  />
                  <VarianceCard
                    label="Our reconstructed value"
                    value={formatMoney(reconstructedAmount)}
                    sub="Latest persisted laytime calc"
                    bg="#EFF6FF"
                    border="#BFDBFE"
                    valueColor="#1A4ED8"
                    subColor="#1E40AF"
                  />
                  <VarianceCard
                    label="Total variance"
                    value={formatMoney(varianceAmount)}
                    sub="Claim minus reconstructed"
                    bg="#FFFBEB"
                    border="#FDE68A"
                    valueColor="#B45309"
                    subColor="#7B341E"
                  />
                </div>
              </div>

              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Calculation breakdown
                </p>
                <ClaimFieldCard
                  label="Calculation version"
                  value={formatText(latestLaytimeCalculation?.version)}
                />
                <ClaimFieldCard
                  label="Allowed laytime"
                  value={formatText(latestLaytimeCalculation?.allowedLaytime)}
                />
                <ClaimFieldCard
                  label="Used laytime"
                  value={formatText(latestLaytimeCalculation?.usedLaytime)}
                />
                <ClaimFieldCard
                  label="Demurrage amount"
                  value={formatMoney(latestLaytimeCalculation?.demurrageAmount)}
                />
                <ClaimFieldCard
                  label="Despatch amount"
                  value={formatMoney(latestLaytimeCalculation?.despatchAmount)}
                />
              </div>

              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Evidence available
                </p>
                <ClaimFieldCard
                  label="Voyage summary"
                  value={summaryVoyage ? "Available" : "Not available"}
                />
                <ClaimFieldCard
                  label="Latest laytime calculation"
                  value={latestLaytimeCalculation ? "Available" : "Not available"}
                />
                <ClaimFieldCard
                  label="Supplier / receiver"
                  value={supplierName && receiverName ? "Available" : "Not available"}
                />
              </div>

              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Recommended action
                </p>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{recommendedAction}</p>
              </div>

              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Negotiation position
                </p>
                <ClaimFieldCard label="Recommended strategy" value={recommendedStrategy} />
                <ClaimFieldCard label="Target position" value={targetPosition} />
                <ClaimFieldCard label="Settlement status" value={settlementStatus} />
              </div>

              <div
                className="rounded-lg border p-[12px_14px] flex flex-col gap-2"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Reviewer notes
                  </p>
                  <span style={{ fontSize: "10px", color: "#9CA3AF" }}>Not yet persisted</span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record the reasoning behind your decision"
                  style={{
                    minHeight: "72px",
                    border: "0.5px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    resize: "vertical",
                    backgroundColor: "#ffffff",
                    color: "#111827",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function handleDraftEmail() {
    const subject = encodeURIComponent("Demurrage claim CLM-2311-VAS — dispute discrepancies");
    const body = encodeURIComponent(
      `Hi,\n\nWe've identified 3 discrepancies in the demurrage claim from Vitol Asia (Ref: CLM-2311-VAS) totalling an overcharge that requires review.\n\n${notes ? `Reviewer notes:\n${notes}\n\n` : ""}Please advise on next steps.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Claims", to: "/claims" }, { label: "BW Magnolia · VOY-2311", to: "/shipments/VOY-2311" }, { label: "Audit console" }]}
        actions={
          <>
            {onGenerateReport ? (
              <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                onClick={onGenerateReport}>
                Generate dispute report <ArrowUpRight size={12} />
              </button>
            ) : null}
          </>
        }
      />

      {/* ── Claim Header ── */}
      <div className="flex items-start justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Claims audit console</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
              style={{ backgroundColor: "#FED7D7", color: "#9B2C2C", fontSize: "11px" }}>
              <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#C53030" }} />
              3 critical discrepancies
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
              style={{ backgroundColor: "#C6F6D5", color: "#22543D", fontSize: "11px" }}>
              <CheckCircle size={11} style={{ color: "#22543D" }} />
              AI reconstruction verified
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            Counterparty: Vitol Asia &nbsp;·&nbsp; Ref: CLM-2311-VAS &nbsp;·&nbsp; Submitted: 28 Oct 2023
          </p>
        </div>
      </div>

      {/* ── Variance Strip ── */}
      <div className="flex gap-2.5 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <VarianceCard
          label="Their claim value"
          value="$142,500"
          sub="Counterparty submitted figure"
          bg="#FEF2F2" border="#FECACA"
          valueColor="#C53030" subColor="#9B2C2C"
        />
        <VarianceCard
          label="Our reconstructed value"
          value="$118,250"
          sub="AI-verified SOF reconstruction"
          bg="#EFF6FF" border="#BFDBFE"
          valueColor="#1A4ED8" subColor="#1E40AF"
        />
        <VarianceCard
          label="Total variance"
          value="–$24,250"
          sub="Recoverable via dispute"
          bg="#FFFBEB" border="#FDE68A"
          valueColor="#B45309" subColor="#7B341E"
        />
      </div>

      {/* ── Main Comparison Grid ── */}
      <div className="flex flex-1" style={{ borderTop: "0.5px solid #E5E7EB" }}>

        {/* Left — Supplier submission */}
        <div className="flex-1 min-w-0" style={{ borderRight: "0.5px solid #E5E7EB", padding: "14px 16px" }}>
          <p className="mb-4" style={{ fontSize: "11px", fontWeight: 500, color: "#C53030", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Supplier submission
          </p>

          <EventRow n="01" timestamp="23 Oct 08:00" name="NOR tendered"
            detail="Counterparty records NOR accepted at 08:00. Laytime commences immediately — no waiting applied."
            tag="Laytime counting" tagBg="#EFF6FF" tagText="#1E40AF" />

          <EventRow n="02" timestamp="23 Oct 14:30" name="Berth delay — congestion"
            detail="Terminal congestion delay. No deduction applied by counterparty."
            tag="Counting — 6h 30m" tagBg="#EFF6FF" tagText="#1E40AF" />

          <EventRow n="03" timestamp="24 Oct 11:20" name="Rain squall — not deducted"
            detail="Operations suspended 2h 30m. Counterparty argues SHINC applies — no deduction applied."
            tag="Disputed — no deduction applied" tagBg="#FED7D7" tagText="#9B2C2C"
            state="disputed" />

          <EventRow n="04" timestamp="25 Oct 21:20" name="Loading completed"
            detail="Last hose disconnected. Counterparty calculates total laytime used: 62h 50m."
            tag="Laytime ends" tagBg="#F3F4F6" tagText="#374151" />
        </div>

        {/* Right — AI reconstruction */}
        <div className="flex-1 min-w-0" style={{ padding: "14px 16px" }}>
          <p className="mb-4" style={{ fontSize: "11px", fontWeight: 500, color: "#1A4ED8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI reconstruction
          </p>

          <EventRow n="01" timestamp="23 Oct 14:00" name="NOR acceptance corrected"
            detail="Pilot station logs confirm NOR tendered 08:00, accepted 14:00 per 6h notice. +6h recovered."
            tag="+6h recovered · $9,200" tagBg="#C6F6D5" tagText="#22543D"
            state="adjusted" />

          <EventRow n="02" timestamp="23 Oct 14:30" name="Berth delay confirmed"
            detail="Terminal congestion confirmed by port authority records. Correctly counting."
            tag="Confirmed · matches SOF" tagBg="#EFF6FF" tagText="#1E40AF" />

          <EventRow n="03" timestamp="24 Oct 11:20" name="Rain squall — deduction applied"
            detail="Terminal weather log and rain gauge data confirm qualifying event under charter party clause 8(b)."
            tag="–4h 30m deducted · $11,450" tagBg="#C6F6D5" tagText="#22543D"
            state="adjusted" />

          <EventRow n="04" timestamp="25 Oct 21:20" name="Loading completion confirmed"
            detail="AI reconstruction: net laytime used 54h 20m. No demurrage — within allowed 72h."
            tag="Net used: 54h 20m · no demurrage" tagBg="#C6F6D5" tagText="#22543D" />
        </div>
      </div>

      {/* ── Discrepancy Analysis ── */}
      <div className="flex-shrink-0" style={{ padding: "14px 24px", borderTop: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Discrepancy analysis
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
            style={{ backgroundColor: "#FED7D7", color: "#9B2C2C", fontSize: "10px" }}>
            $24,250 recoverable
          </span>
        </div>

        {/* 3 discrepancy cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <DiscrepancyCard level="critical" type="Critical · NOR timing"
            title="Incorrect NOR start time"
            desc="Counterparty started laytime at NOR tender (08:00) rather than NOR acceptance (14:00), ignoring the 6h notice period mandated in the charter party."
            variance="+6h · $9,200 overcharge" />
          <DiscrepancyCard level="critical" type="Critical · deduction clause"
            title="Wrong deduction treatment"
            desc="Rain squall qualifying under CP clause 8(b) not deducted. Terminal weather log confirms 2h 30m + 2h arm breakdown = 4h 30m total deductible time."
            variance="+4h 30m · $11,450 overcharge" />
          <DiscrepancyCard level="medium" type="Medium · calendar basis"
            title="Calendar mismatch"
            desc="Counterparty applied SHEX calendar rather than SHINC as agreed. Affects weekend hours calculation for the Singapore terminal berth window."
            variance="+2h 15m · $3,600 overcharge" />
        </div>

        {/* Evidence + Recommendation row */}
        <div className="flex gap-2.5" style={{ borderTop: "0.5px solid #E5E7EB", paddingTop: "12px" }}>
          <div className="flex-1 rounded-lg p-[10px_12px]" style={{ backgroundColor: "#F9FAFB" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Evidence available
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Pilot station log",
                "Port authority NOR record",
                "Terminal weather log",
                "Rain gauge data",
                "CP clause 8(b) extract",
              ].map((ev) => (
                <span key={ev} className="rounded-full px-2.5 py-0.5 cursor-pointer transition-colors"
                  style={{ fontSize: "11px", border: "0.5px solid #BFDBFE", backgroundColor: "#EFF6FF", color: "#1E40AF" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#DBEAFE")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#EFF6FF")}>
                  {ev}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-[10px_12px] flex flex-col gap-1" style={{ backgroundColor: "#F9FAFB", minWidth: "200px" }}>
            <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recommended action
            </p>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#22543D" }}>Dispute &amp; negotiate</p>
            <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
              94% confidence · all 3 discrepancies supported by primary evidence
            </p>
          </div>
        </div>
      </div>

      {/* ── Reviewer notes ── */}
      <div className="flex-shrink-0" style={{ padding: "12px 24px 0", backgroundColor: "#F9FAFB" }}>
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Reviewer notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record the reasoning behind your review — this is used for the email draft…"
            style={{
              height: "60px", border: "0.5px solid #E5E7EB", borderRadius: "8px",
              padding: "8px 10px", fontSize: "12px", resize: "none", backgroundColor: "#ffffff",
            }}
          />
        </label>
      </div>

      {/* ── Footer Action Bar ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "12px 24px", borderTop: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full" style={{ width: "7px", height: "7px", backgroundColor: "#10B981" }} />
          <span style={{ fontSize: "11px", color: "#6B7280" }}>Status: review notes ready</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSaveForReview}
            className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
            style={{ height: "34px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            Save for review
          </button>
          <button onClick={handleDraftEmail}
            className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
            style={{ height: "34px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            Draft email
          </button>
          {onGenerateReport ? (
            <button onClick={onGenerateReport}
              className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{ height: "34px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
              Generate dispute report <ArrowUpRight size={12} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
