import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Download, Edit3, ArrowUpRight, AlertTriangle, Upload } from "lucide-react";
import { PageHeader } from "./Layout";
import { RISK_LABEL, RISK_BADGE } from "./data/shipments";
import { useShipments } from "./data/ShipmentsContext";

type TabKey = "overview" | "sof" | "laytime" | "claims" | "documents";
type DotState = "done" | "active" | "warn" | "pending";

// ─── Clock sub-card ───────────────────────────────────────────────────────────

function ClockCard({ label, value, valueColor, sub, pct, barColor, startTime, startLabel, microRows }:
  {
    label: string; value: string; valueColor: string; sub: string;
    pct: number; barColor: string; startTime: string; startLabel: string;
    microRows: { k: string; v: string }[];
  }) {
  return (
    <div className="rounded-lg border flex flex-col gap-3 p-[12px_14px]"
      style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
      <div>
        <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
          {label}
        </p>
        <p style={{ fontSize: "20px", fontWeight: 500, color: valueColor, lineHeight: 1.15 }}>{value}</p>
        <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>{sub}</p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="rounded-full overflow-hidden mb-1.5" style={{ height: "8px", backgroundColor: "#F9FAFB" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "10px", color: "#9CA3AF" }}>Started {startTime}</span>
          <span style={{ fontSize: "10px", color: valueColor, fontWeight: 500 }}>{pct}% {startLabel}</span>
        </div>
      </div>

      {/* 2×2 micro KV grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5"
        style={{ borderTop: "0.5px solid #F3F4F6", paddingTop: "10px" }}>
        {microRows.map(({ k, v }) => (
          <div key={k}>
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "1px" }}>{k}</p>
            <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline dot ─────────────────────────────────────────────────────────────

const DOT: Record<DotState, { bg: string; border: string; dashed: boolean }> = {
  done:    { bg: "#10B981", border: "#10B981", dashed: false },
  active:  { bg: "#1A4ED8", border: "#1A4ED8", dashed: false },
  warn:    { bg: "#F59E0B", border: "#F59E0B", dashed: false },
  pending: { bg: "#ffffff", border: "#D1D5DB", dashed: true  },
};

function TimelineDot({ state }: { state: DotState }) {
  const d = DOT[state];
  return (
    <div className="absolute flex-shrink-0"
      style={{
        width: "10px", height: "10px", borderRadius: "50%",
        backgroundColor: d.bg,
        border: `1.5px ${d.dashed ? "dashed" : "solid"} ${d.border}`,
        left: "-5px", top: "3px",
      }} />
  );
}

function TagPill({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: bg, color: text }}>{label}</span>
  );
}

interface TimelineEvent {
  state: DotState;
  timestamp: string;
  name: string;
  detail: string;
  tags?: { label: string; bg: string; text: string }[];
}

function TimelineEvent({ ev, last }: { ev: TimelineEvent; last?: boolean }) {
  return (
    <div className="relative pl-5 pb-5" style={{ borderLeft: last ? "none" : "1px solid #E5E7EB" }}>
      <TimelineDot state={ev.state} />
      <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>{ev.timestamp}</p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{ev.name}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{ev.detail}</p>
      {ev.tags && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ev.tags.map((t) => <TagPill key={t.label} {...t} />)}
        </div>
      )}
    </div>
  );
}

// ─── Party row ────────────────────────────────────────────────────────────────

function PartyRow({ role, name, badge, badgeBg, badgeText, last }:
  { role: string; name: string; badge?: string; badgeBg?: string; badgeText?: string; last?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2"
      style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}>
      <div>
        <p style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{role}</p>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{name}</p>
      </div>
      {badge && (
        <span className="rounded-full px-2 py-0.5 font-medium"
          style={{ fontSize: "10px", backgroundColor: badgeBg, color: badgeText }}>{badge}</span>
      )}
    </div>
  );
}

// ─── KV row ───────────────────────────────────────────────────────────────────

function KVRow({ label, value, valueColor, large, noBorder }:
  { label: string; value: string; valueColor?: string; large?: boolean; noBorder?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: noBorder ? "none" : "0.5px solid #F3F4F6" }}>
      <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: large ? "14px" : "12px", color: valueColor ?? "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Timeline data ────────────────────────────────────────────────────────────

const timelineEvents: TimelineEvent[] = [
  {
    state: "done", timestamp: "23 Oct 08:00", name: "NOR tendered",
    detail: "Notice of Readiness presented at pilot station anchorage.",
  },
  {
    state: "done", timestamp: "23 Oct 14:00", name: "Laytime commences",
    detail: "6h NOR notice period expired. Supplier and receiver clocks started simultaneously.",
    tags: [
      { label: "Supplier clock starts", bg: "#EFF6FF", text: "#1E40AF" },
      { label: "Receiver clock starts", bg: "#EFF6FF", text: "#1E40AF" },
    ],
  },
  {
    state: "done", timestamp: "24 Oct 02:30", name: "Vessel berthed",
    detail: "All fast at berth. Hoses connected. Loading team on board.",
  },
  {
    state: "done", timestamp: "24 Oct 04:00", name: "Loading commenced",
    detail: "First pump started. Initial rate 11,800 MT/h.",
  },
  {
    state: "warn", timestamp: "24 Oct 11:20", name: "Rain squall — operations paused",
    detail: "Loading suspended due to weather. Terminal rain gauge threshold exceeded.",
    tags: [
      { label: "Deductible · 2h 00m", bg: "#F3F4F6", text: "#374151" },
    ],
  },
  {
    state: "done", timestamp: "24 Oct 13:20", name: "Loading resumed",
    detail: "Weather cleared. Operations resumed at full rate.",
  },
  {
    state: "active", timestamp: "25 Oct 05:10", name: "Loading ongoing",
    detail: "58h 20m laytime used of 72h allowed. Rate 12,100 MT/h. On track for completion ~25 Oct 14:00.",
    tags: [
      { label: "Watch: demurrage risk", bg: "#FED7D7", text: "#9B2C2C" },
    ],
  },
  {
    state: "pending", timestamp: "~25 Oct 14:30", name: "Loading complete — projected",
    detail: "Estimated completion based on current rate. SOF to be submitted within 12h of departure.",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ShipmentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { shipments, getShipmentById, updateShipment } = useShipments();
  const shipment = getShipmentById(id) ?? shipments[0];
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    vessel: shipment.vessel, port: shipment.port, supplier: shipment.supplier,
    receiver: shipment.receiver, eta: shipment.eta, cargo: shipment.cargo, quantity: shipment.quantity,
  });

  function startEdit() {
    setForm({
      vessel: shipment.vessel, port: shipment.port, supplier: shipment.supplier,
      receiver: shipment.receiver, eta: shipment.eta, cargo: shipment.cargo, quantity: shipment.quantity,
    });
    setIsEditing(true);
  }
  function saveEdit() {
    updateShipment(shipment.id, form);
    setIsEditing(false);
  }
  function cancelEdit() {
    setIsEditing(false);
  }

  const onOpenClaim = () => navigate("/claims/new");
  const onLaytimeCalc = () => navigate(`/shipments/${shipment.id}/sof`);
  const onSOFTab = () => navigate(`/shipments/${shipment.id}/sof`);

  const sectionTabs: { key: TabKey; label: string }[] = [
    { key: "overview",   label: "Overview" },
    { key: "sof",        label: "SOF timeline" },
    { key: "laytime",    label: "Laytime calc" },
    { key: "claims",     label: "Claims" },
    { key: "documents",  label: "Documents" },
  ];

  const badge = RISK_BADGE[shipment.risk];
  const metaParts = [
    shipment.id, shipment.port, `${shipment.supplier} → ${shipment.receiver}`, shipment.cargo, shipment.quantity, `ETA ${shipment.eta}`,
  ];

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Operations", to: "/" }, { label: "Shipment board", to: "/" }, { label: `${shipment.vessel} · ${shipment.id}` }]}
        actions={
          <>
            {isEditing ? (
              <>
                <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onClick={cancelEdit}>
                  Cancel
                </button>
                <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                  onClick={saveEdit}>
                  Save changes
                </button>
              </>
            ) : (
              <>
                <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onClick={startEdit}>
                  <Edit3 size={11} /> Edit
                </button>
                <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
                  <Download size={11} /> Export
                </button>
                <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                  onClick={onOpenClaim}>
                  Open claim <ArrowUpRight size={12} />
                </button>
              </>
            )}
          </>
        }
      />

      {/* ── Shipment header ── */}
      <div style={{ padding: "16px 24px", backgroundColor: "#ffffff", borderBottom: "0.5px solid #E5E7EB" }}>
        {/* Title row */}
        <div className="flex items-center gap-2.5 mb-2">
          {isEditing ? (
            <input
              value={form.vessel}
              onChange={(e) => setForm({ ...form, vessel: e.target.value })}
              style={{ fontSize: "18px", fontWeight: 500, color: "#111827", border: "0.5px solid #E5E7EB", borderRadius: "6px", padding: "2px 8px" }}
            />
          ) : (
            <h1 style={{ fontSize: "18px", fontWeight: 500, color: "#111827" }}>{shipment.vessel}</h1>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
            style={{ backgroundColor: badge.bg, color: badge.text, fontSize: "11px" }}>
            <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: badge.dot }} />
            {RISK_LABEL[shipment.risk]}
          </span>
        </div>
        {/* Meta row */}
        {isEditing ? (
          <div className="flex items-center flex-wrap gap-2">
            {([
              ["port", "Port"], ["supplier", "Supplier"], ["receiver", "Receiver"],
              ["cargo", "Cargo"], ["quantity", "Quantity"], ["eta", "ETA"],
            ] as [keyof typeof form, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5" style={{ fontSize: "11px", color: "#6B7280" }}>
                {label}
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={{ fontSize: "12px", color: "#111827", border: "0.5px solid #E5E7EB", borderRadius: "6px", padding: "2px 6px", width: key === "supplier" || key === "receiver" ? "110px" : "90px" }}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="flex items-center flex-wrap" style={{ gap: "10px" }}>
            {metaParts.map((part, i) => (
              <span key={i} className="flex items-center gap-2.5" style={{ fontSize: "12px", color: "#6B7280" }}>
                {part}
                {i < metaParts.length - 1 && (
                  <span className="rounded-full flex-shrink-0"
                    style={{ width: "3px", height: "3px", backgroundColor: "#D1D5DB" }} />
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI strip ── */}
      <div className="flex gap-3 flex-shrink-0" style={{ padding: "16px 24px 0", backgroundColor: "#ffffff" }}>
        {[
          { label: "Laytime used", value: "58h 20m", vc: "#1A4ED8", sub: "Of 72h allowed" },
          { label: "Remaining laytime", value: "13h 40m", vc: "#22543D", sub: "Net after deductions" },
          { label: "Current exposure", value: "$42,500", vc: "#B45309", sub: "Receiver clock basis" },
          { label: "Deductions applied", value: "4h 00m", vc: "#374151", sub: "2 qualifying events" },
        ].map(({ label, value, vc, sub }) => (
          <div key={label} className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px", marginBottom: "16px" }}>
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Section tabs ── */}
      <div className="flex items-stretch flex-shrink-0"
        style={{ borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff", paddingLeft: "24px" }}>
        {sectionTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === "sof") onSOFTab?.();
                if (tab.key === "laytime") onLaytimeCalc?.();
              }}
              className="relative px-4 py-3 cursor-pointer transition-colors"
              style={{ fontSize: "13px", fontWeight: isActive ? 500 : 400, color: isActive ? "#111827" : "#6B7280", background: "none", border: "none" }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#374151"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}>
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0"
                  style={{ height: "2px", backgroundColor: "#1A4ED8" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — Active laytime clocks */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Active laytime clocks
              </span>
              <span className="rounded-full px-2 py-0.5 font-semibold"
                style={{ fontSize: "10px", backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
                2 running
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ClockCard
                label="Supplier clock"
                value="58h 20m"
                valueColor="#B45309"
                sub="13h 40m remaining · 6h SHINC"
                pct={81}
                barColor="#F59E0B"
                startTime="23 Oct 14:00"
                startLabel="used"
                microRows={[
                  { k: "Dem rate", v: "$25,000/day" },
                  { k: "Dispatch rate", v: "$12,500/day" },
                  { k: "Laycan open", v: "23 Oct 2023" },
                  { k: "Laycan close", v: "27 Oct 2023" },
                ]}
              />
              <ClockCard
                label="Receiver clock"
                value="34h 00m"
                valueColor="#1A4ED8"
                sub="14h 00m remaining · SHINC"
                pct={71}
                barColor="#3B82F6"
                startTime="24 Oct 00:00"
                startLabel="used"
                microRows={[
                  { k: "Dem rate", v: "$22,000/day" },
                  { k: "Dispatch rate", v: "$11,000/day" },
                  { k: "Laycan open", v: "24 Oct 2023" },
                  { k: "Laycan close", v: "28 Oct 2023" },
                ]}
              />
            </div>
          </div>

          {/* Card 2 — Operations timeline */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-5">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Operations timeline
              </span>
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Oct 23–26, 2023</span>
            </div>
            <div className="pl-[10px]">
              {timelineEvents.map((ev, i) => (
                <TimelineEvent key={i} ev={ev} last={i === timelineEvents.length - 1} />
              ))}
            </div>
          </div>

          {/* Card 3 — Contractual parties */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <span className="block mb-1" style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Contractual parties
            </span>
            <PartyRow role="Supplier" name="Vitol Asia Pte. Ltd."
              badge="Active" badgeBg="#C6F6D5" badgeText="#22543D" />
            <PartyRow role="Receiver" name="PetroChina International"
              badge="Active" badgeBg="#C6F6D5" badgeText="#22543D" />
            <PartyRow role="Vessel owner" name="BW Offshore LNG Singapore"
              badge="Confirmed" badgeBg="#EFF6FF" badgeText="#1E40AF" />
            <PartyRow role="Port agent" name="GAC Singapore (Terminal 3)"
              badge="On site" badgeBg="#F3F4F6" badgeText="#374151" last />
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: "210px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Warning strip */}
          <div className="flex items-start gap-2.5 rounded-lg p-[10px_12px]"
            style={{ backgroundColor: "#FFFBEB", border: "0.5px solid #FDE68A", borderLeft: "2.5px solid #F59E0B" }}>
            <AlertTriangle size={13} style={{ color: "#B45309", flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontSize: "11px", color: "#7B341E", lineHeight: 1.4 }}>
              <strong style={{ fontWeight: 500 }}>Terminal congestion:</strong> Singapore Terminal 3 reporting +12h avg turnaround. Receiver clock impact likely.
            </p>
          </div>

          {/* Position summary */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Position summary
            </p>
            <KVRow label="Supplier net" value="–$8,200" valueColor="#B45309" />
            <KVRow label="Receiver net" value="+$4,500" valueColor="#22543D" />
            <KVRow label="Deductions" value="4h 00m" />
            <KVRow label="Clock mismatch" value="1h 20m" />
            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "8px 0" }} />
            <KVRow label="Total exposure" value="$42,500" valueColor="#C53030" large noBorder />
          </div>

          {/* Shipment details */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Shipment details
            </p>
            <KVRow label="Product" value="LNG" />
            <KVRow label="Quantity" value="65,000 MT" />
            <KVRow label="Load port" value="Sabine Pass TX" />
            <KVRow label="Discharge" value="Singapore T3" />
            <KVRow label="Voyage" value="VOY-2311" />
            <KVRow label="Status" value="Loading" valueColor="#1A4ED8" noBorder />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "38px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
              onClick={onOpenClaim}>
              Open claim <ArrowUpRight size={13} />
            </button>
            {[
              { label: "Full laytime calc ↗", icon: <ArrowUpRight size={11} />, action: onLaytimeCalc },
              { label: "Upload SOF", icon: <Upload size={11} />, action: undefined },
              { label: "Export summary", icon: <Download size={11} />, action: undefined },
            ].map(({ label, icon, action }) => (
              <button key={label} onClick={action}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
