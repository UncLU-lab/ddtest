import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Anchor, Download, RefreshCw,
  AlertTriangle, TrendingUp, Clock, Zap, CheckCircle, ArrowUpRight,
} from "lucide-react";
import { useShipments, estimateRisk } from "./data/ShipmentsContext";
import { Shipment, RISK_LABEL, RISK_BADGE } from "./data/shipments";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scenario = "optimistic" | "likely" | "pessimistic";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionEyebrow({ label, badge, badgeStyle }: { label: string; badge?: string; badgeStyle?: React.CSSProperties }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      {badge && (
        <span className="rounded-full px-2 py-0.5 font-semibold" style={{ fontSize: "10px", ...badgeStyle }}>{badge}</span>
      )}
    </div>
  );
}

// ─── Scenario Card ────────────────────────────────────────────────────────────

const scenarioConfig = {
  optimistic: { label: "Optimistic", eta: "Oct 24, 18:00", etaColor: "#22543D", prob: "22%", risk: "safe", riskLabel: "Safe", riskBg: "#C6F6D5", riskText: "#22543D" },
  likely:     { label: "Most likely", eta: "Oct 25, 14:30", etaColor: "#B45309", prob: "61%", risk: "elevated", riskLabel: "Elevated", riskBg: "#FEEBC8", riskText: "#7B341E" },
  pessimistic:{ label: "Pessimistic", eta: "Oct 27, 08:00", etaColor: "#C53030", prob: "17%", risk: "breach", riskLabel: "Breach risk", riskBg: "#FED7D7", riskText: "#9B2C2C" },
};

function ScenarioCard({ variant, active, onClick }: { variant: Scenario; active: boolean; onClick: () => void }) {
  const c = scenarioConfig[variant];
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 text-left cursor-pointer transition-colors rounded-lg p-[11px_13px]"
      style={{
        border: `0.5px solid ${active ? "#1A4ED8" : "#E5E7EB"}`,
        backgroundColor: active ? "#EFF6FF" : "#ffffff",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff"; }}
    >
      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.label}</span>
      <span style={{ fontSize: "14px", fontWeight: 500, color: c.etaColor }}>{c.eta}</span>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{c.prob} probability</span>
        <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ fontSize: "10px", backgroundColor: c.riskBg, color: c.riskText }}>{c.riskLabel}</span>
      </div>
    </button>
  );
}

// ─── Laycan Timeline Bar ──────────────────────────────────────────────────────

