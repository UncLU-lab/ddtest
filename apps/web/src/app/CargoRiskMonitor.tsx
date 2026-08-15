import { useState } from "react";
import { useNavigate } from "react-router";
import { Filter, Download, ChevronDown, ExternalLink } from "lucide-react";
import { PageHeader } from "./Layout";
import { useShipments } from "./data/ShipmentsContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskTier = "breach" | "emerging" | "safe";

// ─── Config ───────────────────────────────────────────────────────────────────

const RISK = {
  breach: {
    topBorder: "#EF4444",
    badgeBg: "#FED7D7",
    badgeText: "#9B2C2C",
    badgeDot: "#C53030",
    label: "Likely breach",
    barColor: "#EF4444",
    pillBg: "#FED7D7",
    pillText: "#9B2C2C",
  },
  emerging: {
    topBorder: "#F59E0B",
    badgeBg: "#FEEBC8",
    badgeText: "#7B341E",
    badgeDot: "#C05621",
    label: "Emerging risk",
    barColor: "#F59E0B",
    pillBg: "#FEEBC8",
    pillText: "#7B341E",
  },
  safe: {
    topBorder: "#10B981",
    badgeBg: "#C6F6D5",
    badgeText: "#22543D",
    badgeDot: "#276749",
    label: "Safe",
    barColor: "#10B981",
    pillBg: "#C6F6D5",
    pillText: "#22543D",
  },
} as const;

// ─── Data ────────────────────────────────────────────────────────────────────

const vessels = [
  {
    name: "MV Oceanic Voyager",
    imo: "IMO 9412301 · Atlantic NW",
    tier: "safe" as RiskTier,
    supplierLaycan: "12–16 Oct 2023",
    receiverLaycan: "15–19 Oct 2023",
    eta: "Oct 15, 08:20",
    etaPct: 72,
    statusLabel: "On schedule",
  },
  {
    name: "SS Northern Star",
    imo: "IMO 9338821 · North Sea",
    tier: "breach" as RiskTier,
    supplierLaycan: "10–14 Oct 2023",
    receiverLaycan: "13–16 Oct 2023",
    eta: "Oct 14, 22:45",
    etaPct: 91,
    statusLabel: "Conflict detected",
  },
  {
    name: "MT Caspian Relayer",
    imo: "IMO 9501234 · Med East",
    tier: "emerging" as RiskTier,
    supplierLaycan: "14–18 Oct 2023",
    receiverLaycan: "16–20 Oct 2023",
    eta: "Oct 17, 14:00",
    etaPct: 54,
    statusLabel: "Tight window",
  },
  {
    name: "MV Arctic Pioneer",
    imo: "IMO 9220178 · Barents",
    tier: "safe" as RiskTier,
    supplierLaycan: "12–15 Oct 2023",
    receiverLaycan: "13–16 Oct 2023",
    eta: "Oct 14, 06:30",
    etaPct: 88,
    statusLabel: "Normal flow",
  },
  {
    name: "SS Gulf Trader",
    imo: "IMO 9389011 · Arabian Gulf",
    tier: "emerging" as RiskTier,
    supplierLaycan: "18–23 Oct 2023",
    receiverLaycan: "20–25 Oct 2023",
    eta: "Oct 22, 18:15",
    etaPct: 31,
    statusLabel: "Port delay risk",
  },
  {
    name: "MT Pacific Sentinel",
    imo: "IMO 9467892 · Trans-Pacific",
    tier: "breach" as RiskTier,
    supplierLaycan: "15–19 Oct 2023",
    receiverLaycan: "18–22 Oct 2023",
    eta: "Oct 19, 03:00",
    etaPct: 78,
    statusLabel: "Critical delay",
  },
];

const feedItems = [
  {
    section: "Laycan conflicts",
    sectionColor: "#EF4444",
    borderColor: "#EF4444",
    items: [
      {
        vessel: "SS Northern Star",
        desc: "ETA now 2h outside supplier laycan. Demurrage exposure from $36,000.",
        link: true,
      },
      {
        vessel: "MT Pacific Sentinel",
        desc: "Loading delay at Corpus Christi. Clock started 6h early — unresolved.",
        link: true,
      },
    ],
  },
  {
    section: "Terminal congestion",
    sectionColor: "#F59E0B",
    borderColor: "#F59E0B",
    items: [
      {
        vessel: "Port of Antwerp",
        desc: "+4.2h avg turnaround reported. 3 vessels in queue — delay propagating.",
        link: false,
      },
    ],
  },
  {
    section: "Early arrival exposure",
    sectionColor: "#3B82F6",
    borderColor: "#3B82F6",
    items: [
      {
        vessel: "MV Oceanic Voyager",
        desc: "$15,200 exposure. Arrival 14h ahead of laycan open — reduce speed advised.",
        link: true,
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBadge({ tier }: { tier: RiskTier }) {
  const c = RISK[tier];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
      style={{ backgroundColor: c.badgeBg, color: c.badgeText, fontSize: "10px" }}
    >
      <span
        className="inline-block rounded-full flex-shrink-0"
        style={{ width: "5px", height: "5px", backgroundColor: c.badgeDot }}
      />
      {c.label}
    </span>
  );
}

function EtaRow({ pct, color, eta }: { pct: number; color: string; eta: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: "90px", fontSize: "12px", color: "#6B7280", flexShrink: 0 }}>
        Calculated ETA
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: "4px", backgroundColor: "#F3F4F6" }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span style={{ fontSize: "12px", color: "#111827", flexShrink: 0 }}>{eta}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: "90px", fontSize: "12px", color: "#6B7280", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: "12px", color: "#111827" }}>{value}</span>
    </div>
  );
}

