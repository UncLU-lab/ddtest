import { useState } from "react";
import { Bell, Download, ArrowUpRight, ChevronDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { PageHeader } from "./Layout";

// ─── Data ─────────────────────────────────────────────────────────────────────

const terminalCards = [
  { name: "Rotterdam T4", port: "Rotterdam, NL", risk: "critical" as const, avg: "42h", benchmark: "+18h", index: "9.1", vessels: "14" },
  { name: "Singapore T3", port: "Singapore, SG", risk: "elevated" as const, avg: "31h", benchmark: "+7h",  index: "7.8", vessels: "9"  },
  { name: "Fujairah T2",  port: "Fujairah, UAE", risk: "elevated" as const, avg: "28h", benchmark: "+4h",  index: "6.2", vessels: "6"  },
  { name: "Houston T1",   port: "Houston, TX",   risk: "normal"   as const, avg: "22h", benchmark: "–2h",  index: "3.1", vessels: "11" },
];

const arrivalPOBData = [
  { terminal: "Rotterdam T4", hours: 16.2, color: "#EF4444" },
  { terminal: "Singapore T3", hours: 11.8, color: "#F59E0B" },
  { terminal: "Fujairah T2",  hours: 8.9,  color: "#F59E0B" },
  { terminal: "Corpus Christi", hours: 6.8, color: "#D1D5DB" },
  { terminal: "Houston T1",   hours: 4.1,  color: "#10B981" },
];

const trendData = [
  { month: "Oct", rotterdam: 28, singapore: 24, houston: 26 },
  { month: "Nov", rotterdam: 32, singapore: 25, houston: 25 },
  { month: "Dec", rotterdam: 35, singapore: 27, houston: 24 },
  { month: "Jan", rotterdam: 38, singapore: 28, houston: 23 },
  { month: "Feb", rotterdam: 40, singapore: 29, houston: 22 },
  { month: "Mar", rotterdam: 42, singapore: 31, houston: 21 },
];

const rankingRows = [
  { rank: 1, name: "Rotterdam T4",    meta: "avg +18h · 14 vessels", value: "$1.24M", valueColor: "#C53030", special: false },
  { rank: 2, name: "Singapore T3",    meta: "avg +7h · 9 vessels",   value: "$620k",  valueColor: "#C53030", special: false },
  { rank: 3, name: "Fujairah T2",     meta: "avg +4h · 6 vessels",   value: "$280k",  valueColor: "#B45309", special: false },
  { rank: 4, name: "Corpus Christi",  meta: "avg +1h · 4 vessels",   value: "$96k",   valueColor: "#B45309", special: false },
  { rank: 5, name: "Houston T1",      meta: "avg –2h · 11 vessels",  value: "$0 dispatch", valueColor: "#22543D", special: true },
];

const benchmarkRows = [
  { label: "Arrival → POB",    value: "8.4h", valueColor: "#B45309", pct: 70, targetPct: 50 },
  { label: "POB → all fast",   value: "3.2h", valueColor: "#1A4ED8", pct: 40, targetPct: 35 },
  { label: "All fast → commence", value: "1.8h", valueColor: "#22543D", pct: 30, targetPct: 40 },
  { label: "Total ops",        value: "34.2h", valueColor: "#C53030", pct: 85, targetPct: 65 },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const RISK = {
  critical: { topBorder: "#EF4444", badgeBg: "#FED7D7", badgeText: "#9B2C2C", label: "Critical" },
  elevated: { topBorder: "#F59E0B", badgeBg: "#FEEBC8", badgeText: "#7B341E", label: "Elevated" },
  normal:   { topBorder: "#10B981", badgeBg: "#C6F6D5", badgeText: "#22543D", label: "Normal"   },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSelect({ value, options, onChange }: { value: string; options: string[]; onChange?: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="appearance-none outline-none cursor-pointer"
        style={{ height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 24px 0 9px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
    </div>
  );
}

function RiskBadge({ risk }: { risk: keyof typeof RISK }) {
  const c = RISK[risk];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold flex-shrink-0"
      style={{ fontSize: "10px", backgroundColor: c.badgeBg, color: c.badgeText }}>
      {c.label}
    </span>
  );
}

function TerminalCard({ t }: { t: typeof terminalCards[0] }) {
  const c = RISK[t.risk];
  return (
    <div className="flex flex-col rounded-lg border overflow-hidden"
      style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", borderTop: `2px solid ${c.topBorder}` }}>
      <div className="p-[11px_13px]">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{t.name}</p>
            <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>{t.port}</p>
          </div>
          <RiskBadge risk={t.risk} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { k: "Avg turnaround", v: t.avg },
            { k: "Vs benchmark",   v: t.benchmark, vc: t.risk === "normal" ? "#22543D" : t.risk === "elevated" ? "#B45309" : "#C53030" },
            { k: "Congestion idx", v: t.index },
            { k: "Vessels affected", v: t.vessels },
          ].map(({ k, v, vc }) => (
            <div key={k}>
              <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "1px" }}>{k}</p>
              <p style={{ fontSize: "13px", fontWeight: 500, color: vc ?? "#111827" }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2" style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px", fontSize: "11px" }}>
      <p style={{ color: "#6B7280", marginBottom: "4px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 500 }}>{p.name}: {p.value}h</p>
      ))}
    </div>
  );
}

// Custom horizontal bar label
function HBarLabel({ x, y, width, height, value }: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  return (
    <text x={(x ?? 0) + (width ?? 0) + 6} y={(y ?? 0) + (height ?? 0) / 2 + 4}
      style={{ fontSize: "11px", fill: "#374151", fontWeight: 500 }}>
      {value}h
    </text>
  );
}

function BenchmarkBar({ label, value, valueColor, pct, targetPct, last }:
  { label: string; value: string; valueColor: string; pct: number; targetPct: number; last?: boolean }) {
  return (
    <div className="py-2" style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: "11px", color: "#6B7280", width: "120px", flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: "11px", fontWeight: 500, color: valueColor }}>{value}</span>
      </div>
      <div className="relative rounded-full overflow-visible" style={{ height: "8px", backgroundColor: "#F3F4F6" }}>
        {/* Filled bar */}
        <div className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: valueColor === "#C53030" ? "#EF4444" : valueColor === "#B45309" ? "#F59E0B" : valueColor === "#22543D" ? "#10B981" : "#3B82F6" }} />
        {/* Target line */}
        <div className="absolute top-[-3px] bottom-[-3px] rounded-sm"
          style={{ left: `${targetPct}%`, width: "2px", backgroundColor: "#1A4ED8", zIndex: 1 }} />
      </div>
    </div>
  );
}