function LaycanBar({
  label,
  segments,
  etaPos,
  dates,
}: {
  label: string;
  segments: { pct: number; color: string }[];
  etaPos: number; // 0–100
  dates: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: "11px", color: "#6B7280", width: "90px", flexShrink: 0 }}>{label}</span>
        <div
          className="relative flex-1 rounded overflow-hidden"
          style={{ height: "28px", backgroundColor: "#F9FAFB" }}
        >
          <div className="flex h-full">
            {segments.map((s, i) => (
              <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
            ))}
          </div>
          {/* ETA marker */}
          <div
            className="absolute top-0 bottom-0"
            style={{ left: `${etaPos}%`, width: "2px", backgroundColor: "#1A4ED8" }}
          />
          {/* ETA label on marker */}
          <div
            className="absolute top-0 bottom-0 flex items-center"
            style={{ left: `${etaPos + 1}%` }}
          >
            <span style={{ fontSize: "9px", color: "#1A4ED8", fontWeight: 500, whiteSpace: "nowrap" }}>ETA</span>
          </div>
        </div>
      </div>
      {/* Date axis */}
      <div className="flex ml-[calc(90px+8px)]">
        {dates.map((d, i) => (
          <span
            key={i}
            style={{
              fontSize: "9px",
              color: "#9CA3AF",
              flex: 1,
              textAlign: i === 0 ? "left" : i === dates.length - 1 ? "right" : "center",
            }}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Flag Row ────────────────────────────────────────────────────────────────

type FlagState = "danger" | "warn" | "info" | "success";

const flagConfig: Record<FlagState, { bg: string; iconBg: string; titleColor: string; valueColor: string; icon: React.ReactNode }> = {
  danger:  { bg: "#FFF5F5", iconBg: "#FED7D7", titleColor: "#9B2C2C", valueColor: "#C53030", icon: <AlertTriangle size={14} color="#C53030" /> },
  warn:    { bg: "#FFFBEB", iconBg: "#FEEBC8", titleColor: "#7B341E", valueColor: "#B45309", icon: <Clock size={14} color="#B45309" /> },
  info:    { bg: "#EFF6FF", iconBg: "#BFDBFE", titleColor: "#1E40AF", valueColor: "#1A4ED8", icon: <TrendingUp size={14} color="#1A4ED8" /> },
  success: { bg: "#F0FFF4", iconBg: "#C6F6D5", titleColor: "#22543D", valueColor: "#276749", icon: <CheckCircle size={14} color="#276749" /> },
};

function FlagRow({ state, title, desc, value }: { state: FlagState; title: string; desc: string; value: string }) {
  const c = flagConfig[state];
  return (
    <div className="flex items-start gap-3 rounded-lg p-[10px_12px]" style={{ backgroundColor: c.bg }}>
      <div
        className="flex items-center justify-center rounded-md flex-shrink-0"
        style={{ width: "28px", height: "28px", backgroundColor: c.iconBg }}
      >
        {c.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: "12px", fontWeight: 500, color: c.titleColor, marginBottom: "2px" }}>{title}</p>
        <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4, marginBottom: "4px" }}>{desc}</p>
        <p style={{ fontSize: "12px", fontWeight: 500, color: c.valueColor }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Exposure Sub-card ────────────────────────────────────────────────────────

function ExposureCard({
  label, value, valueColor, sub, highlight,
}: {
  label: string; value: string; valueColor: string; sub: string; highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg p-[10px_12px]"
      style={{
        border: `0.5px solid ${highlight ? "#1A4ED8" : "#E5E7EB"}`,
        backgroundColor: highlight ? "#EFF6FF" : "#ffffff",
      }}
    >
      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "16px", fontWeight: 500, color: valueColor }}>{value}</span>
      <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{sub}</span>
    </div>
  );
}

// ─── Recommendation Item ──────────────────────────────────────────────────────

function RecItem({ action, rationale }: { action: string; rationale: string }) {
  return (
    <div className="rounded-lg p-[9px_11px]" style={{ backgroundColor: "#F9FAFB" }}>
      <p style={{ fontSize: "11px", lineHeight: 1.5, color: "#374151" }}>
        <strong style={{ color: "#111827", fontWeight: 500 }}>{action}</strong>{" "}
        <span style={{ color: "#6B7280" }}>{rationale}</span>
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PreOpsRiskEngine() {
  const navigate = useNavigate();
  const { draft, addShipment, clearDraft } = useShipments();
  const { risk, exposure } = estimateRisk(draft);
  const badge = RISK_BADGE[risk];

  const onProceed = () => {
    const newShipment: Shipment = {
      id: draft.voyageRef || `VOY-${Math.floor(1000 + Math.random() * 9000)}`,
      vessel: draft.vessel,
      port: draft.dischargePort,
      supplier: draft.supplier,
      receiver: draft.receiver,
      eta: draft.eta,
      risk,
      exposure,
      cargo: draft.productType,
      quantity: draft.quantity ? `${Number(draft.quantity).toLocaleString()} MT` : "—",
    };
    addShipment(newShipment);
    clearDraft();
    navigate(`/shipments/${newShipment.id}`);
  };
  const onBackToShipment = () => navigate("/shipments/new");

  function exportRiskReport() {
    const lines = [
      `Pre-ops risk report — ${draft.vessel || "New vessel"} (${draft.voyageRef || "unassigned ref"})`,
      `Route: ${draft.loadPort || "—"} → ${draft.dischargePort || "—"}`,
      `Laycan window: ${draft.laycanOpen || "—"} – ${draft.laycanClose || "—"}`,
      `ETA: ${draft.eta || "—"}`,
      `Scenario: ${activeScenario}`,
      `Risk level: ${RISK_LABEL[risk]}`,
      `Estimated exposure: $${exposure.toLocaleString()}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre-ops-risk-report-${draft.voyageRef || "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const [activeScenario, setActiveScenario] = useState<Scenario>("likely");

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Wizard nav (focused flow — no persistent app nav) ── */}
      <nav className="flex items-center justify-between px-6 flex-shrink-0"
        style={{ height: "56px", backgroundColor: "#ffffff", borderBottom: "0.5px solid #E5E7EB" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: "30px", height: "30px", backgroundColor: "#1A4ED8" }}>
            <Anchor size={15} color="#ffffff" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "#111827" }}>Demurrage Defender</span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Operations Command</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5" style={{ fontSize: "13px" }}>
          <span style={{ color: "#6B7280", cursor: "pointer" }} onClick={onBackToShipment}>New shipment</span>
          <span style={{ color: "#D1D5DB" }}>/</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>Pre-ops risk check</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBackToShipment} className="px-3 py-1.5 rounded-md border transition-colors"
            style={{ fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            Back
          </button>
          <button onClick={onProceed} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            style={{ fontSize: "13px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}>
            Initialise shipment <ArrowUpRight size={12} />
          </button>
        </div>
      </nav>

      {/* ── Page Header ── */}
      <div
        className="flex items-start justify-between flex-shrink-0"
        style={{ padding: "16px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Pre-ops risk engine</h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
              style={{ backgroundColor: badge.bg, color: badge.text, fontSize: "11px" }}
            >
              <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: badge.dot }} />
              {RISK_LABEL[risk]}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            {draft.vessel || "New vessel"} · {draft.voyageRef || "unassigned ref"} · {draft.dischargePort || "discharge port TBD"} terminal &nbsp;·&nbsp; Laycan window: {draft.laycanOpen || "—"} – {draft.laycanClose || "—"} &nbsp;·&nbsp; ETA: {draft.eta || "—"}
          </p>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left Column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — ETA scenario modelling */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionEyebrow
              label="ETA scenario modelling"
              badge="3 scenarios"
              badgeStyle={{ backgroundColor: "#EFF6FF", color: "#1E40AF" }}
            />

            {/* Scenario sub-cards */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {(["optimistic", "likely", "pessimistic"] as Scenario[]).map((v) => (
                <ScenarioCard
                  key={v}
                  variant={v}
                  active={activeScenario === v}
                  onClick={() => setActiveScenario(v)}
                />
              ))}
            </div>

            {/* Laycan bars */}
            <div className="flex flex-col gap-3">
              <LaycanBar
                label="Supplier laycan"
                segments={[
                  { pct: 28, color: "#F3F4F6" },
                  { pct: 30, color: "#C6F6D5" },
                  { pct: 14, color: "#FEEBC8" },
                  { pct: 28, color: "#FED7D7" },
                ]}
                etaPos={52}
                dates={["Oct 20", "Oct 23", "Oct 25", "Oct 27", "Oct 30"]}
              />
              <LaycanBar
                label="Receiver laycan"
                segments={[
                  { pct: 33, color: "#F3F4F6" },
                  { pct: 28, color: "#C6F6D5" },
                  { pct: 16, color: "#FEEBC8" },
                  { pct: 23, color: "#FED7D7" },
                ]}
                etaPos={52}
                dates={["Oct 20", "Oct 24", "Oct 26", "Oct 28", "Oct 30"]}
              />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4">
              {[
                { color: "#C6F6D5", label: "Inside laycan" },
                { color: "#FEEBC8", label: "Marginal" },
                { color: "#FED7D7", label: "Outside laycan" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="rounded-sm flex-shrink-0" style={{ width: "8px", height: "8px", backgroundColor: item.color }} />
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div style={{ width: "2px", height: "10px", backgroundColor: "#1A4ED8", borderRadius: "1px" }} />
                <span style={{ fontSize: "11px", color: "#6B7280" }}>ETA marker</span>
              </div>
            </div>
          </div>

          {/* Card 2 — Risk & opportunity flags */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionEyebrow
              label="Risk & opportunity flags"
              badge="3 critical"
              badgeStyle={{ backgroundColor: "#FED7D7", color: "#9B2C2C" }}
            />
            <div className="flex flex-col gap-2">
              <FlagRow
                state="danger"
                title="Receiver laycan conflict"
                desc="Vessel ETA under most-likely scenario falls 18h outside receiver laycan close. High demurrage probability if speed not increased."
                value="Est. demurrage: $26,000 (1.04 days × $25,000/day)"
              />
              <FlagRow
                state="warn"
                title="Port congestion — Singapore Terminal 3"
                desc="Average turnaround extended by 12h over last 14 days. Compounds ETA risk for receiver clock."
                value="Laycan slip risk: +8–14h additional delay"
              />
              <FlagRow
                state="info"
                title="Speed optimisation window"
                desc="Increasing speed to 16.5kts closes the ETA gap by ~10h. Fuel cost delta estimated at $4,200."
                value="Net opportunity: –$21,800 exposure reduction"
              />
              <FlagRow
                state="success"
                title="Supplier laycan — comfortable"
                desc="ETA in optimistic and most-likely scenarios falls within supplier window. No breach risk on supply side."
                value="Supplier clock: no demurrage exposure"
              />
            </div>
          </div>

          {/* Card 3 — Exposure forecast by scenario */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionEyebrow
              label="Exposure forecast by scenario"
              badge={undefined}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <ExposureCard label="Optimistic" value="$0" valueColor="#22543D" sub="No demurrage. $4,500 dispatch credit" />
              <ExposureCard label="Most likely" value="$26,000" valueColor="#B45309" sub="1.04 days demurrage at $25,000/day" highlight />
              <ExposureCard label="Pessimistic" value="$112,500" valueColor="#C53030" sub="4.5 days · compounded by port delay" />
              <ExposureCard label="Expected value" value="$38,100" valueColor="#374151" sub="Probability-weighted across scenarios" />
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: "210px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Component 1 — Vessel inputs */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <p className="mb-3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Vessel inputs
            </p>
            {[
              { k: "Current speed", v: "14.2 kts" },
              { k: "Position", v: "7.4°N, 114.8°E" },
              { k: "Distance rem.", v: "1,240 nm" },
              { k: "ETA range", v: "Oct 24–27" },
            ].map(({ k, v }) => (
              <div key={k} className="flex items-center justify-between" style={{ marginBottom: "7px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{k}</span>
                <span style={{ fontSize: "12px", color: "#111827" }}>{v}</span>
              </div>
            ))}

            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0" }} />

            {[
              { k: "Supplier laycan", v: "Oct 23–27" },
              { k: "Receiver laycan", v: "Oct 24–28" },
              { k: "Dem. rate (S)", v: "$25,000/day" },
              { k: "Dem. rate (R)", v: "$22,000/day" },
            ].map(({ k, v }) => (
              <div key={k} className="flex items-center justify-between" style={{ marginBottom: "7px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{k}</span>
                <span style={{ fontSize: "12px", color: "#111827" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Component 2 — Recommendations */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <p className="mb-2.5" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recommendations
            </p>
            <div className="flex flex-col gap-2">
              <RecItem
                action="Increase speed to 16.5 kts."
                rationale="Closes ETA gap by ~10h — brings most-likely scenario inside laycan. Fuel delta $4,200."
              />
              <RecItem
                action="Issue NOR on arrival, not on berth."
                rationale="Triggers laytime start immediately. Reduces receiver clock exposure if congestion delays berthing."
              />
              <RecItem
                action="Notify receiver of delay risk."
                rationale="Proactive notice preserves goodwill and may unlock a layday extension without formal protest."
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onProceed}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "38px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
            >
              Go to ops timeline
              <ArrowUpRight size={13} />
            </button>
            <button
              onClick={exportRiskReport}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
            >
              <Download size={12} />
              Export risk report
            </button>
            <button
              className="w-full flex items-center justify-center rounded-lg border transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", color: "#6B7280", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
              onClick={onBackToShipment}
            >
              Back to shipment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
