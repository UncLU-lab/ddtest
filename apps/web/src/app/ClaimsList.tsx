import { Filter, Download, ArrowUpRight, Plus, ChevronDown } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "./Layout";

type ClaimStatus = "open" | "review" | "dispute" | "settled";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS = {
  open:    { label: "Open",       bg: "#EFF6FF", text: "#1E40AF", dot: "#1A4ED8",  barColor: "#3B82F6" },
  review:  { label: "Review",     bg: "#FFFBEB", text: "#7B341E", dot: "#F59E0B",  barColor: "#F59E0B" },
  dispute: { label: "In dispute", bg: "#FEF2F2", text: "#9B2C2C", dot: "#EF4444",  barColor: "#EF4444" },
  settled: { label: "Settled",    bg: "#C6F6D5", text: "#22543D", dot: "#10B981",  barColor: "#10B981" },
} as const;

// ─── Pipeline data ────────────────────────────────────────────────────────────

const pipeline: {
  col: ClaimStatus;
  label: string;
  countLabel: string;
  countBg: string;
  countText: string;
  cards: { vessel: string; counterparty: string; value: string; valueColor: string; ref: string; age: string; bar?: number }[];
}[] = [
  {
    col: "open", label: "Open", countLabel: "8", countBg: "#EFF6FF", countText: "#1E40AF",
    cards: [
      { vessel: "BW Magnolia", counterparty: "Vitol Asia", value: "$127,604", valueColor: "#C53030", ref: "CLM-2311", age: "4 days" },
      { vessel: "MT Pacific Sentinel", counterparty: "SK Energy", value: "$84,200", valueColor: "#C53030", ref: "CLM-2298", age: "7 days" },
      { vessel: "SS Northern Star", counterparty: "Trafigura", value: "$62,500", valueColor: "#C53030", ref: "CLM-2287", age: "11 days" },
    ],
  },
  {
    col: "review", label: "Under review", countLabel: "7", countBg: "#FFFBEB", countText: "#7B341E",
    cards: [
      { vessel: "Maran Gas Apollonia", counterparty: "Shell Intl", value: "$142,500", valueColor: "#B45309", ref: "CLM-2260", age: "18 days", bar: 55 },
      { vessel: "Gaslog Geneva", counterparty: "EDF Trading", value: "$38,900", valueColor: "#B45309", ref: "CLM-2248", age: "22 days", bar: 70 },
      { vessel: "Valencia Knutsen", counterparty: "Kogas", value: "$21,000", valueColor: "#B45309", ref: "CLM-2241", age: "26 days", bar: 40 },
    ],
  },
  {
    col: "dispute", label: "In dispute", countLabel: "5", countBg: "#FED7D7", countText: "#9B2C2C",
    cards: [
      { vessel: "MT Caspian Relayer", counterparty: "Repsol", value: "$218,000", valueColor: "#C53030", ref: "CLM-2214", age: "39 days", bar: 80 },
      { vessel: "MV Arctic Pioneer", counterparty: "Neste Oil", value: "$96,400", valueColor: "#C53030", ref: "CLM-2198", age: "47 days", bar: 90 },
    ],
  },
  {
    col: "settled", label: "Settled", countLabel: "4", countBg: "#C6F6D5", countText: "#22543D",
    cards: [
      { vessel: "MV Oceanic Voyager", counterparty: "BP Trading", value: "$112,000 rec.", valueColor: "#22543D", ref: "CLM-2180", age: "Closed" },
      { vessel: "SS Gulf Trader", counterparty: "Trafigura", value: "$74,500 rec.", valueColor: "#22543D", ref: "CLM-2164", age: "Closed" },
      { vessel: "BW Magnolia", counterparty: "Vitol Asia", value: "$131,500 rec.", valueColor: "#22543D", ref: "CLM-2139", age: "Closed" },
    ],
  },
];

// ─── Table data ───────────────────────────────────────────────────────────────