function SideKV({ label, value, valueColor, noBorder }: { label: string; value: string; valueColor?: string; noBorder?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: noBorder ? "none" : "0.5px solid #F3F4F6" }}>
      <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: "12px", color: valueColor ?? "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function RecItem({ title, rationale }: { title: string; rationale: string }) {
  return (
    <div className="rounded-lg p-[9px_11px]" style={{ backgroundColor: "#F9FAFB" }}>
      <p style={{ fontSize: "11px", lineHeight: 1.5, color: "#374151" }}>
        <strong style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{title}</strong>
        {rationale}
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TerminalAnalytics({ onDealTemplates }: { onDealTemplates?: () => void }) {
  const terminalOptions = ["All terminals", ...terminalCards.map((t) => t.name)];
  const [terminalFilter, setTerminalFilter] = useState("All terminals");
  const [dateRange, setDateRange] = useState("Last 30 days");

  const visibleTerminalCards = terminalCards.filter((t) => terminalFilter === "All terminals" || t.name === terminalFilter);
  const visibleRankingRows = rankingRows.filter((r) => terminalFilter === "All terminals" || r.name === terminalFilter);

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Analytics", to: "/analytics" }, { label: "Terminal analytics" }]} />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Terminal &amp; port analytics</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
            style={{ backgroundColor: "#FED7D7", color: "#9B2C2C", fontSize: "11px" }}>
            <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#C53030" }} />
            3 high congestion
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect value={terminalFilter} onChange={setTerminalFilter} options={terminalOptions} />
          <FilterSelect value={dateRange} onChange={setDateRange} options={["Last 30 days", "Last 90 days", "Year to date"]} />
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
          { label: "Terminals monitored", value: "18", vc: "#1A4ED8",  sub: "Across 8 active corridors" },
          { label: "Avg arrival → POB",   value: "8.4h", vc: "#B45309", sub: "▲ 2.1h vs prior 30 days" },
          { label: "Avg POB → all fast",  value: "3.2h", vc: "#374151", sub: "Within normal range" },
          { label: "Worst congestion",    value: "Rotterdam T4", vc: "#C53030", sub: "Index 9.1 — critical" },
        ].map(({ label, value, vc, sub }) => (
          <div key={label} className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left Column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — Terminal overview */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Terminal performance overview
              </span>
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Avg turnaround time vs benchmark</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {visibleTerminalCards.length === 0 && (
                <p style={{ fontSize: "12px", color: "#9CA3AF", gridColumn: "1 / -1" }}>No terminal matches this filter.</p>
              )}
              {visibleTerminalCards.map((t) => <TerminalCard key={t.name} t={t} />)}
            </div>
          </div>

          {/* Card 2 — Arrival → POB horizontal bar chart */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Arrival → POB benchmark by terminal
              </span>
              <span className="rounded-full px-2 py-0.5 font-medium"
                style={{ fontSize: "10px", backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
                Target: 6h
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart layout="vertical" data={arrivalPOBData} margin={{ left: 0, right: 48, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#F3F4F6" />
                <XAxis type="number" domain={[0, 18]} tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <YAxis type="category" dataKey="terminal" tick={{ fontSize: 11, fill: "#374151" }}
                  axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F9FAFB" }} />
                {/* Target reference line at 6h rendered as custom tick */}
                <Bar dataKey="hours" radius={[0, 3, 3, 0]} maxBarSize={18} label={<HBarLabel />}>
                  {arrivalPOBData.map((entry) => (
                    <rect key={entry.terminal} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Target legend */}
            <div className="flex items-center gap-1.5 mt-1">
              <div style={{ width: "2px", height: "10px", backgroundColor: "#1A4ED8", borderRadius: "1px" }} />
              <span style={{ fontSize: "10px", color: "#6B7280" }}>6h benchmark target</span>
              {[
                { color: "#EF4444", label: "Critical (>12h)" },
                { color: "#F59E0B", label: "Elevated (8–12h)" },
                { color: "#D1D5DB", label: "Marginal (6–8h)" },
                { color: "#10B981", label: "Good (<6h)" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1 ml-3">
                  <span className="rounded-sm flex-shrink-0" style={{ width: "8px", height: "8px", backgroundColor: item.color }} />
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3 — Trend line chart */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Turnaround time trend
              </span>
              <div className="flex items-center gap-4">
                {[
                  { color: "#EF4444", label: "Rotterdam T4" },
                  { color: "#F59E0B", label: "Singapore T3" },
                  { color: "#3B82F6", label: "Houston T1" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className="rounded-sm flex-shrink-0" style={{ width: "8px", height: "8px", backgroundColor: item.color }} />
                    <span style={{ fontSize: "11px", color: "#6B7280" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}h`} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="rotterdam" name="Rotterdam T4" stroke="#EF4444"
                  strokeWidth={2} dot={false} strokeDasharray="0" />
                <Line type="monotone" dataKey="singapore" name="Singapore T3" stroke="#F59E0B"
                  strokeWidth={2} dot={false} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="houston" name="Houston T1" stroke="#3B82F6"
                  strokeWidth={2} dot={false} strokeDasharray="2 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Card 4 — Cost ranking */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <span className="block mb-3" style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Most expensive terminals
            </span>
            {visibleRankingRows.length === 0 && (
              <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No terminal matches this filter.</p>
            )}
            {visibleRankingRows.map((row, i) => (
              <div key={row.rank} className="flex items-center gap-2 py-2"
                style={{ borderBottom: i < visibleRankingRows.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                <div className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{
                    width: "20px", height: "20px",
                    backgroundColor: row.special ? "transparent" : "#F3F4F6",
                    border: row.special ? "1.5px solid #10B981" : "none",
                  }}>
                  <span style={{ fontSize: "10px", color: row.special ? "#22543D" : "#9CA3AF", fontWeight: 500 }}>{row.rank}</span>
                </div>
                <div className="flex-1 min-w-0 ml-1">
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{row.name}</span>
                  <span style={{ fontSize: "11px", color: "#9CA3AF", marginLeft: "8px" }}>{row.meta}</span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 500, color: row.valueColor, flexShrink: 0 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: "200px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Card 1 — Key time deltas */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
              Key time deltas
            </p>
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "10px" }}>Fleet avg — all terminals</p>
            {benchmarkRows.map((row, i) => (
              <BenchmarkBar key={row.label} {...row} last={i === benchmarkRows.length - 1} />
            ))}
            <div className="flex items-center gap-1.5 mt-3 pt-2.5" style={{ borderTop: "0.5px solid #F3F4F6" }}>
              <div style={{ width: "2px", height: "10px", backgroundColor: "#1A4ED8", borderRadius: "1px", flexShrink: 0 }} />
              <span style={{ fontSize: "10px", color: "#9CA3AF" }}>Blue line = benchmark target</span>
            </div>
          </div>

          {/* Card 2 — Strategic recommendations */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2.5" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Strategic recommendations
            </p>
            <div className="flex flex-col gap-2">
              <RecItem
                title="Avoid Rotterdam T4 Q4"
                rationale="Congestion index 9.1 — 34% above Q3 average. Re-route vessels to Rotterdam T2 where possible to reduce avg turnaround by est. 14h."
              />
              <RecItem
                title="Buffer Singapore T3 laycans"
                rationale="Add 12h buffer to all laycan windows for Singapore T3 bookings. Current +7h avg overshoot creates systematic demurrage exposure."
              />
              <RecItem
                title="Benchmark Houston T1 practices"
                rationale="Houston T1 operating 2h below benchmark. Request terminal SOP for internal review — apply learnings to supplier agreements at congested ports."
              />
            </div>
          </div>

          {/* Card 3 — Port summary */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Port summary
            </p>
            <SideKV label="Ports monitored" value="12" />
            <SideKV label="Terminals" value="18" />
            <SideKV label="High congestion" value="3" valueColor="#C53030" />
            <SideKV label="Normal flow" value="14" valueColor="#22543D" />
            <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "8px 0" }} />
            <SideKV label="Total delay hrs" value="1,240h" />
            <SideKV label="$ demurrage impact" value="$2.24M" valueColor="#C53030" noBorder />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button onClick={onDealTemplates}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "36px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
              Deal templates <ArrowUpRight size={13} />
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{ height: "34px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
              Export report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
