import { useState } from "react";
import { useParams } from "react-router";
import {
  Plus, ArrowUpRight,
  FileText, Eye, RefreshCw, AlertTriangle, Edit2,
} from "lucide-react";
import { PageHeader } from "./Layout";
import { useShipments } from "./data/ShipmentsContext";

type EventState = "normal" | "deductible" | "pending";

// ─── Data ─────────────────────────────────────────────────────────────────────

const initialEvents: {
  n: string;
  state: EventState;
  timestamp: string;
  name: string;
  detail: string;
  tag: string;
  tagBg: string;
  tagText: string;
  duration: string;
  cause: string;
  causeActive: boolean;
}[] = [
  {
    n: "01", state: "normal", timestamp: "23 Oct 08:00", name: "NOR tendered",
    detail: "Notice of Readiness presented at pilot station",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "—", cause: "Vessel", causeActive: true,
  },
  {
    n: "02", state: "normal", timestamp: "23 Oct 14:30", name: "Laytime commences",
    detail: "6h NOR notice period expired — clock starts",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "6h 30m", cause: "Vessel", causeActive: true,
  },
  {
    n: "03", state: "normal", timestamp: "24 Oct 02:15", name: "Berthing completed",
    detail: "Fast at berth. All fast 02:15 LT",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "11h 45m", cause: "Terminal", causeActive: false,
  },
  {
    n: "04", state: "normal", timestamp: "24 Oct 04:00", name: "Loading commenced",
    detail: "First hose connected. Pumps started",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "1h 45m", cause: "Vessel", causeActive: true,
  },
  {
    n: "05", state: "deductible", timestamp: "24 Oct 11:20", name: "Rain squall — operations suspended",
    detail: "Operations halted due to adverse weather conditions",
    tag: "Deductible", tagBg: "#F3F4F6", tagText: "#374151",
    duration: "2h 30m", cause: "Weather", causeActive: true,
  },
  {
    n: "06", state: "normal", timestamp: "24 Oct 13:50", name: "Loading resumed",
    detail: "Weather cleared. Pumps restarted. Rate 12,000 MT/h",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "—", cause: "Vessel", causeActive: true,
  },
  {
    n: "07", state: "deductible", timestamp: "25 Oct 03:40", name: "Terminal breakdown — arm fault",
    detail: "Loading arm hydraulics failed. Terminal responsibility",
    tag: "Deductible", tagBg: "#F3F4F6", tagText: "#374151",
    duration: "1h 30m", cause: "Terminal", causeActive: true,
  },
  {
    n: "08", state: "normal", timestamp: "25 Oct 05:10", name: "Loading resumed",
    detail: "Arm repaired. Loading recommenced at reduced rate",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "—", cause: "Terminal", causeActive: false,
  },
  {
    n: "09", state: "normal", timestamp: "25 Oct 21:20", name: "Loading completed",
    detail: "Last hose disconnected. Final quantity: 65,000 MT",
    tag: "Counting", tagBg: "#EFF6FF", tagText: "#1E40AF",
    duration: "16h 10m", cause: "Vessel", causeActive: true,
  },
  {
    n: "10", state: "pending", timestamp: "26 Oct 00:00", name: "Completion to NOR — under review",
    detail: "Post-loading period — deductibility disputed",
    tag: "Pending", tagBg: "#FFFBEB", tagText: "#B45309",
    duration: "TBC", cause: "Disputed", causeActive: false,
  },
];

// ─── Laytime Bar ──────────────────────────────────────────────────────────────

