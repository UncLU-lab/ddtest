import { useState } from "react";
import { useNavigate } from "react-router";
import { Filter, Download, Plus } from "lucide-react";
import { RiskLevel } from "./data/shipments";
import { useShipments } from "./data/ShipmentsContext";

// ─── Sub-components ────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    critical: { bg: "#FED7D7", text: "#9B2C2C", dot: "#C53030", label: "Critical" },
    elevated: { bg: "#FEEBC8", text: "#7B341E", dot: "#C05621", label: "Elevated" },
    optimal: { bg: "#C6F6D5", text: "#22543D", dot: "#276749", label: "Optimal" },
  }[level];

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: config.bg, color: config.text, fontSize: "11px" }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  );
}

function ExposureValue({ amount }: { amount: number }) {
  if (amount === 0) return <span style={{ color: "#6B7280", fontSize: "13px" }} className="font-medium">$0</span>;
  if (amount < 0) return <span style={{ color: "#22543D", fontSize: "13px" }} className="font-medium">–${Math.abs(amount).toLocaleString()} dispatch</span>;
  return <span style={{ color: "#C53030", fontSize: "13px" }} className="font-medium">${amount.toLocaleString()}</span>;
}

function RiskBar({ level }: { level: RiskLevel }) {
  const colors: Record<RiskLevel, string> = { critical: "#EF4444", elevated: "#F59E0B", optimal: "#10B981" };
  return <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l" style={{ backgroundColor: colors[level] }} />;
}

function KpiCard({ label, value, valueColor, sub, subColor }: { label: string; value: string; valueColor?: string; sub: string; subColor?: string }) {
  return (
    <div className="flex-1 rounded-lg border p-[14px_16px] flex flex-col gap-1" style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
      <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 500, color: valueColor || "#111827", lineHeight: 1.2 }}>{value}</p>
      <p style={{ fontSize: "11px", color: subColor || "#6B7280" }}>{sub}</p>
    </div>
  );
}

