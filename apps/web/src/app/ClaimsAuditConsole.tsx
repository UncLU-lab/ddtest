import { useEffect, useState, type ReactNode } from "react";
import { getBulkDispute, getLaytimeCalculationAudit, getLaytimeCalculations, getVoyageSummary, updateBulkDispute, type BulkDispute, type LaytimeCalculation, type LaytimeCalculationAudit } from "../lib/api";
import { PageHeader } from "./Layout";

const CLAIM_STATUSES = ["Open", "Evidence Submitted", "In Negotiation", "Resolved"] as const;
type ClaimStatus = (typeof CLAIM_STATUSES)[number];
type JsonRecord = Record<string, any>;

function displayValue(value: unknown) {
  return value === null || value === undefined || value === "" ? "Not available" : String(value);
}

function formatDate(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(value: unknown, currency?: string | null) {
  if (value === null || value === undefined || value === "" || !currency) return "Not available";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Not available";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
  } catch {
    return `${currency} ${parsed.toFixed(2)}`;
  }
}

function typeLabel(type?: string) {
  if (type === "demurrage_counter") return "Demurrage counterclaim";
  if (type === "despatch_claim") return "Despatch claim";
  return type || "Not available";
}

function statusLabel(status?: string) {
  if (status === "Evidence Submitted") return "Evidence submitted";
  if (status === "In Negotiation") return "In negotiation";
  return status || "Not available";
}

function authorityLabel(value?: string | null) {
  if (value === "FINAL_AUTHORITATIVE") return "Final authoritative";
  if (value === "NONAUTHORITATIVE") return "Non-authoritative";
  if (value === "PROVISIONAL") return "Provisional";
  if (value === "LEGACY") return "Legacy";
  return "Authority not available";
}