function LaytimeBar() {
  const segments = [
    { pct: 81, color: "#3B82F6", label: null },
    { pct: 3.5, color: "#D1D5DB", label: null },
    { pct: 2, color: "#D1D5DB", label: null },
    { pct: 13.5, color: "#E5E7EB", label: null },
  ];
  return (
    <div>
      <div className="flex rounded-full overflow-hidden mb-2" style={{ height: "10px", backgroundColor: "#F3F4F6" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="flex justify-between mb-3">
        {["23 Oct 08:00", "24 Oct 00:00", "25 Oct 00:00", "26 Oct 00:00"].map((d) => (
          <span key={d} style={{ fontSize: "9px", color: "#9CA3AF" }}>{d}</span>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {[
          { color: "#3B82F6", label: "Counting" },
          { color: "#D1D5DB", label: "Deductible" },
          { color: "#E5E7EB", label: "Remaining" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="rounded-sm flex-shrink-0" style={{ width: "8px", height: "8px", backgroundColor: item.color }} />
            <span style={{ fontSize: "11px", color: "#6B7280" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({ ev }: { ev: (typeof events)[0] }) {
  const isDeductible = ev.state === "deductible";
  const isPending = ev.state === "pending";

  return (
    <tr
      style={{
        backgroundColor: isDeductible ? "#FFFBEB" : isPending ? "#F9FAFB" : "#ffffff",
        transition: "background-color 0.12s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = isDeductible ? "#FEF3C7" : "#F9FAFB")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = isDeductible ? "#FFFBEB" : isPending ? "#F9FAFB" : "#ffffff")}
    >
      {/* # */}
      <td className="py-2.5 pl-4" style={{ width: "36px", verticalAlign: "middle" }}>
        {isPending ? (
          <span
            className="inline-flex items-center justify-center rounded-full"
            style={{
              width: "20px", height: "20px",
              border: "1.5px dashed #9CA3AF",
              fontSize: "10px", color: "#9CA3AF", fontWeight: 500,
            }}
          >
            {ev.n}
          </span>
        ) : (
          <span
            className="inline-flex items-center justify-center rounded-full"
            style={{
              width: "20px", height: "20px",
              backgroundColor: isDeductible ? "#FEEBC8" : "#EFF6FF",
              fontSize: "10px",
              color: isDeductible ? "#7B341E" : "#1E40AF",
              fontWeight: 500,
            }}
          >
            {ev.n}
          </span>
        )}
      </td>

      {/* Timestamp */}
      <td className="py-2.5 pr-3" style={{ width: "110px", verticalAlign: "top" }}>
        <span style={{ fontSize: "11px", color: "#6B7280", whiteSpace: "nowrap" }}>{ev.timestamp}</span>
      </td>

      {/* Event */}
      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{ev.name}</p>
        <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4, marginBottom: "4px" }}>{ev.detail}</p>
        <span
          className="inline-block rounded-full px-2 py-0.5 font-medium"
          style={{ fontSize: "10px", backgroundColor: ev.tagBg, color: ev.tagText }}
        >
          {ev.tag}
        </span>
      </td>

      {/* Duration */}
      <td className="py-2.5 pr-3" style={{ width: "72px", verticalAlign: "top" }}>
        <span style={{ fontSize: "12px", color: "#374151", fontWeight: ev.duration !== "—" && ev.duration !== "TBC" ? 500 : 400 }}>
          {ev.duration}
        </span>
      </td>

      {/* Cause */}
      <td className="py-2.5 pr-3" style={{ width: "100px", verticalAlign: "top" }}>
        <span
          className="inline-block rounded-full px-2 py-0.5 cursor-pointer transition-colors"
          style={{
            fontSize: "11px",
            border: `0.5px solid ${ev.causeActive ? "#1A4ED8" : "#E5E7EB"}`,
            backgroundColor: ev.causeActive ? "#EFF6FF" : "#ffffff",
            color: ev.causeActive ? "#1E40AF" : "#6B7280",
          }}
        >
          {ev.cause}
        </span>
      </td>

      {/* Edit */}
      <td className="py-2.5 pr-4" style={{ width: "32px", verticalAlign: "middle" }}>
        <button
          className="w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer"
          style={{ color: "#9CA3AF", border: "none", backgroundColor: "transparent" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F3F4F6")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
        >
          <Edit2 size={11} />
        </button>
      </td>
    </tr>
  );
}

// ─── Running total row ────────────────────────────────────────────────────────

function CalcRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-1.5"
      style={{ borderBottom: "0.5px solid #F3F4F6" }}
    >
      <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: "12px", color: valueColor ?? "#111827", fontWeight: bold ? 500 : 400 }}>{value}</span>
    </div>
  );
}

// ─── Annotation flag ──────────────────────────────────────────────────────────

function AnnotationFlag({ evLabel, desc, color, bg }: { evLabel: string; desc: string; color: string; bg: string }) {
  return (
    <div className="rounded-lg p-[9px_11px]" style={{ backgroundColor: bg, border: `0.5px solid ${color}30` }}>
      <p style={{ fontSize: "11px", fontWeight: 500, color, marginBottom: "3px" }}>{evLabel}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}

// ─── Add event modal ──────────────────────────────────────────────────────────

function AddEventModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (ev: { timestamp: string; name: string; cause: string; duration: string; deductible: boolean; notes: string }) => void;
}) {
  const causes = ["Weather", "Terminal", "Vessel", "Supplier"];
  const [timestamp, setTimestamp] = useState("");
  const [name, setName] = useState("");
  const [cause, setCause] = useState("Vessel");
  const [duration, setDuration] = useState("");
  const [deductible, setDeductible] = useState(false);
  const [notes, setNotes] = useState("");

  const canSubmit = timestamp.trim() !== "" && name.trim() !== "";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgba(17,24,39,0.4)" }} onClick={onClose}>
      <div className="flex flex-col" style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", border: "0.5px solid #E5E7EB", maxWidth: "440px", width: "100%", gap: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: "16px", fontWeight: 500, color: "#111827" }}>Add SOF event</h2>
          <button onClick={onClose} className="cursor-pointer" style={{ border: "none", background: "transparent", color: "#9CA3AF" }}>✕</button>
        </div>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#111827" }}>Timestamp <span style={{ color: "#DC2626" }}>*</span></span>
          <input value={timestamp} onChange={(e) => setTimestamp(e.target.value)} placeholder="e.g. 26 Oct 09:00"
            style={{ height: "34px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 10px", fontSize: "12px" }} />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#111827" }}>Event name <span style={{ color: "#DC2626" }}>*</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Loading commenced"
            style={{ height: "34px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 10px", fontSize: "12px" }} />
        </label>

        <div className="flex flex-col gap-1">
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#111827" }}>Cause / party <span style={{ color: "#DC2626" }}>*</span></span>
          <div className="flex flex-wrap gap-1.5">
            {causes.map((c) => (
              <button key={c} onClick={() => setCause(c)}
                className="rounded-full px-[9px] py-[3px] cursor-pointer"
                style={{ fontSize: "11px", border: `0.5px solid ${cause === c ? "#1A4ED8" : "#E5E7EB"}`, backgroundColor: cause === c ? "#EFF6FF" : "#ffffff", color: cause === c ? "#1E40AF" : "#6B7280" }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#111827" }}>Duration (hours)</span>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2.5 — leave blank if unknown"
            style={{ height: "34px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 10px", fontSize: "12px" }} />
        </label>

        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: "12px", color: "#374151" }}>
          <input type="checkbox" checked={deductible} onChange={(e) => setDeductible(e.target.checked)} />
          Deductible period (excluded from laytime count)
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "11px", fontWeight: 500, color: "#111827" }}>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any supporting context or evidence references…"
            style={{ height: "70px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "8px 10px", fontSize: "12px", resize: "none" }} />
        </label>

        <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: "0.5px solid #E5E7EB" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md border cursor-pointer"
            style={{ fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onAdd({ timestamp, name, cause, duration: duration || "—", deductible, notes })}
            className="px-3 py-1.5 rounded-md"
            style={{ fontSize: "12px", color: "#ffffff", backgroundColor: canSubmit ? "#1A4ED8" : "#93C5FD", border: "none", cursor: canSubmit ? "pointer" : "not-allowed" }}>
            Add event
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SOFTimeline() {
  const { id } = useParams();
  const { shipments, getShipmentById } = useShipments();
  const shipment = getShipmentById(id) ?? shipments[0];
  const [events, setEvents] = useState(initialEvents);
  const [showAddEvent, setShowAddEvent] = useState(false);

  function handleAddEvent(ev: { timestamp: string; name: string; cause: string; duration: string; deductible: boolean; notes: string }) {
    const n = String(events.length + 1).padStart(2, "0");
    setEvents([
      ...events,
      {
        n, state: ev.deductible ? "deductible" : "pending", timestamp: ev.timestamp, name: ev.name,
        detail: ev.notes || "Manually logged event — pending review",
        tag: ev.deductible ? "Deductible" : "Pending", tagBg: ev.deductible ? "#F3F4F6" : "#FFFBEB", tagText: ev.deductible ? "#374151" : "#B45309",
        duration: ev.duration, cause: ev.cause, causeActive: true,
      },
    ]);
    setShowAddEvent(false);
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      {showAddEvent && <AddEventModal onClose={() => setShowAddEvent(false)} onAdd={handleAddEvent} />}
      <PageHeader
        crumbs={[{ label: "Operations", to: "/" }, { label: `${shipment.vessel} · ${shipment.id}`, to: `/shipments/${shipment.id}` }, { label: "Laytime timeline" }]}
        actions={
          <>
            <button
              onClick={() => setShowAddEvent(true)}
              className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
              <Plus size={11} /> Add event
            </button>
            <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}>
              Run claim calc <ArrowUpRight size={12} />
            </button>
          </>
        }
      />

      {/* ── Page Header ── */}
      <div
        className="flex items-start justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>
              SOF timeline &amp; laytime calculation
            </h1>
            {[
              "Supplier clock active",
              "Receiver clock active",
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
                style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}
              >
                <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
                {label}
              </span>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            {shipment.vessel} · {shipment.id} · {shipment.port} Terminal 3 &nbsp;·&nbsp; 6h SHINC &nbsp;·&nbsp; Oct 23–26, 2023
          </p>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div
        className="flex gap-4 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        {[
          { label: "Laytime allowed", value: "72h 00m", vc: "#1A4ED8", sub: "Per charter party terms" },
          { label: "Laytime used", value: "58h 20m", vc: "#B45309", sub: "Gross, before deductions" },
          { label: "Deductions", value: "4h 00m", vc: "#374151", sub: "2 qualifying events" },
          { label: "Remaining", value: "13h 40m", vc: "#22543D", sub: "Net laytime balance" },
          { label: "Net position", value: "$0 est.", vc: "#B45309", sub: "13h 40m to spare" },
        ].map(({ label, value, vc, sub }) => (
          <div
            key={label}
            className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
          >
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "19px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left Column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — SOF Source */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                SOF source
              </span>
              <span
                className="rounded-full px-2 py-0.5 font-medium"
                style={{ fontSize: "10px", backgroundColor: "#C6F6D5", color: "#22543D" }}
              >
                Extracted
              </span>
            </div>

            {/* File row */}
            <div
              className="flex items-center gap-3 rounded-lg border p-[10px_12px] mb-5"
              style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}
            >
              <div
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: "36px", height: "36px", backgroundColor: "#DBEAFE" }}
              >
                <FileText size={16} color="#1A4ED8" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>
                  SOF_BW-Magnolia_VOY2311_Singapore.pdf
                </p>
                <p style={{ fontSize: "11px", color: "#9CA3AF" }}>
                  Extracted by AI agent · 22 Oct 2023 · 4 pages
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
                >
                  <Eye size={10} />
                  View raw
                </button>
                <button
                  className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
                >
                  <RefreshCw size={10} />
                  Re-extract
                </button>
              </div>
            </div>

            <LaytimeBar />
          </div>

          {/* Card 2 — SOF Event Log */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "0.5px solid #E5E7EB" }}
            >
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                SOF event log
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: "8 counting", bg: "#C6F6D5", text: "#22543D" },
                  { label: "2 deductible", bg: "#F3F4F6", text: "#374151" },
                  { label: "1 pending", bg: "#EFF6FF", text: "#1E40AF" },
                ].map(({ label, bg, text }) => (
                  <span
                    key={label}
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{ fontSize: "10px", backgroundColor: bg, color: text }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Warning strip */}
            <div
              className="flex items-center gap-2.5 px-4 py-2.5"
              style={{
                backgroundColor: "#FFFBEB",
                borderLeft: "2.5px solid #F59E0B",
                borderBottom: "0.5px solid #E5E7EB",
              }}
            >
              <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: "11px", color: "#7B341E", lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 500 }}>Event 05 disputed:</strong> Counterparty contests weather deductibility. Awaiting supporting documentation from terminal agent. Event 10 pending classification.
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                    <th className="pl-4 py-2.5 text-left" style={{ width: "36px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>#</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left" style={{ width: "110px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Timestamp</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left">
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Event</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left" style={{ width: "72px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Duration</span>
                    </th>
                    <th className="py-2.5 pr-3 text-left" style={{ width: "100px" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cause · party</span>
                    </th>
                    <th className="py-2.5 pr-4 text-left" style={{ width: "32px" }} />
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr
                      key={ev.n}
                      style={{
                        backgroundColor:
                          ev.state === "deductible" ? "#FFFBEB"
                          : ev.state === "pending" ? "#F9FAFB"
                          : "#ffffff",
                        borderBottom: i < events.length - 1 ? "0.5px solid #F3F4F6" : "none",
                        transition: "background-color 0.12s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          ev.state === "deductible" ? "#FEF3C7"
                          : ev.state === "pending" ? "#F3F4F6"
                          : "#F9FAFB";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          ev.state === "deductible" ? "#FFFBEB"
                          : ev.state === "pending" ? "#F9FAFB"
                          : "#ffffff";
                      }}
                    >
                      {/* # */}
                      <td className="py-2.5 pl-4" style={{ verticalAlign: "middle" }}>
                        {ev.state === "pending" ? (
                          <span
                            className="inline-flex items-center justify-center rounded-full"
                            style={{ width: "20px", height: "20px", border: "1.5px dashed #9CA3AF", fontSize: "10px", color: "#9CA3AF", fontWeight: 500 }}
                          >
                            {ev.n}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center rounded-full"
                            style={{
                              width: "20px", height: "20px",
                              backgroundColor: ev.state === "deductible" ? "#FEEBC8" : "#EFF6FF",
                              fontSize: "10px",
                              color: ev.state === "deductible" ? "#7B341E" : "#1E40AF",
                              fontWeight: 500,
                            }}
                          >
                            {ev.n}
                          </span>
                        )}
                      </td>
                      {/* Timestamp */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <span style={{ fontSize: "11px", color: "#6B7280", whiteSpace: "nowrap" }}>{ev.timestamp}</span>
                      </td>
                      {/* Event */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{ev.name}</p>
                        <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4, marginBottom: "4px" }}>{ev.detail}</p>
                        <span
                          className="inline-block rounded-full px-2 py-0.5 font-medium"
                          style={{ fontSize: "10px", backgroundColor: ev.tagBg, color: ev.tagText }}
                        >
                          {ev.tag}
                        </span>
                      </td>
                      {/* Duration */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <span style={{ fontSize: "12px", color: "#374151", fontWeight: ev.duration.includes("h") ? 500 : 400 }}>
                          {ev.duration}
                        </span>
                      </td>
                      {/* Cause pill */}
                      <td className="py-2.5 pr-3" style={{ verticalAlign: "top" }}>
                        <span
                          className="inline-block rounded-full px-2 py-0.5 cursor-pointer transition-colors"
                          style={{
                            fontSize: "11px",
                            border: `0.5px solid ${ev.causeActive ? "#1A4ED8" : "#E5E7EB"}`,
                            backgroundColor: ev.causeActive ? "#EFF6FF" : "#ffffff",
                            color: ev.causeActive ? "#1E40AF" : "#6B7280",
                          }}
                        >
                          {ev.cause}
                        </span>
                      </td>
                      {/* Edit */}
                      <td className="py-2.5 pr-4" style={{ verticalAlign: "middle" }}>
                        <button
                          className="w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer"
                          style={{ color: "#9CA3AF", border: "none", backgroundColor: "transparent" }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F3F4F6")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                        >
                          <Edit2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add manual event */}
            <div style={{ borderTop: "0.5px solid #E5E7EB", padding: "10px 16px" }}>
              <button
                className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ height: "32px", fontSize: "12px", color: "#6B7280", border: "0.5px dashed #D1D5DB", backgroundColor: "transparent" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
              >
                <Plus size={12} />
                Add manual event
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: "220px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Component 1 — Running totals */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <p className="mb-3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Running totals
            </p>

            {/* Supplier clock */}
            <p className="mb-1.5" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>Supplier clock</p>
            <CalcRow label="NOR tendered" value="23 Oct 08:00" />
            <CalcRow label="Laytime starts" value="23 Oct 14:00" />
            <CalcRow label="Allowed" value="72h 00m" valueColor="#1A4ED8" bold />
            <CalcRow label="Used (gross)" value="58h 20m" />
            <CalcRow label="Deductions" value="−4h 00m" valueColor="#22543D" />
            <CalcRow label="Net used" value="54h 20m" valueColor="#B45309" bold />
            <CalcRow label="Remaining" value="17h 40m" valueColor="#22543D" bold />

            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0" }} />

            {/* Receiver clock */}
            <p className="mb-1.5" style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>Receiver clock</p>
            <CalcRow label="Clock starts" value="24 Oct 00:00" />
            <CalcRow label="Allowed" value="48h 00m" valueColor="#1A4ED8" bold />
            <CalcRow label="Net used" value="44h 20m" valueColor="#B45309" bold />
            <CalcRow label="Remaining" value="3h 40m" valueColor="#22543D" bold />
          </div>

          {/* Component 2 — Annotation flags */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <p className="mb-2.5" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Annotation flags
            </p>
            <div className="flex flex-col gap-2">
              <AnnotationFlag
                evLabel="Event 05 — Disputed"
                desc="Counterparty contests weather delay classification. Supporting weather report from terminal required."
                color="#B45309"
                bg="#FFFBEB"
              />
              <AnnotationFlag
                evLabel="Event 10 — Pending"
                desc="Post-loading period not yet classified. Affects net laytime position by up to 3h 20m."
                color="#1A4ED8"
                bg="#EFF6FF"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "38px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
            >
              Run claim calculation
              <ArrowUpRight size={13} />
            </button>
            <button
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
            >
              Export laytime sheet
            </button>
            <button
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
            >
              Export to Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