function formatEta(value?: string | null) {
  if (!value) {
    return "—";
  }

  if (String(value).trim().toUpperCase() === "TBD") {
    return "TBD";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

export function formatCreatedAt(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `Created ${date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export function sortShipmentsByCreatedAt<T extends { createdAt?: string; voyageRef?: string }>(shipments: T[]): T[] {
  const creationTime = (value?: string) => {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  };

  return [...shipments].sort((left, right) => {
    const newestFirst = creationTime(right.createdAt) - creationTime(left.createdAt);
    if (newestFirst !== 0) return newestFirst;

    return String(right.voyageRef ?? "").localeCompare(String(left.voyageRef ?? ""));
  });
}

function AlertCard({ borderColor, typeColor, type, subject, desc, time, onNavigate }: {
  borderColor: string;
  typeColor: string;
  type: string;
  subject: string;
  desc: string;
  time: string;
  onNavigate?: () => void;
}) {
  return (
    <div
      onClick={onNavigate}
      className="relative rounded-lg border pl-3 pr-3 py-[10px] cursor-pointer transition-colors"
      style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", borderLeftColor: borderColor, borderLeftWidth: "2px", backgroundColor: "#ffffff" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
    >
      <p className="uppercase font-semibold mb-0.5" style={{ fontSize: "10px", color: typeColor, letterSpacing: "0.05em" }}>{type}</p>
      <p className="font-medium mb-0.5" style={{ fontSize: "12px", color: "#111827" }}>{subject}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
      <p className="mt-1" style={{ fontSize: "10px", color: "#9CA3AF" }}>{time}</p>
    </div>
  );
}

// --- Main ---------------------------------------------------------------------

export default function Operations() {
  const navigate = useNavigate();
  const { shipments } = useShipments();
  const activeShipments = shipments.length;
  const liveAlerts: Array<{
    id: string;
    shipmentId: string;
    borderColor: string;
    typeColor: string;
    type: string;
    subject: string;
    desc: string;
    time: string;
  }> = [];

const netExposure = shipments.reduce(
  (total, shipment) => total + Math.max(0, shipment.exposure),
  0
);

const exposureShipments = shipments.filter(
  (shipment) => shipment.exposure > 0
).length;

const shipmentsAtRisk = shipments.filter(
  (shipment) => shipment.risk === "critical"
).length;

const claimsPending = shipments.reduce((total, s) => total + (Number(s.openDisputeCount) || 0), 0);
const amountUnderDispute = shipments.reduce((total, s) => total + (Number(s.amountUnderDispute) || 0), 0);
  const [showFilters, setShowFilters] = useState(false);
  const [riskFilter, setRiskFilter] = useState<Set<RiskLevel>>(new Set(["critical", "elevated", "optimal"]));
  const [portFilter, setPortFilter] = useState("All ports");

  const ports = ["All ports", ...Array.from(new Set(shipments.map((s) => s.port)))];

  const filteredShipments = sortShipmentsByCreatedAt(
    shipments.filter((s) => riskFilter.has(s.risk) && (portFilter === "All ports" || s.port === portFilter))
  );

  function toggleRisk(level: RiskLevel) {
    setRiskFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      return next;
    });
  }

  function exportCsv() {
    const header = ["Vessel", "Voyage", "Port", "Supplier", "Receiver", "ETA", "Risk", "Exposure"];
    const rows = filteredShipments.map((s) => [s.vessel, s.voyageRef ?? s.id, s.port, s.supplier, s.receiver, s.eta, s.risk, String(s.exposure)]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shipment-operations-board.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-6">
      {/* ── KPI Strip ── */}
      <div className="flex gap-4 mt-6">
  <KpiCard
    label="Active shipments"
    value={String(activeShipments)}
    sub="Currently tracked"
  />

  <KpiCard
    label="Net demurrage exposure"
    value={`$${netExposure.toLocaleString()}`}
    valueColor={netExposure > 0 ? "#C53030" : "#111827"}
    sub={`${exposureShipments} with exposure`}
  />

  <KpiCard
    label="Claims pending"
    value={String(claimsPending)}
    valueColor="#B45309"
    sub={`$${amountUnderDispute.toLocaleString()} under dispute`}
  />

  <KpiCard
    label="Shipments at risk"
    value={String(shipmentsAtRisk).padStart(2, "0")}
    valueColor={shipmentsAtRisk > 0 ? "#C53030" : "#111827"}
    sub="Critical attention required"
    subColor={shipmentsAtRisk > 0 ? "#C53030" : "#6B7280"}
  />
</div>

      {/* ── Main Two-Column Grid ── */}
      <div className="mt-5 flex gap-4">
        {/* ── Left: Operations Board ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 400 }}>
              Shipment operations board
            </span>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors cursor-pointer"
                style={{ fontSize: "13px", color: showFilters ? "#1A4ED8" : "#374151", borderColor: showFilters ? "#1A4ED8" : "#E5E7EB", borderWidth: "0.5px", backgroundColor: showFilters ? "#EFF6FF" : "#ffffff" }}
              >
                <Filter size={12} /> Filter{riskFilter.size < 3 || portFilter !== "All ports" ? ` (${filteredShipments.length})` : ""}
              </button>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors cursor-pointer"
                style={{ fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              >
                <Download size={12} /> Export
              </button>
              <button
                onClick={() => navigate("/shipments/new")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
                style={{ fontSize: "13px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
              >
                <Plus size={12} /> New shipment
              </button>

              {showFilters && (
                <div
                  className="absolute right-0 rounded-lg border p-3 z-10"
                  style={{ top: "calc(100% + 6px)", width: "220px", backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                >
                  <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Laycan risk</p>
                  <div className="flex flex-col gap-1.5 mb-3">
                    {(["critical", "elevated", "optimal"] as RiskLevel[]).map((level) => (
                      <label key={level} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: "12px", color: "#374151" }}>
                        <input type="checkbox" checked={riskFilter.has(level)} onChange={() => toggleRisk(level)} />
                        {level[0].toUpperCase() + level.slice(1)}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Port</p>
                  <select
                    value={portFilter}
                    onChange={(e) => setPortFilter(e.target.value)}
                    className="w-full outline-none cursor-pointer"
                    style={{ height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "6px", padding: "0 8px", fontSize: "12px", color: "#374151" }}
                  >
                    {ports.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="grid" style={{ gridTemplateColumns: "3fr 1fr 1.4fr 1.4fr 1.1fr 1fr 1fr", padding: "10px 16px", borderBottom: "0.5px solid #E5E7EB" }}>
              {["Vessel", "Port", "Supplier", "Receiver", "ETA", "Laycan risk", "Exposure"].map((h) => (
                <span key={h} style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>

            {filteredShipments.length === 0 && (
              <p style={{ fontSize: "12px", color: "#9CA3AF", padding: "16px 20px" }}>No shipments match your filters.</p>
            )}
            {filteredShipments.map((s, i) => (
              <div
                key={s.id}
                onClick={() => navigate(`/shipments/${s.id}`)}
                className="relative grid items-center cursor-pointer transition-colors"
                style={{ gridTemplateColumns: "3fr 1fr 1.4fr 1.4fr 1.1fr 1fr 1fr", padding: "12px 16px 12px 20px", borderBottom: i < filteredShipments.length - 1 ? "0.5px solid #E5E7EB" : "none", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
              >
                <RiskBar level={s.risk} />
                <div className="flex flex-col gap-0.5 pr-3">
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{s.vessel}</span>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "#1A4ED8" }}>{s.voyageRef ?? "Voyage reference unavailable"}</span>
                  {formatCreatedAt(s.createdAt) && (
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>{formatCreatedAt(s.createdAt)}</span>
                  )}
                  {/* The UUID remains the routing identifier but is not a board label. */}
                  {/*
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>{s.port} · {s.id}</span>
                  */}
                </div>
                <span style={{ fontSize: "13px", color: "#374151" }}>{s.port}</span>
                <span style={{ fontSize: "13px", color: "#374151" }}>{s.supplier}</span>
                <span style={{ fontSize: "13px", color: "#374151" }}>{s.receiver}</span>
                <span style={{ fontSize: "13px", color: "#374151" }}>{formatEta(s.eta)}</span>
                <RiskBadge level={s.risk} />
                <ExposureValue amount={s.exposure} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Alerts Panel ── */}
        <div style={{ width: "240px", flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Alerts
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-semibold"
              role="status"
              aria-live="polite"
              style={{ fontSize: "11px", backgroundColor: "#F3F4F6", color: "#374151" }}
            >
              {liveAlerts.length} live
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {liveAlerts.length === 0 ? (
              <div
                className="rounded-lg border px-3 py-[10px]"
                role="status"
                aria-live="polite"
                style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              >
                <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>
                  No live operational alerts.
                </p>
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
                  Alerts will appear here when live operational conditions are available.
                </p>
              </div>
            ) : (
              liveAlerts.map((a) => (
                <AlertCard key={a.id} {...a} onNavigate={() => navigate(`/shipments/${a.shipmentId}`)} />
              ))
            )}
          </div>
        </div>
      </div>
      {/* -- Laytime Visualiser -- */}
      <div className="mt-5 mb-6">
        <span className="block mb-3" style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Vessel laytime visualiser
        </span>
        <div className="rounded-xl border p-[14px_16px]" style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
          <div
            className="rounded-lg border px-3 py-[10px]"
            role="status"
            aria-live="polite"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#F9FAFB" }}
          >
            <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>
              No laytime visualisation data available.
            </p>
            <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
              Laytime data will appear here when persisted calculations are available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
