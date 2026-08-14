import {
  Download, ArrowUpRight, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { PageHeader } from "./Layout";

// ─── Data ─────────────────────────────────────────────────────────────────────

const supplierPerf = [
  { name: "GLO-EN",  target: 100, actual: 124 },
  { name: "PAC-LOG", target: 100, actual: 118 },
  { name: "AT-FUEL", target: 100, actual: 97  },
  { name: "ZEN-PET", target: 100, actual: 108 },
  { name: "NOR-OIL", target: 100, actual: 89  },
];

const monthlyTrend = [
  { month: "Jan", berth: 380, weather: 210, ops: 320 },
  { month: "Feb", berth: 420, weather: 180, ops: 290 },
  { month: "Mar", berth: 310, weather: 240, ops: 350 },
  { month: "Apr", berth: 460, weather: 195, ops: 280 },
];

const costRanking = [
  { name: "Global Energy Co.", value: "$1.24M", pct: 100, color: "#EF4444" },
  { name: "Pacific Logistics",  value: "$820k",  pct: 66,  color: "#EF4444" },
  { name: "Atlantic Fuels",     value: "$430k",  pct: 35,  color: "#F59E0B" },
  { name: "Zenith Petroleum",   value: "$291k",  pct: 23,  color: "#F59E0B" },
  { name: "Northern Oil",       value: "$174k",  pct: 14,  color: "#10B981" },
];

const donutSegments = [
  { label: "Berth congestion", pct: 35, hours: 434, color: "#EF4444" },
  { label: "Weather events",   pct: 25, hours: 310, color: "#F59E0B" },
  { label: "Ops/other",        pct: 40, hours: 496, color: "#D1D5DB" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FilterSelect({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <select className="appearance-none outline-none cursor-pointer"
        style={{ height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 24px 0 9px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff" }}>
        <option>{placeholder}</option>
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
    </div>
  );
}

function SectionLabel({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</span>
      {badge}
    </div>
  );
}

function LegendSwatch({ color, label, solid }: { color: string; label: string; solid?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-sm flex-shrink-0"
        style={{ width: "8px", height: "8px", backgroundColor: solid ? color : undefined, border: solid ? undefined : `1.5px solid ${color}`, opacity: solid ? 1 : 0.6 }} />
      <span style={{ fontSize: "11px", color: "#6B7280" }}>{label}</span>
    </div>
  );
}

// ─── Donut chart (SVG) ────────────────────────────────────────────────────────

function DonutChart() {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 62;
  const innerR = r * 0.65;
  const strokeW = r - innerR;

  let cumAngle = -90;
  const arcs = donutSegments.map((s) => {
    const startAngle = cumAngle;
    const sweep = (s.pct / 100) * 360;
    cumAngle += sweep;
    const endAngle = cumAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle - 0.01));
    const y2 = cy + r * Math.sin(toRad(endAngle - 0.01));
    const largeArc = sweep > 180 ? 1 : 0;

    const ix1 = cx + innerR * Math.cos(toRad(startAngle));
    const iy1 = cy + innerR * Math.sin(toRad(startAngle));
    const ix2 = cx + innerR * Math.cos(toRad(endAngle - 0.01));
    const iy2 = cy + innerR * Math.sin(toRad(endAngle - 0.01));

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    return { d, color: s.color };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color} />
      ))}
      <circle cx={cx} cy={cy} r={innerR} fill="#ffffff" />
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: "13px", fontWeight: 500, fill: "#111827" }}>1,240h</text>
      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: "10px", fill: "#9CA3AF" }}>total delay</text>
    </svg>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2" style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px", fontSize: "11px" }}>
      <p style={{ color: "#6B7280", marginBottom: "4px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 500 }}>{p.name}: {p.value}{p.name.includes("Target") || p.name.includes("Actual") ? "%" : "h"}</p>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CommercialIntelligence({ onTerminal }: { onTerminal?: () => void }) {
  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Analytics", to: "/analytics" }, { label: "Commercial intelligence" }]} />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Commercial intelligence</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
            style={{ backgroundColor: "#C6F6D5", color: "#22543D", fontSize: "11px" }}>
            <span className="rounded-full animate-pulse" style={{ width: "5px", height: "5px", backgroundColor: "#10B981" }} />
            Auto-syncing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect placeholder="All suppliers" />
          <FilterSelect placeholder="All ports" />
          <FilterSelect placeholder="Last 30 days" />
          <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{ height: "30px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
            <Download size={11} /> Export
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="flex gap-2.5 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        {[
          { label: "Total exposure", value: "$4.2M", vc: "#C53030", sub: "▲ 12% vs prior period" },
          { label: "Avg delay time", value: "42.5h", vc: "#B45309", sub: "▲ 4.4h vs prior period" },
          { label: "Port congestion index", value: "7.8", vc: "#C53030", sub: "High — threshold 6.0" },
          { label: "Operational efficiency", value: "88%", vc: "#22543D", sub: "Target 90% — 2pts below" },
        ].map(({ label, value, vc, sub }) => (
          <div key={label} className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "20px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left Column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — Supplier performance */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Supplier performance vs laycan</SectionLabel>
              <div className="flex items-center gap-3">
                <LegendSwatch color="#93C5FD" label="Target" />
                <LegendSwatch color="#1A4ED8" label="Actual" solid />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={supplierPerf} barGap={4} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis domain={[80, 140]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F9FAFB" }} />
                <Bar dataKey="target" name="Target" fill="#BFDBFE" radius={[2, 2, 0, 0]} maxBarSize={16} />
                <Bar dataKey="actual" name="Actual" radius={[2, 2, 0, 0]} maxBarSize={16}>
                  {supplierPerf.map((entry) => (
                    <Cell key={entry.name} fill={entry.actual > 100 ? "#1A4ED8" : "#3B82F6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "6px" }}>
              Values above 100% indicate late delivery relative to laycan window
            </p>
          </div>

          {/* Card 2 — Terminal delay distribution */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Terminal delay distribution</SectionLabel>
              <span className="rounded-full px-2 py-0.5 font-medium"
                style={{ fontSize: "10px", backgroundColor: "#F3F4F6", color: "#374151" }}>
                1,240 total hours
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6 items-center">
              <div className="flex justify-center">
                <DonutChart />
              </div>
              <div className="flex flex-col gap-3">
                {donutSegments.map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: "11px", color: "#374151" }}>{s.label}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "11px", color: "#6B7280" }}>{s.hours}h</span>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#111827", width: "28px", textAlign: "right" }}>{s.pct}%</span>
                      </div>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: "5px", backgroundColor: "#F3F4F6" }}>
                      <div className="h-full rounded-full" style={{ width: `${s.pct * 2.5}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3 — Monthly trend */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Monthly trend — cause breakdown</SectionLabel>
              <div className="flex items-center gap-3">
                <LegendSwatch color="#EF4444" label="Berth wait" solid />
                <LegendSwatch color="#F59E0B" label="Weather" solid />
                <LegendSwatch color="#D1D5DB" label="Ops/other" solid />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyTrend} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F9FAFB" }} />
                <Bar dataKey="berth" name="Berth wait" stackId="a" fill="#EF4444" />
                <Bar dataKey="weather" name="Weather" stackId="a" fill="#F59E0B" />
                <Bar dataKey="ops" name="Ops/other" stackId="a" fill="#D1D5DB" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Card 4 — Cost ranking */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2 mb-4">
              <SectionLabel>Cost ranking by supplier</SectionLabel>
              <span className="rounded-full px-2 py-0.5 font-semibold"
                style={{ fontSize: "10px", backgroundColor: "#FED7D7", color: "#9B2C2C" }}>
                4 high risk
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {costRanking.map((row) => (
                <div key={row.name} className="flex items-center gap-2">
                  <span className="flex-shrink-0" style={{ width: "130px", fontSize: "12px", color: "#374151" }}>{row.name}</span>
                  <div className="flex-1 rounded overflow-hidden" style={{ height: "8px", backgroundColor: "#F3F4F6", borderRadius: "4px" }}>
                    <div className="h-full" style={{ width: `${row.pct}%`, backgroundColor: row.color, borderRadius: "4px" }} />
                  </div>
                  <span className="flex-shrink-0 font-medium text-right" style={{ width: "52px", fontSize: "12px", color: "#374151" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: "200px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Card 1 — High risk suppliers */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2.5" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              High risk suppliers
            </p>
            <div className="flex flex-col gap-2">
              {[
                { name: "Global Energy Co.", sub: "VOY-2310 · 12 voyages", risk: "HIGH", bg: "#FED7D7", text: "#9B2C2C" },
                { name: "Pacific Logistics", sub: "VOY-2298 · 8 voyages", risk: "HIGH", bg: "#FED7D7", text: "#9B2C2C" },
                { name: "Northern Oil", sub: "VOY-2187 · 5 voyages", risk: "MED", bg: "#FEEBC8", text: "#7B341E" },
              ].map(({ name, sub, risk, bg, text }) => (
                <div key={name} className="flex items-start justify-between rounded-lg border p-[10px_12px]"
                  style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{name}</p>
                    <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{sub}</p>
                  </div>
                  <span className="rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0 ml-1"
                    style={{ fontSize: "10px", backgroundColor: bg, color: text }}>{risk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2 — Operational feed */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Operational feed
            </p>
            {[
              { type: "Port alert", color: "#EF4444", desc: "Rotterdam T4 avg wait +3.2h above monthly mean." },
              { type: "Supplier alert", color: "#F59E0B", desc: "Global Energy showing 4th consecutive late delivery." },
              { type: "Efficiency", color: "#10B981", desc: "Atlantic Fuels: 98% on-time across last 6 voyages." },
              { type: "Weather", color: "#F59E0B", desc: "North Sea Biscay — 72h window disruption forecast." },
            ].map(({ type, color, desc }, i, arr) => (
              <div key={type} className="py-2" style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                <p style={{ fontSize: "10px", color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px", fontWeight: 500 }}>{type}</p>
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Card 3 — Key metrics */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Key metrics
            </p>
            {[
              { label: "Recovery rate", value: "91%", vc: "#22543D" },
              { label: "Avg cycle time", value: "18 days" },
              { label: "Suppliers on time", value: "62%", vc: "#B45309" },
              { label: "Avg POB wait", value: "6.4h", vc: "#B45309" },
              { label: "Active claims", value: "24" },
            ].map(({ label, value, vc }) => (
              <div key={label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
                <span style={{ fontSize: "12px", color: vc ?? "#111827", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "8px 0" }} />
            {[
              { label: "Top delay driver", value: "Berth wait", vc: "#C53030" },
              { label: "Worst terminal", value: "Rotterdam T4", vc: "#C53030" },
            ].map(({ label, value, vc }) => (
              <div key={label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
                <span style={{ fontSize: "12px", color: vc, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button onClick={onTerminal}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
              Terminal analytics <ArrowUpRight size={13} />
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "34px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
              Export full report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