function VesselCard({ vessel }: { vessel: (typeof vessels)[0] }) {
  const c = RISK[vessel.tier];
  return (
    <div
      className="flex flex-col cursor-pointer transition-colors"
      style={{
        backgroundColor: "#ffffff",
        border: "0.5px solid #E5E7EB",
        borderRadius: "0 0 12px 12px",
        borderTop: `2px solid ${c.topBorder}`,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#FAFAFA")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
    >
      <div className="flex flex-col gap-2 p-[13px_14px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{vessel.name}</p>
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "2px" }}>{vessel.imo}</p>
          </div>
          <RiskBadge tier={vessel.tier} />
        </div>

        {/* Data rows */}
        <div className="flex flex-col gap-1.5 mt-0.5">
          <DataRow label="Supplier laycan" value={vessel.supplierLaycan} />
          <DataRow label="Receiver laycan" value={vessel.receiverLaycan} />
          <EtaRow pct={vessel.etaPct} color={c.barColor} eta={vessel.eta} />
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-[14px] py-[8px]"
        style={{ borderTop: "0.5px solid #E5E7EB" }}
      >
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
          Laytime clock active
        </span>
        <span
          className="rounded px-1.5 py-0.5 font-medium"
          style={{ fontSize: "10px", backgroundColor: c.pillBg, color: c.pillText, borderRadius: "4px" }}
        >
          {vessel.statusLabel}
        </span>
      </div>
    </div>
  );
}

