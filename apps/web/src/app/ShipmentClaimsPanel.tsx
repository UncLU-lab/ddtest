import { useCallback, useEffect, useState } from "react";
import { getBulkDisputes, type BulkDispute } from "../lib/api";
import ClaimCreatePanel from "./ClaimCreatePanel";

type Props = {
  voyageId: string;
  onOpenClaim: (claimId: string) => void;
};

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

function formatDate(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function typeLabel(type?: string) {
  if (type === "demurrage_counter") return "Demurrage counterclaim";
  if (type === "despatch_claim") return "Despatch claim";
  return type || "Not available";
}

export default function ShipmentClaimsPanel({ voyageId, onOpenClaim }: Props) {
  const [claims, setClaims] = useState<BulkDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getBulkDisputes({ voyageId, page: 1, limit: 200 });
      setClaims(result.data ?? []);
    } catch (loadError: any) {
      setClaims([]);
      setError(loadError?.message ?? "Unable to load persisted claims for this voyage.");
    } finally {
      setIsLoading(false);
    }
  }, [voyageId]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  return (
    <div className="flex-1 min-w-0" style={{ padding: "16px 24px" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 style={{ fontSize: "16px", color: "#111827", fontWeight: 600 }}>Claims for this voyage</h2>
          <p className="mt-1" style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.45 }}>
            Persisted bulk-dispute records linked to voyage {voyageId}. Calculation-version, operation, counterparty-position, notes, and evidence links are not stored on this backend claim record.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="rounded-md px-3 py-2" style={{ fontSize: "12px", color: "#FFFFFF", backgroundColor: "#1A4ED8", border: "none", cursor: "pointer" }}>
          {showCreate ? "Close create claim" : "Create claim"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4">
          <ClaimCreatePanel
            initialVoyageId={voyageId}
            onCancel={() => setShowCreate(false)}
            onCreated={(claim) => {
              setShowCreate(false);
              void loadClaims();
              onOpenClaim(claim.id);
            }}
          />
        </div>
      )}

      {isLoading && <div className="rounded-xl border p-5" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF", fontSize: "12px", color: "#64748B" }}>Loading persisted claims...</div>}
      {error && <div className="rounded-xl border p-5" style={{ borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", fontSize: "12px", color: "#991B1B" }}>{error}</div>}

      {!isLoading && !error && claims.length === 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
          <p style={{ fontSize: "13px", color: "#111827", fontWeight: 600 }}>No persisted claims for this voyage</p>
          <p className="mt-1" style={{ fontSize: "12px", color: "#64748B" }}>Create a claim only after the backend exposes an eligible authoritative settlement.</p>
        </div>
      )}

      {!isLoading && !error && claims.length > 0 && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
          <table className="w-full" style={{ minWidth: "760px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                {["Claim", "Type", "Status", "Amount", "Currency", "Created", "Resolution"].map((label) => (
                  <th key={label} className="px-3 py-2.5 text-left" style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, index) => (
                <tr key={claim.id} onClick={() => onOpenClaim(claim.id)} className="cursor-pointer" style={{ borderBottom: index < claims.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#1A4ED8", fontWeight: 600 }}>{claim.id}</td>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#374151" }}>{typeLabel(claim.type)}</td>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#374151" }}>{claim.status ?? "Not available"}</td>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{formatMoney(claim.amountDisputed, claim.currency)}</td>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#64748B" }}>{claim.currency ?? "Not available"}</td>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#64748B" }}>{formatDate(claim.createdDate ?? claim.createdAt)}</td>
                  <td className="px-3 py-3" style={{ fontSize: "12px", color: "#64748B" }}>{claim.finalSettlementAmount === null || claim.finalSettlementAmount === undefined ? "Not resolved" : formatMoney(claim.finalSettlementAmount, claim.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
