import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "./Layout";
import {
  getAllBulkDisputes,
  getLaytimeCalculations,
  getVoyages,
  type Voyage,
} from "../lib/api";

type PortSummary = {
  port: string;
  count: number;
  amount: number;
};

type AnalyticsState = {
  loading: boolean;
  error: string | null;
  loadPortSummaries: PortSummary[];
  dischargePortSummaries: PortSummary[];
  demurrageByPort: PortSummary[];
  claimsByPort: PortSummary[];
};

const unsupportedMetrics = [
  "Arrival → POB",
  "POB → all fast",
  "Congestion index",
  "Terminal turnaround",
  "Benchmark performance",
  "Strategic congestion recommendations",
];

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function normalizePort(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "Not available";
  }

  if (value === null || value === undefined) {
    return "Not available";
  }

  const text = String(value).trim();
  return text || "Not available";
}

function toNumber(value: unknown): number {
  const numeric =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : 0;
}

function aggregatePortSummaries(
  rows: Array<{ port: unknown; amount?: unknown }>
): PortSummary[] {
  const summary = new Map<string, PortSummary>();

  for (const row of rows) {
    const port = normalizePort(row.port);
    const amount = toNumber(row.amount);
    const existing = summary.get(port);

    if (existing) {
      existing.count += 1;
      existing.amount += amount;
    } else {
      summary.set(port, { port, count: 1, amount });
    }
  }

  return Array.from(summary.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return b.amount - a.amount;
  });
}

function sectionValue(value: number): string {
  return moneyFormatter.format(value);
}

function SummaryCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SummaryList({
  rows,
  emptyLabel,
  formatAmount,
}: {
  rows: PortSummary[];
  emptyLabel: string;
  formatAmount?: (value: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={`${row.port}-${index}`}
          className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{row.port}</p>
            <p className="text-xs text-gray-500">
              {row.count} voyage{row.count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{row.count}</p>
            {formatAmount ? (
              <p className="text-xs text-gray-500">{formatAmount(row.amount)}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function UnavailableMetric({ label }: { label: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-sm text-gray-500">Not available from persisted data.</p>
    </div>
  );
}

async function fetchAllBulkDisputes() {
  return getAllBulkDisputes();
}

export default function TerminalAnalytics({ onDealTemplates }: { onDealTemplates?: () => void }) {
  const [state, setState] = useState<AnalyticsState>({
    loading: true,
    error: null,
    loadPortSummaries: [],
    dischargePortSummaries: [],
    demurrageByPort: [],
    claimsByPort: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const [voyages, disputes] = await Promise.all([getVoyages(), fetchAllBulkDisputes()]);

        const voyageMap = new Map<string, Voyage>();
        for (const voyage of voyages) {
          voyageMap.set(voyage.id, voyage);
        }

        const latestLaytimeResults = await Promise.allSettled(
          voyages.map(async (voyage) => {
            const result = await getLaytimeCalculations(voyage.id, { page: 1, limit: 1 });
            const calculation = result.data[0];
            const demurrage = calculation ? toNumber(calculation.demurrageAmount) : 0;

            return {
              voyageId: voyage.id,
              dischargePort: normalizePort(voyage.dischargePort),
              demurrage: demurrage > 0 ? demurrage : 0,
            };
          })
        );

        const loadPortSummaries = aggregatePortSummaries(
          voyages.map((voyage) => ({ port: voyage.loadPort }))
        ).slice(0, 5);

        const dischargePortSummaries = aggregatePortSummaries(
          voyages.map((voyage) => ({ port: voyage.dischargePort }))
        ).slice(0, 5);

        const demurrageMap = new Map<string, PortSummary>();
        for (const settled of latestLaytimeResults) {
          if (settled.status !== "fulfilled") {
            continue;
          }

          const { dischargePort, demurrage } = settled.value;
          if (demurrage <= 0) {
            continue;
          }

          const existing = demurrageMap.get(dischargePort);
          if (existing) {
            existing.count += 1;
            existing.amount += demurrage;
          } else {
            demurrageMap.set(dischargePort, {
              port: dischargePort,
              count: 1,
              amount: demurrage,
            });
          }
        }

        const demurrageByPort = Array.from(demurrageMap.values())
          .sort((a, b) => {
            if (b.amount !== a.amount) {
              return b.amount - a.amount;
            }

            return b.count - a.count;
          })
          .slice(0, 5);

        const claimsByPortMap = new Map<string, PortSummary>();
        for (const dispute of disputes) {
          const voyage = voyageMap.get(dispute.voyageId);
          const port = normalizePort(voyage?.dischargePort);
          const value = toNumber(dispute.amountDisputed);
          const existing = claimsByPortMap.get(port);

          if (existing) {
            existing.count += 1;
            existing.amount += value;
          } else {
            claimsByPortMap.set(port, {
              port,
              count: 1,
              amount: value,
            });
          }
        }

        const claimsByPort = Array.from(claimsByPortMap.values())
          .sort((a, b) => {
            if (b.count !== a.count) {
              return b.count - a.count;
            }

            return b.amount - a.amount;
          })
          .slice(0, 5);

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            loadPortSummaries,
            dischargePortSummaries,
            demurrageByPort,
            claimsByPort,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load terminal analytics.";
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: message,
          }));
        }
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Analytics", to: "/analytics" }, { label: "Terminal analytics" }]} />

      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-medium text-gray-900">Terminal &amp; port analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          This view only shows persisted voyage, claim, and laytime data grouped by port. Terminal-specific metrics are
          not available from the current backend data.
        </p>
      </div>

      <div className="space-y-4 px-6 py-4">
        {state.loading ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600"
          >
            Loading persisted terminal analytics...
          </div>
        ) : null}

        {state.error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {state.error}
          </div>
        ) : null}

        {!state.loading && !state.error ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <SummaryCard
                title="Voyages by load port"
                subtitle="Top 5 load ports grouped from persisted voyages."
              >
                <SummaryList
                  rows={state.loadPortSummaries}
                  emptyLabel="No persisted voyage data available."
                />
              </SummaryCard>

              <SummaryCard
                title="Voyages by discharge port"
                subtitle="Top 5 discharge ports grouped from persisted voyages."
              >
                <SummaryList
                  rows={state.dischargePortSummaries}
                  emptyLabel="No persisted voyage data available."
                />
              </SummaryCard>

              <SummaryCard
                title="Demurrage exposure by discharge port"
                subtitle="Positive demurrage from each voyage's latest persisted laytime calculation."
              >
                <SummaryList
                  rows={state.demurrageByPort}
                  emptyLabel="No persisted laytime calculation data available."
                  formatAmount={(value) => sectionValue(value)}
                />
              </SummaryCard>

              <SummaryCard
                title="Claims by discharge port"
                subtitle="Claim count and disputed value grouped by the voyage's discharge port."
              >
                <SummaryList
                  rows={state.claimsByPort}
                  emptyLabel="No persisted claim data available."
                  formatAmount={(value) => sectionValue(value)}
                />
              </SummaryCard>
            </div>

            <SummaryCard
              title="Terminal metrics"
              subtitle="Terminal-specific operational metrics are not available from persisted data."
            >
              <div className="space-y-2">
                {unsupportedMetrics.map((label) => (
                  <UnavailableMetric key={label} label={label} />
                ))}
              </div>
            </SummaryCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
