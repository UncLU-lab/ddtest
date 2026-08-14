import { useState } from "react";
import { Download, ArrowUpRight, Eye, Plus } from "lucide-react";
import { PageHeader } from "./Layout";

type TabKey = "tactical" | "strategic" | "evidence" | "benchmarks";
type Priority = "high" | "med" | "low";

// ─── Rec item ─────────────────────────────────────────────────────────────────

const PRIORITY = {
  high: { border: "#EF4444", bg: "#FED7D7", text: "#9B2C2C", label: "High priority" },
  med:  { border: "#F59E0B", bg: "#FEEBC8", text: "#7B341E", label: "Medium" },
  low:  { border: "#D1D5DB", bg: "#F3F4F6", text: "#374151", label: "Low" },
};

function Pill({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: bg, color: text }}>{label}</span>
  );
}

function RecItem({ priority, title, desc, clause, evidenceLabel, value, valueLabel = "recoverable" }:
  { priority: Priority; title: string; desc: string; clause: string; evidenceLabel: string; value?: string; valueLabel?: string }) {
  const p = PRIORITY[priority];
  const [applied, setApplied] = useState(false);
  return (
    <div className="flex gap-0" style={{ borderRadius: "0 8px 8px 0", border: "0.5px solid #E5E7EB", borderLeft: `3px solid ${p.border}`, overflow: "hidden" }}>
      <div className="flex-1 min-w-0 p-[13px_14px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827", marginBottom: "4px" }}>{title}</p>
            <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5, marginBottom: "7px" }}>{desc}</p>
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <Pill label={p.label} bg={p.bg} text={p.text} />
              <Pill label={clause} bg="#F3F4F6" text="#374151" />
              <Pill label={evidenceLabel} bg="#EFF6FF" text="#1E40AF" />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                style={{ height: "26px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                <Eye size={10} /> View evidence
              </button>
              {value && (
                <button onClick={() => setApplied(!applied)}
                  className="flex items-center gap-1 px-2.5 rounded-md transition-colors cursor-pointer"
                  style={{ height: "26px", fontSize: "11px", color: "#ffffff", backgroundColor: applied ? "#276749" : "#1A4ED8", border: "none" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = applied ? "#1c4532" : "#1e40af")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = applied ? "#276749" : "#1A4ED8")}>
                  {applied ? "Applied ✓" : "Apply to claim"}
                </button>
              )}
            </div>
          </div>
          {value && (
            <div className="flex-shrink-0 flex flex-col items-end gap-0.5 pt-0.5">
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#22543D" }}>{value}</span>
              <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{valueLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({ blueCount = 3, totalBars = 7 }: { blueCount?: number; totalBars?: number }) {
  const heights = [22, 28, 20, 34, 26, 30, 18];
  return (
    <div className="flex items-end gap-[3px]" style={{ height: "36px" }}>
      {heights.slice(0, totalBars).map((h, i) => (
        <div key={i}
          style={{
            width: "14px",
            height: `${h}px`,
            backgroundColor: i < blueCount ? "#3B82F6" : "#EF4444",
            borderRadius: "2px 2px 0 0",
            flexShrink: 0,
          }} />
      ))}
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ title, desc, confidence, confidenceBg, confidenceText, blueCount, btnLabel, btnColor, btnBg, btnBorder }:
  { title: string; desc: string; confidence: string; confidenceBg: string; confidenceText: string;
    blueCount: number; btnLabel: string; btnColor: string; btnBg: string; btnBorder: string }) {
  return (
    <div className="rounded-xl border p-[13px_14px]" style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{title}</p>
        <span className="flex-shrink-0 rounded-full px-2 py-0.5 font-medium"
          style={{ fontSize: "10px", backgroundColor: confidenceBg, color: confidenceText }}>{confidence}</span>
      </div>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5, marginBottom: "10px" }}>{desc}</p>
      <MiniBarChart blueCount={blueCount} />
      <button className="w-full flex items-center justify-center gap-1 mt-3 rounded-lg transition-colors cursor-pointer"
        style={{ height: "30px", fontSize: "11px", fontWeight: 500, color: btnColor, backgroundColor: btnBg, border: `0.5px solid ${btnBorder}` }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}>
        {btnLabel} <ArrowUpRight size={11} />
      </button>
    </div>
  );
}

// ─── Evidence item ────────────────────────────────────────────────────────────

type DotState = "blue" | "green" | "amber";
const DOT_COLOR: Record<DotState, string> = { blue: "#3B82F6", green: "#10B981", amber: "#F59E0B" };

function EvidenceItem({ dot, name, desc, last }: { dot: DotState; name: string; desc: string; last?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-2" style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}>
      <span className="rounded-full flex-shrink-0 mt-[3px]"
        style={{ width: "6px", height: "6px", backgroundColor: DOT_COLOR[dot] }} />
      <div>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "#111827" }}>{name}</p>
        <p style={{ fontSize: "11px", color: "#6B7280" }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Benchmark row ────────────────────────────────────────────────────────────

function BenchmarkRow({ label, pct, color, value }: { label: string; pct: number; color: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0" style={{ width: "90px", fontSize: "11px", color: "#6B7280" }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: "5px", backgroundColor: "#F3F4F6" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="flex-shrink-0 font-medium" style={{ fontSize: "11px", color: "#374151", width: "60px", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ─── KV row ───────────────────────────────────────────────────────────────────

function KVRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "0.5px solid #F3F4F6" }}>
      <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: "12px", color: valueColor ?? "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RecommendationsEngine({ onAddToClaim }: {
  onAddToClaim?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("tactical");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "tactical", label: "Tactical" },
    { key: "strategic", label: "Strategic" },
    { key: "evidence", label: "Evidence console" },
    { key: "benchmarks", label: "Historical benchmarks" },
  ];

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Vessels", to: "/vessels" }, { label: "Recommendations" }]}
        actions={
          <>
            <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
              <Download size={11} /> Generate notes
            </button>
            <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onClick={onAddToClaim}>
              Add to claim <ArrowUpRight size={12} />
            </button>
          </>
        }
      />

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Recommendations engine</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
              style={{ backgroundColor: "#FED7D7", color: "#9B2C2C", fontSize: "11px" }}>
              <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#C53030" }} />
              2 high priority
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
              style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}>
              <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
              94% AI confidence
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            BW Magnolia · VOY-2311 &nbsp;·&nbsp; AI-generated claims mitigation strategy based on SOF analysis and market data
          </p>
        </div>
      </div>

      {/* ── Section Tabs ── */}
      <div className="flex items-stretch flex-shrink-0"
        style={{ borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff", paddingLeft: "24px" }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 cursor-pointer transition-colors"
              style={{ fontSize: "13px", fontWeight: isActive ? 500 : 400, color: isActive ? "#111827" : "#6B7280", background: "none", border: "none" }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#374151"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}>
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0" style={{ height: "2px", backgroundColor: "#1A4ED8" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main Body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — Tactical recommendations */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tactical recommendations
              </span>
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Real-time claims mitigation</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <RecItem
                priority="high"
                title="Challenge rain stoppage deductibility"
                desc="Terminal weather logs show 78% of the stoppage period recorded no official rain gauge reading above the charter party threshold. Primary evidence supports challenge."
                clause="CP clause 8(b)"
                evidenceLabel="3 docs available"
                value="+$8,200"
              />
              <RecItem
                priority="high"
                title="Request terminal arm breakdown logs"
                desc="Loading arm failure at 03:40 on 25 Oct attributed to terminal — deductibility clear under ASBATANKVOY clause 14. Formal request to terminal agent recommended."
                clause="ASBATANKVOY cl.14"
                evidenceLabel="Log request pending"
                value="+$4,500"
              />
              <RecItem
                priority="med"
                title="Confirm NOR validity and time of acceptance"
                desc="Counterparty NOR timestamp inconsistency (+6h) requires written confirmation from pilot station master log. Resolve before claim submission deadline."
                clause="CP clause 5"
                evidenceLabel="Awaiting pilot log"
                value="+$1,500"
                valueLabel="awaiting"
              />
              <RecItem
                priority="low"
                title="Propose split liability for terminal delay period"
                desc="04h 30m grey-area terminal delay could be negotiated as 50/50 split with counterparty, avoiding formal dispute escalation and preserving the commercial relationship."
                clause="BIMCO clause ref."
                evidenceLabel="No docs required"
              />
            </div>
          </div>

          {/* Card 2 — Strategic insights */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Strategic insights
              </span>
              <span className="rounded-full px-2 py-0.5 font-medium"
                style={{ fontSize: "10px", backgroundColor: "#F3E8FF", color: "#6D28D9" }}>
                Predictive analytics
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <InsightCard
                title="Vitol Asia — recurring delay pattern"
                desc="Analysis of 14 previous voyages shows Vitol Asia cargo at Sabine Pass averages +9.2h NOR-to-berth delay in Q3/Q4. Recommend building 12h buffer into future laycans."
                confidence="87% confidence"
                confidenceBg="#FEEBC8"
                confidenceText="#7B341E"
                blueCount={3}
                btnLabel="Adjust laycan buffer"
                btnColor="#B45309"
                btnBg="#FFFBEB"
                btnBorder="#FDE68A"
              />
              <InsightCard
                title="Singapore Terminal 3 congestion trend"
                desc="Terminal 3 turnaround times have increased 34% over the past 6 weeks. 4 of 7 recent vessels encountered delays exceeding 8h. Port selection strategy review advised."
                confidence="91% confidence"
                confidenceBg="#EFF6FF"
                confidenceText="#1E40AF"
                blueCount={3}
                btnLabel="Optimise port selection"
                btnColor="#1A4ED8"
                btnBg="#EFF6FF"
                btnBorder="#BFDBFE"
              />
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: "210px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Card 1 — Shipment position */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Shipment position
            </p>
            <KVRow label="Net position" value="$14,200" valueColor="#C53030" />
            <KVRow label="AI confidence" value="94%" valueColor="#22543D" />
            <KVRow label="Recoverable" value="$14,200" valueColor="#22543D" />
            <KVRow label="Action required" value="2 items" valueColor="#C53030" />
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: "10px", color: "#6B7280" }}>Confidence score</span>
                <span style={{ fontSize: "10px", color: "#1A4ED8", fontWeight: 500 }}>94%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: "6px", backgroundColor: "#F3F4F6" }}>
                <div className="h-full rounded-full" style={{ width: "94%", backgroundColor: "#1A4ED8" }} />
              </div>
            </div>
          </div>

          {/* Card 2 — Evidence console */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-1" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Evidence console
            </p>
            <EvidenceItem dot="blue" name="SOF extract — pages 3–4" desc="Laytime events confirmed" />
            <EvidenceItem dot="blue" name="CP clause 8(b)" desc="Weather deductible clause" />
            <EvidenceItem dot="green" name="Pilot station log" desc="NOR timing confirmed" />
            <EvidenceItem dot="green" name="Terminal arm log" desc="Breakdown record obtained" />
            <EvidenceItem dot="amber" name="Rain gauge data" desc="Awaiting terminal agent" last />
          </div>

          {/* Card 3 — Historical benchmarks */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Historical benchmarks
            </p>
            <div className="flex flex-col gap-2.5">
              <BenchmarkRow label="Avg discharge rate" pct={82} color="#3B82F6" value="2,200 t/hr" />
              <BenchmarkRow label="Current rate" pct={68} color="#EF4444" value="1,850 t/hr" />
            </div>
            <p className="mt-3 pt-2.5" style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.4, borderTop: "0.5px solid #F3F4F6" }}>
              Based on Singapore Terminal 3 · last 90 days · 22 voyages sampled
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "38px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
              onClick={onAddToClaim}>
              Add to claim workflow <ArrowUpRight size={13} />
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
              Generate negotiation notes
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
              Export summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