function latestCalculation(calculations: LaytimeCalculation[]) {
  return [...calculations].sort((a, b) => b.version - a.version)[0] ?? null;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
      <p style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p className="mt-1" style={{ fontSize: "12px", color: "#111827", fontWeight: 600, lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "#E5E7EB" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function ClaimsAuditConsole({ onSaveForReview, claimId }: { onSaveForReview?: () => void; claimId?: string }) {
  const [claim, setClaim] = useState<BulkDispute | null>(null);
  const [calculation, setCalculation] = useState<LaytimeCalculation | null>(null);
  const [audit, setAudit] = useState<LaytimeCalculationAudit | null>(null);
  const [voyageSummary, setVoyageSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(Boolean(claimId));
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [resolvedDate, setResolvedDate] = useState("");

  async function loadClaim() {
    if (!claimId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getBulkDispute(claimId);
      setClaim(result);
      setSettlementAmount(result.finalSettlementAmount === null || result.finalSettlementAmount === undefined ? "" : String(result.finalSettlementAmount));
      setResolvedDate(result.resolvedDate ? String(result.resolvedDate).slice(0, 16) : "");
    } catch (loadError: any) {
      setClaim(null);
      setError(loadError?.message ?? "Unable to load persisted claim.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadClaim(); }, [claimId]);

  useEffect(() => {
    if (!claim?.voyageId) return;
    let cancelled = false;
    setContextLoading(true);
    Promise.allSettled([
      getVoyageSummary(claim.voyageId),
      getLaytimeCalculations(claim.voyageId, { page: 1, limit: 200 }),
    ]).then(async ([summaryResult, calculationsResult]) => {
      if (cancelled) return;
      setVoyageSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
      const nextCalculation = calculationsResult.status === "fulfilled" ? latestCalculation(calculationsResult.value.data ?? []) : null;
      setCalculation(nextCalculation);
      if (nextCalculation) {
        try {
          const nextAudit = await getLaytimeCalculationAudit(nextCalculation.id);
          if (!cancelled) setAudit(nextAudit);
        } catch {
          if (!cancelled) setAudit(null);
        }
      } else {
        setAudit(null);
      }
    }).finally(() => {
      if (!cancelled) setContextLoading(false);
    });
    return () => { cancelled = true; };
  }, [claim?.voyageId]);

  async function handleStatusChange(nextStatus: string) {
    if (!claimId || !claim || nextStatus === claim.status) return;
    setStatusSaving(true);
    setStatusError(null);
    setSuccess(null);
    try {
      await updateBulkDispute(claimId, { status: nextStatus as ClaimStatus });
      await loadClaim();
      setSuccess(`Status updated to ${statusLabel(nextStatus)}.`);
    } catch (statusUpdateError: any) {
      setStatusError(statusUpdateError?.message ?? "Unable to update claim status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleResolutionSave() {
    if (!claimId || !claim) return;
    const amount = Number(settlementAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setStatusError("Enter a valid final settlement amount.");
      return;
    }
    if (!resolvedDate) {
      setStatusError("Enter a resolved date.");
      return;
    }
    setSettlementSaving(true);
    setStatusError(null);
    setSuccess(null);
    try {
      await updateBulkDispute(claimId, { status: "Resolved", finalSettlementAmount: amount, resolvedDate: new Date(resolvedDate).toISOString() });
      await loadClaim();
      setSuccess("Resolution saved.");
    } catch (resolutionError: any) {
      setStatusError(resolutionError?.message ?? "Unable to save claim resolution.");
    } finally {
      setSettlementSaving(false);
    }
  }

  if (!claimId) {
    return (
      <div style={{ backgroundColor: "#F9FAFB", minHeight: "100%" }}>
        <PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "Audit" }]} />
        <div className="p-6"><Section title="Claim audit unavailable"><p style={{ fontSize: "12px", color: "#64748B" }}>Open a persisted claim to review its supported basis. Counterparty comparison, notes, and dispute reports are not available in the current backend.</p></Section></div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ backgroundColor: "#F9FAFB", minHeight: "100%" }}><PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "Claim detail" }]} /><p className="p-6" style={{ fontSize: "12px", color: "#64748B" }}>Loading persisted claim...</p></div>;
  }

  if (error || !claim) {
    return <div style={{ backgroundColor: "#F9FAFB", minHeight: "100%" }}><PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "Claim detail" }]} /><div className="p-6"><div className="rounded-lg border p-4" style={{ borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", color: "#991B1B", fontSize: "12px" }}>{error ?? "Persisted claim not available."}</div></div></div>;
  }

  const snapshot = (calculation?.decisionSnapshot ?? null) as JsonRecord | null;
  const settlement = snapshot?.reversibleSettlement as JsonRecord | undefined;
  const authority = calculation?.settlementAuthorityStatus ?? settlement?.settlementStatus ?? null;
  const commencement = snapshot?.commencement?.commencedAt;
  const completion = snapshot?.cargoCompletion?.selectedTime ?? snapshot?.cargoCompletion?.eventTime ?? snapshot?.cargoCompletion?.completionTime;
  const operation = calculation?.operation ?? snapshot?.operationSelection?.voyageLaytimeOperation;
  const sourceDocuments = snapshot?.sofDocumentSelection?.includedDocumentIds;
  const warnings = calculation?.warnings ?? [];
  const counterpartyLinks = Array.isArray(voyageSummary?.voyage?.counterpartyLinks) ? voyageSummary.voyage.counterpartyLinks : [];
  const counterparties = counterpartyLinks.map((link: any) => `${displayValue(link?.role)}: ${displayValue(link?.counterparty?.name ?? link?.counterpartyName)}`);
  const currentStatus = claim.status ?? "Open";
  const statusOptions = currentStatus === "Resolved" ? CLAIM_STATUSES : CLAIM_STATUSES.filter((status) => status !== "Resolved");

  return (
    <div style={{ backgroundColor: "#F9FAFB", minHeight: "100%", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: claim.id }]} actions={onSaveForReview ? <button type="button" onClick={onSaveForReview} className="rounded-md border px-3 py-2" style={{ fontSize: "12px", color: "#374151", borderColor: "#D1D5DB", backgroundColor: "#FFFFFF" }}>Back to claims</button> : undefined} />
      <div className="flex items-center justify-between gap-3 flex-wrap border-b px-6 py-4" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
        <div><h1 style={{ fontSize: "17px", fontWeight: 600, color: "#111827" }}>Claim detail</h1><p className="mt-1" style={{ fontSize: "11px", color: "#64748B" }}>Persisted bulk-dispute record and supported backend context.</p></div>
        <label style={{ fontSize: "11px", color: "#64748B" }}>Status <select value={currentStatus} disabled={statusSaving} onChange={(event) => void handleStatusChange(event.target.value)} className="ml-2 rounded-md border px-2 py-2" style={{ borderColor: "#D1D5DB", fontSize: "12px", color: "#111827", backgroundColor: "#FFFFFF" }}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>
      {(statusError || success) && <div className="mx-6 mt-4 rounded-md border p-3" style={{ borderColor: statusError ? "#FCA5A5" : "#BBF7D0", backgroundColor: statusError ? "#FEF2F2" : "#F0FDF4", color: statusError ? "#991B1B" : "#166534", fontSize: "12px" }}>{statusError ?? success}</div>}

      <main className="grid gap-4 p-6 xl:grid-cols-2">
        <Section title="Claim basis">
          <div className="grid gap-2 sm:grid-cols-2">
            <Card label="Claim ID" value={displayValue(claim.id)} />
            <Card label="Voyage" value={displayValue(claim.voyageId)} />
            <Card label="Type" value={typeLabel(claim.type)} />
            <Card label="Claimed amount" value={formatMoney(claim.amountDisputed, claim.currency)} />
            <Card label="Currency" value={displayValue(claim.currency)} />
            <Card label="Status" value={statusLabel(claim.status)} />
            <Card label="Created" value={formatDate(claim.createdDate ?? claim.createdAt)} />
            <Card label="Final settlement" value={formatMoney(claim.finalSettlementAmount, claim.currency)} />
          </div>
        </Section>

        <Section title="Calculation context">
          {contextLoading && <p style={{ fontSize: "12px", color: "#64748B" }}>Loading persisted voyage and calculation context...</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Card label="Latest calculation version" value={displayValue(calculation?.version)} />
            <Card label="Calculation lifecycle" value={displayValue(calculation?.status)} />
            <Card label="Settlement authority" value={authorityLabel(authority)} />
            <Card label="Operation" value={displayValue(operation)} />
            <Card label="Allowed laytime" value={displayValue(calculation?.allowedLaytime)} />
            <Card label="Used laytime" value={displayValue(calculation?.usedLaytime)} />
            <Card label="Commencement" value={formatDate(commencement)} />
            <Card label="Completion" value={formatDate(completion)} />
          </div>
          <p className="mt-3 rounded-md border p-3" style={{ fontSize: "11px", color: "#92400E", borderColor: "#FCD34D", backgroundColor: "#FFFBEB", lineHeight: 1.45 }}>This claim record does not persist a source calculation ID or version. The values above are the latest persisted voyage calculation context, not a claim linkage invented by the client.</p>
          {authority !== "FINAL_AUTHORITATIVE" && <p className="mt-2 rounded-md border p-3" style={{ fontSize: "11px", color: "#991B1B", borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", lineHeight: 1.45 }}>The latest calculation is not final authoritative. This claim must not be treated as a final contractual claim basis.</p>}
        </Section>

        <Section title="Evidence summary">
          <div className="grid gap-2 sm:grid-cols-2">
            <Card label="Audit snapshot" value={audit?.auditAvailable ? "Available" : "Not available"} />
            <Card label="Calculation warnings" value={String(warnings.length)} />
            <Card label="Selected SOF documents" value={Array.isArray(sourceDocuments) ? String(sourceDocuments.length) : "Not available"} />
            <Card label="Commencement / completion evidence" value={snapshot?.commencement || snapshot?.cargoCompletion ? "Available" : "Not available"} />
          </div>
          {warnings.length > 0 && <div className="mt-3 rounded-md border p-3" style={{ borderColor: "#FCD34D", backgroundColor: "#FFFBEB", fontSize: "11px", color: "#92400E" }}><p style={{ fontWeight: 600 }}>Persisted calculation warnings</p><ul className="mt-1 list-disc pl-4">{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
          <a className="mt-3 inline-block" href={`/shipments/${encodeURIComponent(claim.voyageId)}/sof`} style={{ fontSize: "11px", color: "#1A4ED8" }}>Open shipment SOF and laytime workspace →</a>
        </Section>

        <Section title="Counterparty and dispute position">
          {counterparties.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{counterparties.map((value) => <Card key={value} label="Voyage counterparty" value={value} />)}</div> : <p style={{ fontSize: "12px", color: "#64748B" }}>Counterparty is not available in the persisted voyage context.</p>}
          <p className="mt-3 rounded-md border p-3" style={{ fontSize: "11px", color: "#64748B", borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", lineHeight: 1.45 }}>Counterparty amount, comparison, dispute notes, and position history are not persisted by the current claims backend.</p>
        </Section>

        <Section title="Resolution / settlement">
          {currentStatus === "Resolved" ? <p className="mb-3" style={{ fontSize: "11px", color: "#166534" }}>This claim is persisted as Resolved. Editing the fields below uses the backend resolution update.</p> : <p className="mb-3" style={{ fontSize: "11px", color: "#64748B" }}>Entering an amount alone does not resolve the claim. The backend status transition and resolution fields are submitted together.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label style={{ fontSize: "11px", color: "#475569" }}>Final settlement amount<input type="number" min="0" step="0.01" value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" style={{ borderColor: "#D1D5DB", fontSize: "12px" }} /></label>
            <label style={{ fontSize: "11px", color: "#475569" }}>Resolved date<input type="datetime-local" value={resolvedDate} onChange={(event) => setResolvedDate(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" style={{ borderColor: "#D1D5DB", fontSize: "12px" }} /></label>
          </div>
          <button type="button" onClick={() => void handleResolutionSave()} disabled={settlementSaving} className="mt-3 rounded-md px-3 py-2" style={{ fontSize: "12px", color: "#FFFFFF", backgroundColor: settlementSaving ? "#94A3B8" : "#1A4ED8", border: "none", cursor: settlementSaving ? "not-allowed" : "pointer" }}>{settlementSaving ? "Saving..." : currentStatus === "Resolved" ? "Save resolution" : "Resolve claim"}</button>
        </Section>

        <Section title="Unsupported workflow areas">
          <p style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.5 }}>The current backend does not provide persisted claim notes/comments, evidence attachments, counterparty positions, claim-to-calculation linkage, or a separate settlement entity/history. Those areas remain unavailable rather than being simulated in the client.</p>
        </Section>
      </main>
    </div>
  );
}
