import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { PageHeader } from "./Layout";
import {
  getAllBulkDisputes,
  getAllVessels,
  getLaytimeCalculations,
  getVoyages,
  type BulkDispute,
  type LaytimeCalculation,
  type Voyage,
} from "../lib/api";

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

const ACTIVE_CLAIM_STATUSES = new Set(["Open", "Evidence Submitted", "In Negotiation"]);

type AnalyticsKpis = {
  totalVoyages: number | null;
  totalVessels: number | null;
  activeClaims: number | null;
  totalDisputedValue: number | null;
  totalPositiveDemurrageExposure: number | null;
};

type StatusCount = {
  status: string;
  count: number;
};

type PortCount = {
  port: string;
  count: number;
};

function formatMetricValue(value: number | null, formatter?: Intl.NumberFormat): string {
  if (value === null || Number.isNaN(value)) {
    return "Not available";
  }

  return formatter ? formatter.format(value) : String(value);
}

function aggregateTopPorts(voyages: Voyage[], key: "loadPort" | "dischargePort"): PortCount[] {
  const counts = new Map<string, number>();

  voyages.forEach((voyage) => {
    const port = String(voyage[key] ?? "").trim() || "Not available";
    counts.set(port, (counts.get(port) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([port, count]) => ({ port, count }))
    .sort((a, b) => b.count - a.count || a.port.localeCompare(b.port))
    .slice(0, 5);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [kpis, setKpis] = useState<AnalyticsKpis>({
    totalVoyages: null,
    totalVessels: null,
    activeClaims: null,
    totalDisputedValue: null,
    totalPositiveDemurrageExposure: null,
  });
  const [claimsByStatus, setClaimsByStatus] = useState<StatusCount[] | null>(null);
  const [loadPorts, setLoadPorts] = useState<PortCount[] | null>(null);
  const [dischargePorts, setDischargePorts] = useState<PortCount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadMetrics() {
      setLoading(true);
      setLoadError(null);
      setClaimsByStatus(null);
      setLoadPorts(null);
      setDischargePorts(null);

      const [voyagesResult, vesselsResult, disputesResult] = await Promise.allSettled([
        getVoyages(),
        getAllVessels(),
        getAllBulkDisputes(),
      ]);

      const nextKpis: AnalyticsKpis = {
        totalVoyages: null,
        totalVessels: null,
        activeClaims: null,
        totalDisputedValue: null,
        totalPositiveDemurrageExposure: null,
      };

      const issues: string[] = [];

      if (voyagesResult.status === "fulfilled") {
        const voyages = Array.isArray(voyagesResult.value) ? voyagesResult.value : [];
        nextKpis.totalVoyages = voyages.length;
        setLoadPorts(aggregateTopPorts(voyages, "loadPort"));
        setDischargePorts(aggregateTopPorts(voyages, "dischargePort"));

        const laytimeResults = await Promise.allSettled(
          voyages.map((voyage: Voyage) => getLaytimeCalculations(voyage.id, { page: 1, limit: 1 }))
        );

        const exposureValues: number[] = [];
        let laytimeFailed = false;

        laytimeResults.forEach((result) => {
          if (result.status !== "fulfilled") {
            laytimeFailed = true;
            return;
          }

          const calculation = result.value.data?.[0];
          const demurrageValue = calculation ? Number((calculation as LaytimeCalculation).demurrageAmount) : NaN;

          if (Number.isFinite(demurrageValue) && demurrageValue > 0) {
            exposureValues.push(demurrageValue);
          }
        });

        if (!laytimeFailed) {
          nextKpis.totalPositiveDemurrageExposure = exposureValues.reduce((sum, value) => sum + value, 0);
        } else {
          issues.push("laytime calculations");
        }
      } else {
        issues.push("voyages");
        setLoadPorts(null);
        setDischargePorts(null);
      }

      if (vesselsResult.status === "fulfilled") {
        const vessels = Array.isArray(vesselsResult.value) ? vesselsResult.value : [];
        nextKpis.totalVessels = vessels.length;
      } else {
        issues.push("vessels");
      }

      if (disputesResult.status === "fulfilled") {
        const disputes = Array.isArray(disputesResult.value) ? disputesResult.value : [];
        const statuses: Record<string, number> = {
          Open: 0,
          "Evidence Submitted": 0,
          "In Negotiation": 0,
          Resolved: 0,
        };

        const activeClaims = disputes.filter((dispute: BulkDispute) =>
          ACTIVE_CLAIM_STATUSES.has(String(dispute.status ?? ""))
        );

        disputes.forEach((dispute: BulkDispute) => {
          const status = String(dispute.status ?? "Not available");
          if (status in statuses) {
            statuses[status] += 1;
          }
        });

        nextKpis.activeClaims = activeClaims.length;
        nextKpis.totalDisputedValue = activeClaims.reduce((sum: number, dispute: BulkDispute) => {
          const amount = Number(dispute.amountDisputed);
          return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        setClaimsByStatus([
          { status: "Open", count: statuses.Open },
          { status: "Evidence Submitted", count: statuses["Evidence Submitted"] },
          { status: "In Negotiation", count: statuses["In Negotiation"] },
          { status: "Resolved", count: statuses.Resolved },
        ]);
      } else {
        issues.push("claims");
        setClaimsByStatus(null);
      }

      if (!alive) {
        return;
      }

      setKpis(nextKpis);
      if (issues.length > 0) {
        setLoadError(`Some analytics data could not be loaded: ${issues.join(", ")}.`);
      }
      setLoading(false);
    }

    void loadMetrics();

    return () => {
      alive = false;
    };
  }, []);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const countFormatter = new Intl.NumberFormat("en-US");

  const kpiCards = [
    {
      label: "Total voyages",
      value: loading ? "Loading..." : formatMetricValue(kpis.totalVoyages, countFormatter),
      sub: "Persisted voyage count",
    },
    {
      label: "Total vessels",
      value: loading ? "Loading..." : formatMetricValue(kpis.totalVessels, countFormatter),
      sub: "Persisted vessel count",
    },
    {
      label: "Active claims",
      value: loading ? "Loading..." : formatMetricValue(kpis.activeClaims, countFormatter),
      sub: "Open, Evidence Submitted, In Negotiation",
    },
    {
      label: "Total disputed value",
      value: loading ? "Loading..." : formatMetricValue(kpis.totalDisputedValue, currencyFormatter),
      sub: "Sum of active disputed amounts",
    },
    {
      label: "Total positive demurrage exposure",
      value: loading ? "Loading..." : formatMetricValue(kpis.totalPositiveDemurrageExposure, currencyFormatter),
      sub: "Latest laytime calculations only",
    },
  ];

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
        <div aria-hidden="true" />
      </div>

      {/* ── KPI Strip ── */}
      {loadError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            margin: "0 24px 12px",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #FECACA",
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
            fontSize: "12px",
          }}
        >
          {loadError}
        </div>
      )}
      <div className="flex gap-2.5 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        {kpiCards.map(({ label, value, sub }) => (
          <div key={label} className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
            <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: "20px", fontWeight: 500, color: "#111827", lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>
      <div style={{ padding: "16px 24px 0" }}>
        <div className="grid gap-3 lg:grid-cols-2">
          <section
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionLabel>Claims by status</SectionLabel>
            {loading ? (
              <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                Loading persisted claims...
              </p>
            ) : claimsByStatus ? (
              claimsByStatus.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {claimsByStatus.map((item) => (
                    <li key={item.status} className="flex items-center justify-between py-1.5" style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                      <span style={{ fontSize: "12px", color: "#374151" }}>{item.status}</span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{item.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                  No claims found.
                </p>
              )
            ) : (
              <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                Not available.
              </p>
            )}
          </section>

          <section
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionLabel>Voyages by port</SectionLabel>
            {loading ? (
              <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                Loading persisted voyages...
              </p>
            ) : loadPorts || dischargePorts ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                    Load ports
                  </p>
                  {loadPorts && loadPorts.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {loadPorts.map((item) => (
                        <li key={item.port} className="flex items-center justify-between py-1.5" style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                          <span style={{ fontSize: "12px", color: "#374151" }}>{item.port}</span>
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{item.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                      No voyages found.
                    </p>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                    Discharge ports
                  </p>
                  {dischargePorts && dischargePorts.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {dischargePorts.map((item) => (
                        <li key={item.port} className="flex items-center justify-between py-1.5" style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                          <span style={{ fontSize: "12px", color: "#374151" }}>{item.port}</span>
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{item.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                      No voyages found.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
                Not available.
              </p>
            )}
          </section>
        </div>
      </div>
      <div style={{ padding: "16px 24px" }}>
        <section
          className="rounded-xl border p-[14px_16px]"
          style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
        >
          <SectionLabel>Persisted analytics context</SectionLabel>
          <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Not available from persisted data.
          </p>
          <p style={{ marginTop: "4px", fontSize: "11px", color: "#6B7280", lineHeight: 1.5 }}>
            The remaining supplier, terminal, and operational visuals are not backed by current persisted metrics yet.
          </p>
        </section>
      </div>
    </div>
  );
}