function FeedItem({
  vessel,
  desc,
  link,
  borderColor,
}: {
  vessel: string;
  desc: string;
  link: boolean;
  borderColor: string;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{
        borderLeft: `2px solid ${borderColor}`,
        paddingLeft: "12px",
        paddingTop: "8px",
        paddingBottom: "8px",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{vessel}</span>
        {link && (
          <button
            className="flex items-center gap-0.5 transition-colors flex-shrink-0"
            style={{ fontSize: "11px", color: "#1A4ED8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={() => onMitigate()}
          >
            Mitigate
            <ExternalLink size={10} style={{ marginLeft: "2px" }} />
          </button>
        )}
      </div>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}

function StatusItem({
  label,
  value,
  valueColor,
  dot,
  dotColor,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  dot?: boolean;
  dotColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {dot && (
        <span
          className="inline-block rounded-full"
          style={{ width: "6px", height: "6px", backgroundColor: dotColor }}
        />
      )}
      <span style={{ fontSize: "11px", color: "#6B7280" }}>{label}</span>
      {value && (
        <span style={{ fontSize: "11px", color: valueColor ?? "#111827", fontWeight: 500 }}>
          {value}
        </span>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CargoRiskMonitor() {
  const navigate = useNavigate();
  const { shipments } = useShipments();
  const [corridorFilter, setCorridorFilter] = useState("All corridors");
  const [tierFilter, setTierFilter] = useState<Set<RiskTier>>(new Set(["breach", "emerging", "safe"]));
  const [showFilters, setShowFilters] = useState(false);

  const vesselCorridor = (v: (typeof vessels)[0]) => v.imo.split("·")[1]?.trim() ?? "";
  const filteredVessels = vessels.filter(
    (v) => (corridorFilter === "All corridors" || vesselCorridor(v) === corridorFilter) && tierFilter.has(v.tier)
  );

  function toggleTier(tier: RiskTier) {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });
  }

  function exportReport() {
    const header = ["Vessel", "IMO / corridor", "Risk tier", "Supplier laycan", "Receiver laycan", "ETA", "Status"];
    const rows = filteredVessels.map((v) => [v.name, v.imo, v.tier, v.supplierLaycan, v.receiverLaycan, v.eta, v.statusLabel]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cargo-risk-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const onMitigate = () => navigate("/analytics/recommendations");
  const onVesselCard = (vesselName: string) => {
    const match = shipments.find((s) => s.vessel === vesselName);
    navigate(`/shipments/${match ? match.id : shipments[0].id}`);
  };

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Vessels" }]} />

      {/* ── Page Header ── */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "16px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Cargo risk monitor</h1>
            {/* Live console badge */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: "#C6F6D5", fontSize: "11px", fontWeight: 500, color: "#22543D" }}
            >
              <span
                className="rounded-full animate-pulse"
                style={{ width: "6px", height: "6px", backgroundColor: "#22543D" }}
              />
              Live console
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            Monitoring 42 active shipments across 12 maritime corridors
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Corridor filter */}
          <div className="relative">
            <select
              value={corridorFilter}
              onChange={(e) => setCorridorFilter(e.target.value)}
              className="appearance-none outline-none cursor-pointer"
              style={{
                height: "34px",
                border: "0.5px solid #E5E7EB",
                borderRadius: "8px",
                padding: "0 28px 0 10px",
                fontSize: "12px",
                color: "#374151",
                backgroundColor: "#ffffff",
              }}
            >
              <option>All corridors</option>
              <option>Atlantic NW</option>
              <option>North Sea</option>
              <option>Med East</option>
              <option>Barents</option>
              <option>Arabian Gulf</option>
              <option>Trans-Pacific</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "34px", fontSize: "13px", color: showFilters ? "#1A4ED8" : "#374151", borderColor: showFilters ? "#1A4ED8" : "#E5E7EB", borderWidth: "0.5px", backgroundColor: showFilters ? "#EFF6FF" : "#ffffff" }}
            >
              <Filter size={12} />
              Filters{tierFilter.size < 3 ? ` (${tierFilter.size})` : ""}
            </button>
            {showFilters && (
              <div className="absolute right-0 rounded-lg border p-3 z-10"
                style={{ top: "calc(100% + 6px)", width: "180px", backgroundColor: "#ffffff", borderColor: "#E5E7EB", borderWidth: "0.5px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Risk tier</p>
                <div className="flex flex-col gap-1.5">
                  {(["breach", "emerging", "safe"] as RiskTier[]).map((tier) => (
                    <label key={tier} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: "12px", color: "#374151" }}>
                      <input type="checkbox" checked={tierFilter.has(tier)} onChange={() => toggleTier(tier)} />
                      {tier[0].toUpperCase() + tier.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{ height: "34px", fontSize: "13px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
          >
            <Download size={12} />
            Export report
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div
        className="flex gap-4 flex-shrink-0"
        style={{ padding: "16px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        {[
          { label: "Total vessels", value: "42", vc: undefined, sub: "Across 12 corridors" },
          { label: "Breach risk", value: "3", vc: "#C53030", sub: "Immediate attention" },
          { label: "Emerging risk", value: "4", vc: "#B45309", sub: "Monitoring required" },
          { label: "Global efficiency", value: "94%", vc: "#22543D", sub: "+1.2pts vs last week" },
        ].map(({ label, value, vc, sub }) => (
          <div
            key={label}
            className="flex-1 rounded-lg border flex flex-col gap-1 p-[14px_16px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
          >
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "22px", fontWeight: 500, color: vc ?? "#111827", lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left: Risk Grid ── */}
        <div className="flex-1 min-w-0">
          <p
            className="mb-3"
            style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Active shipments — risk grid
          </p>
          <div className="grid grid-cols-2 gap-3">
            {filteredVessels.length === 0 && (
              <p style={{ fontSize: "12px", color: "#9CA3AF", gridColumn: "1 / -1" }}>No vessels in this corridor right now.</p>
            )}
            {filteredVessels.map((v) => (
              <div key={v.name} onClick={() => onVesselCard(v.name)} className="cursor-pointer">
                <VesselCard vessel={v} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Intelligence Feed ── */}
        <div style={{ width: "200px", flexShrink: 0 }}>
          <p
            className="mb-3"
            style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Risk intelligence feed
          </p>

          <div className="flex flex-col gap-4">
            {feedItems.map((section) => (
              <div key={section.section}>
                <p
                  className="mb-2"
                  style={{
                    fontSize: "10px",
                    color: section.sectionColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 500,
                  }}
                >
                  {section.section}
                </p>
                <div className="flex flex-col gap-0">
                  {section.items.map((item) => (
                    <FeedItem
                      key={item.vessel}
                      vessel={item.vessel}
                      desc={item.desc}
                      link={item.link}
                      borderColor={section.borderColor}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Export ghost button */}
          <button
            onClick={exportReport}
            className="w-full flex items-center justify-center gap-1.5 mt-5 rounded-lg border transition-colors cursor-pointer"
            style={{ height: "34px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
          >
            <Download size={12} />
            Export report
          </button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "8px 24px", borderTop: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        <StatusItem label="System active" dot dotColor="#10B981" />
        <div style={{ width: "0.5px", height: "12px", backgroundColor: "#E5E7EB" }} />
        <StatusItem label="Total vessels:" value="42" />
        <div style={{ width: "0.5px", height: "12px", backgroundColor: "#E5E7EB" }} />
        <StatusItem label="Breach risk:" value="3" valueColor="#C53030" />
        <div style={{ width: "0.5px", height: "12px", backgroundColor: "#E5E7EB" }} />
        <StatusItem label="Emerging risk:" value="4" valueColor="#B45309" />
        <div style={{ width: "0.5px", height: "12px", backgroundColor: "#E5E7EB" }} />
        <StatusItem label="Avg port time:" value="34.2h" />
        <div style={{ width: "0.5px", height: "12px", backgroundColor: "#E5E7EB" }} />
        <StatusItem label="Global efficiency:" value="94%" valueColor="#22543D" />
      </div>
    </div>
  );
}
