import { ArrowUpRight, Plus, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "./Layout";
import { getBulkDisputes, type BulkDispute } from "../lib/api";

type ClaimStatusVariant = "open" | "review" | "dispute" | "settled" | "neutral";

const STATUS = {
  open: { bg: "#EFF6FF", text: "#1E40AF", dot: "#1A4ED8", barColor: "#3B82F6" },
  review: { bg: "#FFFBEB", text: "#7B341E", dot: "#F59E0B", barColor: "#F59E0B" },
  dispute: { bg: "#FEF2F2", text: "#9B2C2C", dot: "#EF4444", barColor: "#EF4444" },
  settled: { bg: "#C6F6D5", text: "#22543D", dot: "#10B981", barColor: "#10B981" },
  neutral: { bg: "#F3F4F6", text: "#374151", dot: "#9CA3AF", barColor: "#9CA3AF" },
} as const;

type ClaimViewModel = {
  id: string;
  voyageId: string;
  type: string;
  amountDisputed: string;
  amountDisputedValue: number | null;
  statusLabel: string;
  statusVariant: ClaimStatusVariant;
  createdAtValue: string | null;
  createdDate: string;
};

type PipelineColumn = {
  label: string;
  variant: ClaimStatusVariant;
  countLabel: string;
  countBg: string;
  countText: string;
  cards: ClaimViewModel[];
};

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatMoney(value: unknown): string {
  const parsed = parseAmount(value);

  if (parsed === null) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatDate(value: unknown): { label: string; raw: string | null } {
  if (typeof value !== "string" || !value.trim()) {
    return { label: "Not available", raw: null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { label: "Not available", raw: value };
  }

  return {
    label: parsed.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    raw: value,
  };
}

function normalizeStatusVariant(status?: string): ClaimStatusVariant {
  const value = status?.trim().toLowerCase();

  if (!value) {
    return "neutral";
  }

  if (value === "open") {
    return "open";
  }

  if (value === "evidence submitted" || value === "in negotiation" || value === "review") {
    return "review";
  }

  if (value === "resolved" || value === "settled" || value === "closed") {
    return "settled";
  }

  if (value.includes("dispute")) {
    return "dispute";
  }

  return "neutral";
}

function getStatusLabel(status?: string): string {
  return status?.trim() || "Not available";
}

function toClaimViewModel(dispute: BulkDispute): ClaimViewModel {
  const amountDisputedValue = parseAmount(dispute.amountDisputed);
  const createdDate = formatDate(dispute.createdAt ?? dispute.createdDate);

  return {
    id: dispute.id?.trim() || "Not available",
    voyageId: dispute.voyageId?.trim() || "Not available",
    type: String(dispute.type?.trim?.() || dispute.type || "Not available"),
    amountDisputed:
      amountDisputedValue === null ? "Not available" : formatMoney(amountDisputedValue),
    amountDisputedValue,
    statusLabel: getStatusLabel(dispute.status),
    statusVariant: normalizeStatusVariant(dispute.status),
    createdAtValue: createdDate.raw,
    createdDate: createdDate.label,
  };
}

function groupClaimsByStatus(claims: ClaimViewModel[]): PipelineColumn[] {
  const groups = new Map<string, ClaimViewModel[]>();

  for (const claim of claims) {
    const key = claim.statusLabel;
    const existing = groups.get(key) ?? [];
    existing.push(claim);
    groups.set(key, existing);
  }

  const order = new Map<ClaimStatusVariant, number>([
    ["open", 0],
    ["review", 1],
    ["dispute", 2],
    ["settled", 3],
    ["neutral", 4],
  ]);

  return Array.from(groups.entries())
    .map(([label, cards]) => {
      const variant = cards[0]?.statusVariant ?? "neutral";
      const style = STATUS[variant];

      return {
        label,
        variant,
        countLabel: String(cards.length),
        countBg: style.bg,
        countText: style.text,
        cards,
      };
    })
    .sort((a, b) => {
      const orderDelta =
        (order.get(a.variant) ?? 99) - (order.get(b.variant) ?? 99);

      if (orderDelta !== 0) {
        return orderDelta;
      }

      return a.label.localeCompare(b.label);
    });
}

function StatusBadge({ label, variant }: { label: string; variant: ClaimStatusVariant }) {
  const c = STATUS[variant];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: c.bg, color: c.text }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: "5px", height: "5px", backgroundColor: c.dot }}
      />
      {label}
    </span>
  );
}