const tableRows: {
  ref: string; vessel: string; counterparty: string; submitted: string;
  claimValue: string; ourCalc: string; variance: string; varianceColor: string;
  status: ClaimStatus; daysOpen: string; settled?: boolean;
}[] = [
  { ref: "CLM-2311", vessel: "BW Magnolia", counterparty: "Vitol Asia", submitted: "28 Oct", claimValue: "$127,604", ourCalc: "$103,354", variance: "+$24,250", varianceColor: "#22543D", status: "open", daysOpen: "4" },
  { ref: "CLM-2260", vessel: "Maran Gas Apollonia", counterparty: "Shell Intl", submitted: "14 Oct", claimValue: "$142,500", ourCalc: "$118,250", variance: "+$24,250", varianceColor: "#22543D", status: "review", daysOpen: "18" },
  { ref: "CLM-2214", vessel: "MT Caspian Relayer", counterparty: "Repsol", submitted: "03 Oct", claimValue: "$218,000", ourCalc: "$194,400", variance: "+$23,600", varianceColor: "#22543D", status: "dispute", daysOpen: "39" },
  { ref: "CLM-2198", vessel: "MV Arctic Pioneer", counterparty: "Neste Oil", submitted: "25 Sep", claimValue: "$96,400", ourCalc: "$96,400", variance: "$0", varianceColor: "#6B7280", status: "dispute", daysOpen: "47" },
  { ref: "CLM-2180", vessel: "MV Oceanic Voyager", counterparty: "BP Trading", submitted: "14 Sep", claimValue: "$112,000", ourCalc: "$112,000", variance: "$0", varianceColor: "#6B7280", status: "settled", daysOpen: "62", settled: true },
  { ref: "CLM-2164", vessel: "SS Gulf Trader", counterparty: "Trafigura", submitted: "01 Sep", claimValue: "$74,500", ourCalc: "$74,500", variance: "$0", varianceColor: "#6B7280", status: "settled", daysOpen: "75", settled: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClaimStatus }) {
  const c = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: c.bg, color: c.text }}>
      <span className="rounded-full flex-shrink-0" style={{ width: "5px", height: "5px", backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function PipelineCard({
  card,
  status,
  onSelect,
}: {
  card: (typeof pipeline)[0]["cards"][0];
  status: ClaimStatus;
  onSelect: () => void;
}) {
  const isSettled = status === "settled";
  const hasBar = card.bar !== undefined;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      className="rounded-lg p-[10px_11px] cursor-pointer transition-all"
      style={{
        backgroundColor: "#ffffff",
        border: `0.5px solid ${hovered ? "#93C5FD" : "#E5E7EB"}`,
        opacity: isSettled ? 0.8 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{card.vessel}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px" }}>{card.counterparty}</p>
      <p style={{ fontSize: "13px", fontWeight: 500, color: card.valueColor, marginBottom: "4px" }}>{card.value}</p>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{card.ref}</span>
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{card.age}</span>
      </div>
      {hasBar && (
        <div className="mt-2.5 rounded-full overflow-hidden" style={{ height: "4px", backgroundColor: "#F3F4F6" }}>
          <div className="h-full rounded-full" style={{ width: `${card.bar}%`, backgroundColor: STATUS[status].barColor }} />
        </div>
      )}
    </div>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
      style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
      {children}
    </button>
  );
}

function FilterSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none outline-none cursor-pointer"
        style={{ height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 24px 0 9px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClaimsList({
  onOpenAudit,
  onNewClaim,
}: {
  onOpenAudit: () => void;
  onNewClaim?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [counterpartyFilter, setCounterpartyFilter] = useState("All counterparties");

  const counterpartyOptions = ["All counterparties", ...Array.from(new Set(tableRows.map((r) => r.counterparty)))];

  const filteredRows = tableRows.filter((row) => {
    const statusMatch = statusFilter === "All statuses" || STATUS[row.status].label === statusFilter;
    const counterpartyMatch = counterpartyFilter === "All counterparties" || row.counterparty === counterpartyFilter;
    return statusMatch && counterpartyMatch;
  });

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "All claims" }]} />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Claims pipeline</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
            style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}>
            <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
            24 active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GhostBtn><Filter size={11} /> Filter</GhostBtn>
          <GhostBtn><Download size={11} /> Export</GhostBtn>
          <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
            onClick={onNewClaim}>
            <Plus size={11} /> New claim <ArrowUpRight size={11} />
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="flex gap-2.5 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        {[
          { label: "Total claimed value", value: "$2.4M", vc: "#C53030", sub: "Across 24 active claims" },
          { label: "Recoverable value", value: "$1.2M", vc: "#B45309", sub: "Based on AI reconstruction" },
          { label: "Settled this month", value: "$318,000", vc: "#22543D", sub: "+3 claims closed" },
          { label: "Avg cycle time", value: "18 days", vc: "#374151", sub: "From open to settlement" },
        ].map(({ label, value, vc, sub }) => (
          <div key={label} className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "20px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Kanban Pipeline ── */}
      <div className="flex flex-shrink-0" style={{ borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        {pipeline.map((col, ci) => (
          <div key={col.col} className="flex-1 flex flex-col"
            style={{ padding: "12px 14px", borderRight: ci < pipeline.length - 1 ? "0.5px solid #E5E7EB" : "none" }}>
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                {col.label}
              </span>
              <span className="rounded-full px-2 py-0.5 font-semibold"
                style={{ fontSize: "10px", backgroundColor: col.countBg, color: col.countText }}>
                {col.countLabel}
              </span>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-2">
              {col.cards.map((card) => (
                <PipelineCard key={card.ref} card={card} status={col.col} onSelect={onOpenAudit} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail Table ── */}
      <div className="flex-1" style={{ padding: "16px 24px" }}>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            All claims — detail view
          </span>
          <div className="flex items-center gap-2">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={["All statuses", ...Object.values(STATUS).map((s) => s.label)]}
            />
            <FilterSelect
              value={counterpartyFilter}
              onChange={setCounterpartyFilter}
              options={counterpartyOptions}
            />
            <GhostBtn><Download size={11} /> Export</GhostBtn>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
          <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                {[
                  { label: "Claim ref", w: "130px" },
                  { label: "Vessel", w: "130px" },
                  { label: "Counterparty", w: "110px" },
                  { label: "Submitted", w: "80px" },
                  { label: "Claim value", w: "90px" },
                  { label: "Our calc", w: "90px" },
                  { label: "Variance", w: "70px" },
                  { label: "Status", w: "90px" },
                  { label: "Days open", w: "70px" },
                ].map(({ label, w }) => (
                  <th key={label} className="py-2.5 px-3 text-left" style={{ width: w }}>
                    <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center" style={{ fontSize: "12px", color: "#9CA3AF" }}>
                    No claims match the selected filters.
                  </td>
                </tr>
              )}
              {filteredRows.map((row, i) => (
                <tr
                  key={row.ref}
                  onClick={onOpenAudit}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: i < filteredRows.length - 1 ? "0.5px solid #F3F4F6" : "none",
                    opacity: row.settled ? 0.7 : 1,
                    backgroundColor: "#ffffff",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
                >
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#1A4ED8", fontWeight: 500 }}>{row.ref}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>{row.vessel}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#374151" }}>{row.counterparty}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>{row.submitted}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#C53030", fontWeight: 500 }}>{row.claimValue}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#1A4ED8", fontWeight: 500 }}>{row.ourCalc}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: row.varianceColor, fontWeight: 500 }}>{row.variance}</span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-3 px-3">
                    <span style={{ fontSize: "12px", color: "#374151" }}>{row.daysOpen}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