function PipelineCard({
  card,
  onSelect,
}: {
  card: ClaimViewModel;
  onSelect: (claimId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS[card.statusVariant];

  return (
    <div
      onClick={() => onSelect(card.id)}
      className="rounded-lg p-[10px_11px] cursor-pointer transition-all"
      style={{
        backgroundColor: "#ffffff",
        border: `0.5px solid ${hovered ? "#93C5FD" : "#E5E7EB"}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>
        {card.id}
      </p>
      <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "2px" }}>
        Voyage ID: {card.voyageId}
      </p>
      <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px" }}>
        Type: {card.type}
      </p>
      <p style={{ fontSize: "13px", fontWeight: 500, color: color.text, marginBottom: "4px" }}>
        {card.amountDisputed}
      </p>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{card.statusLabel}</span>
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{card.createdDate}</span>
      </div>
      <div className="mt-2.5 rounded-full overflow-hidden" style={{ height: "4px", backgroundColor: "#F3F4F6" }}>
        <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: color.barColor }} />
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none outline-none cursor-pointer"
        style={{
          height: "30px",
          border: "0.5px solid #E5E7EB",
          borderRadius: "8px",
          padding: "0 24px 0 9px",
          fontSize: "12px",
          color: "#374151",
          backgroundColor: "#ffffff",
        }}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown
        size={10}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "#9CA3AF" }}
      />
    </div>
  );
}

export default function ClaimsList({
  onOpenClaim,
  onNewClaim,
}: {
  onOpenClaim: (claimId: string) => void;
  onNewClaim?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [counterpartyFilter, setCounterpartyFilter] = useState("All counterparties");
  const [claims, setClaims] = useState<BulkDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadClaims() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await getBulkDisputes({ page: 1, limit: 200 });

        if (!cancelled) {
          setClaims(result.data ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setClaims([]);
          setLoadError("Unable to load persisted claims.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadClaims();

    return () => {
      cancelled = true;
    };
  }, []);

  const claimRows = useMemo(() => claims.map(toClaimViewModel), [claims]);
  const pipeline = useMemo(() => groupClaimsByStatus(claimRows), [claimRows]);
  const totalDisputedValue = useMemo(
    () =>
      claimRows.reduce((sum, row) => sum + (row.amountDisputedValue ?? 0), 0),
    [claimRows]
  );
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(claimRows.map((row) => row.statusLabel))).filter(Boolean),
    [claimRows]
  );
  const latestCreatedDate = useMemo(() => {
    const timestamps = claimRows
      .map((row) => row.createdAtValue)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) {
      return "Not available";
    }

    const latest = new Date(Math.max(...timestamps));
    return latest.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [claimRows]);

  const statusOptions = useMemo(
    () => ["All statuses", ...uniqueStatuses],
    [uniqueStatuses]
  );
  const counterpartyOptions = ["All counterparties", "Not available"];

  const filteredRows = claimRows.filter((row) => {
    const statusMatch =
      statusFilter === "All statuses" || row.statusLabel === statusFilter;
    const counterpartyMatch =
      counterpartyFilter === "All counterparties" || counterpartyFilter === "Not available";

    return statusMatch && counterpartyMatch;
  });

  const loadedClaimsCount = claimRows.length;

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Claims", to: "/claims" }, { label: "All claims" }]} />

      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>
            Claims pipeline
          </h1>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
            style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}
          >
            <span
              className="rounded-full"
              style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }}
            />
            {loadedClaimsCount} loaded
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onNewClaim ? (
            <button
              className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{
                height: "32px",
                fontSize: "12px",
                color: "#ffffff",
                backgroundColor: "#1A4ED8",
                border: "none",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
              onClick={onNewClaim}
            >
              <Plus size={11} /> New claim <ArrowUpRight size={11} />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="flex gap-2.5 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        {[
          {
            label: "Claims loaded",
            value: String(loadedClaimsCount),
            vc: "#1A4ED8",
            sub: "Persisted bulk-disputes from the API",
          },
          {
            label: "Total disputed value",
            value: formatMoney(totalDisputedValue),
            vc: "#C53030",
            sub: "Sum of loaded amountDisputed values",
          },
          {
            label: "Unique statuses",
            value: String(uniqueStatuses.length),
            vc: "#B45309",
            sub: "Based on backend status values",
          },
          {
            label: "Latest created",
            value: latestCreatedDate,
            vc: "#374151",
            sub: "From createdAt or createdDate when available",
          },
        ].map(({ label, value, vc, sub }) => (
          <div
            key={label}
            className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
            style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", borderWidth: "0.5px" }}
          >
            <p
              style={{
                fontSize: "11px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {label}
            </p>
            <p style={{ fontSize: "20px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>
              {value}
            </p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      <div
        className="flex flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        {pipeline.length === 0 && !isLoading ? (
          <div className="w-full p-6 text-center" style={{ fontSize: "12px", color: "#9CA3AF" }}>
            {loadError ?? "No persisted claims were returned by the API."}
          </div>
        ) : (
          pipeline.map((col, ci) => (
            <div
              key={col.label}
              className="flex-1 flex flex-col min-w-[220px]"
              style={{
                padding: "12px 14px",
                borderRight: ci < pipeline.length - 1 ? "0.5px solid #E5E7EB" : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  style={{
                    fontSize: "10px",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 500,
                  }}
                >
                  {col.label}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{ fontSize: "10px", backgroundColor: col.countBg, color: col.countText }}
                >
                  {col.countLabel}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {col.cards.map((card) => (
                  <PipelineCard key={card.id} card={card} onSelect={onOpenClaim} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex-1" style={{ padding: "16px 24px" }}>
        <div className="flex items-center justify-between mb-3">
          <span
            style={{
              fontSize: "11px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            All claims - detail view
          </span>
          <div className="flex items-center gap-2">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
            <FilterSelect
              value={counterpartyFilter}
              onChange={setCounterpartyFilter}
              options={counterpartyOptions}
            />
          </div>
        </div>

        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
        >
          <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                {[
                  { label: "Claim ID", w: "220px" },
                  { label: "Voyage ID", w: "220px" },
                  { label: "Type", w: "160px" },
                  { label: "Amount disputed", w: "140px" },
                  { label: "Status", w: "140px" },
                  { label: "Created date", w: "140px" },
                ].map(({ label, w }) => (
                  <th key={label} className="py-2.5 px-3 text-left" style={{ width: w }}>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ fontSize: "12px", color: "#9CA3AF" }}>
                    Loading persisted claims...
                  </td>
                </tr>
              )}
              {!isLoading && loadError && claimRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ fontSize: "12px", color: "#9CA3AF" }}>
                    {loadError}
                  </td>
                </tr>
              )}
              {!isLoading && !loadError && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ fontSize: "12px", color: "#9CA3AF" }}>
                    No claims match the selected filters.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !loadError &&
                filteredRows.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => onOpenClaim(row.id)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: i < filteredRows.length - 1 ? "0.5px solid #F3F4F6" : "none",
                      backgroundColor: "#ffffff",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}
                  >
                    <td className="py-3 px-3">
                      <span style={{ fontSize: "12px", color: "#1A4ED8", fontWeight: 500 }}>{row.id}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>
                        {row.voyageId}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span style={{ fontSize: "12px", color: "#374151" }}>{row.type}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span style={{ fontSize: "12px", color: "#C53030", fontWeight: 500 }}>
                        {row.amountDisputed}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge label={row.statusLabel} variant={row.statusVariant} />
                    </td>
                    <td className="py-3 px-3">
                      <span style={{ fontSize: "12px", color: "#374151" }}>{row.createdDate}</span>
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
