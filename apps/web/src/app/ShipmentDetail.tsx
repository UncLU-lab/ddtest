import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  Edit3,
  ArrowUpRight,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { PageHeader } from "./Layout";
import { CharterPartyTermsPanel } from "./CharterPartyTermsPanel";
import { LaytimeCalculationResultPanel } from "./LaytimeCalculationResultPanel";
import { RISK_LABEL, RISK_BADGE } from "./data/shipments";
import { useShipments } from "./data/ShipmentsContext";
import {
  createCpClause,
  getVoyageCharterParty,
  getVoyageSummary,
  updateCpClause,
  updateVoyage,
  type CharterParty,
  type ClauseOperation,
  type CpClause,
  type CpClauseParameters,
} from "../lib/api";

type TabKey = "overview" | "sof" | "laytime" | "claims" | "documents";
type DotState = "done" | "active" | "warn" | "pending";

type TimelineEventData = {
  state: DotState;
  timestamp: string;
  name: string;
  detail: string;
  tags?: {
    label: string;
    bg: string;
    text: string;
  }[];
};

type ShipmentRouteState = {
  draft?: {
    voyageRef?: string;
    loadPort?: string;
    supplier?: string;
    receiver?: string;
    eta?: string;
    laytimeAllowed?: string;
    demurrageRate?: string;
    dispatchRate?: string;
    timeCountingBasis?: string;
    norNoticePeriod?: string;
    bulkOperationType?: "dry_bulk" | "tanker";
  };
};

type VoyageEditForm = {
  port: string;
  cargo: string;
  quantity: string;
  eta: string;
};

function formatValue(value: any, fallback = "Not available"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  return String(value);
}

function formatBulkOperationType(value?: string | null) {
  if (value === "dry_bulk") {
    return "Dry bulk";
  }

  if (value === "tanker") {
    return "Tanker / liquid bulk";
  }

  return "—";
}

function formatMoney(value: any, fallback = "Not available"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return `$${number.toLocaleString()}`;
}

function formatDate(value: any, fallback = "Not available"): string {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function formatDateTime(value: any, fallback = "Not available"): string {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function parseEditableQuantity(value: string): number | null {
  const normalized = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");

  if (!normalized.trim()) {
    return null;
  }

  const quantity = Number(normalized);

  return Number.isFinite(quantity) ? quantity : null;
}

function normalizeEditableEta(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const eta = new Date(trimmed);

  if (Number.isNaN(eta.getTime())) {
    return null;
  }

  return eta.toISOString();
}

type ClauseScope = "Global" | ClauseOperation;

const OPERATION_SCOPED_CLAUSE_TYPES = new Set([
  "laytime_rate",
  "demurrage_rate",
  "despatch",
  "shex_shinc",
  "weather_working",
  "wibon",
  "wipon",
]);

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  laytime_rate: "Laytime rate",
  demurrage_rate: "Demurrage rate",
  despatch: "Despatch",
  shex_shinc: "SHEX / SHINC",
  weather_working: "Weather working",
  wibon: "WIBON",
  wipon: "WIPON",
};

const CLAUSE_TYPE_OPTIONS = [
  "laytime_rate",
  "demurrage_rate",
  "despatch",
  "shex_shinc",
  "weather_working",
  "wibon",
  "wipon",
] as const;

function formatClauseTypeLabel(value?: string | null) {
  if (!value) return "Clause";
  return CLAUSE_TYPE_LABELS[value] ?? value.replace(/[_-]+/g, " ");
}

function normalizeClauseScope(operation?: string | null): ClauseScope {
  if (operation === "Loading" || operation === "Discharge") {
    return operation;
  }

  return "Global";
}

function isOperationScopedClause(clauseType?: string | null) {
  return Boolean(clauseType && OPERATION_SCOPED_CLAUSE_TYPES.has(clauseType));
}

function getClauseOperation(parameters?: CpClauseParameters | null): ClauseScope {
  return normalizeClauseScope(parameters?.operation ?? null);
}

function buildClauseParameters(
  parametersText: string,
  scope: ClauseScope,
): CpClauseParameters {
  const parsed =
    parametersText.trim() === ""
      ? {}
      : (JSON.parse(parametersText) as Record<string, unknown>);

  const next = { ...parsed } as CpClauseParameters;

  if (scope === "Global") {
    delete next.operation;
  } else {
    next.operation = scope;
  }

  return next;
}

function stringifyClauseParameters(parameters: CpClauseParameters) {
  return JSON.stringify(parameters ?? {}, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clock card
// ─────────────────────────────────────────────────────────────────────────────

function ClockCard({
  label,
  value,
  valueColor,
  sub,
  pct,
  barColor,
  startTime,
  startLabel,
  microRows,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
  pct: number;
  barColor: string;
  startTime: string;
  startLabel: string;
  microRows: { k: string; v: string }[];
}) {
  const safePct = Math.max(0, Math.min(100, Number(pct) || 0));

  return (
    <div
      className="rounded-lg border flex flex-col gap-3 p-[12px_14px]"
      style={{
        borderColor: "#E5E7EB",
        borderWidth: "0.5px",
      }}
    >
      <div>
        <p
          style={{
            fontSize: "10px",
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "4px",
          }}
        >
          {label}
        </p>

        <p
          style={{
            fontSize: "20px",
            fontWeight: 500,
            color: valueColor,
            lineHeight: 1.15,
          }}
        >
          {value}
        </p>

        <p
          style={{
            fontSize: "11px",
            color: "#9CA3AF",
            marginTop: "2px",
          }}
        >
          {sub}
        </p>
      </div>

      <div>
        <div
          className="rounded-full overflow-hidden mb-1.5"
          style={{
            height: "8px",
            backgroundColor: "#F9FAFB",
          }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${safePct}%`,
              backgroundColor: barColor,
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span
            style={{
              fontSize: "10px",
              color: "#9CA3AF",
            }}
          >
            Started {startTime}
          </span>

          <span
            style={{
              fontSize: "10px",
              color: valueColor,
              fontWeight: 500,
            }}
          >
            {safePct}% {startLabel}
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-x-4 gap-y-1.5"
        style={{
          borderTop: "0.5px solid #F3F4F6",
          paddingTop: "10px",
        }}
      >
        {microRows.map(({ k, v }) => (
          <div key={k}>
            <p
              style={{
                fontSize: "10px",
                color: "#9CA3AF",
                marginBottom: "1px",
              }}
            >
              {k}
            </p>

            <p
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              {v}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

const DOT: Record<
  DotState,
  {
    bg: string;
    border: string;
    dashed: boolean;
  }
> = {
  done: {
    bg: "#10B981",
    border: "#10B981",
    dashed: false,
  },
  active: {
    bg: "#1A4ED8",
    border: "#1A4ED8",
    dashed: false,
  },
  warn: {
    bg: "#F59E0B",
    border: "#F59E0B",
    dashed: false,
  },
  pending: {
    bg: "#ffffff",
    border: "#D1D5DB",
    dashed: true,
  },
};

function TimelineDot({ state }: { state: DotState }) {
  const d = DOT[state];

  return (
    <div
      className="absolute flex-shrink-0"
      style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: d.bg,
        border: `1.5px ${d.dashed ? "dashed" : "solid"} ${d.border}`,
        left: "-5px",
        top: "3px",
      }}
    />
  );
}

function TagPill({
  label,
  bg,
  text,
}: {
  label: string;
  bg: string;
  text: string;
}) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-medium"
      style={{
        fontSize: "10px",
        backgroundColor: bg,
        color: text,
      }}
    >
      {label}
    </span>
  );
}

function TimelineEvent({
  ev,
  last,
}: {
  ev: TimelineEventData;
  last?: boolean;
}) {
  return (
    <div
      className="relative pl-5 pb-5"
      style={{
        borderLeft: last ? "none" : "1px solid #E5E7EB",
      }}
    >
      <TimelineDot state={ev.state} />

      <p
        style={{
          fontSize: "10px",
          color: "#9CA3AF",
          marginBottom: "2px",
        }}
      >
        {ev.timestamp}
      </p>

      <p
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "#111827",
          marginBottom: "2px",
        }}
      >
        {ev.name}
      </p>

      <p
        style={{
          fontSize: "11px",
          color: "#6B7280",
          lineHeight: 1.4,
        }}
      >
        {ev.detail}
      </p>

      {ev.tags && ev.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ev.tags.map((tag) => (
            <TagPill key={tag.label} {...tag} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Party row
// ─────────────────────────────────────────────────────────────────────────────

function PartyRow({
  role,
  name,
  badge,
  badgeBg,
  badgeText,
  last,
}: {
  role: string;
  name: string;
  badge?: string;
  badgeBg?: string;
  badgeText?: string;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{
        borderBottom: last ? "none" : "0.5px solid #F3F4F6",
      }}
    >
      <div>
        <p
          style={{
            fontSize: "10px",
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "2px",
          }}
        >
          {role}
        </p>

        <p
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "#111827",
          }}
        >
          {name}
        </p>
      </div>

      {badge && (
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{
            fontSize: "10px",
            backgroundColor: badgeBg ?? "#F3F4F6",
            color: badgeText ?? "#374151",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Key/value row
// ─────────────────────────────────────────────────────────────────────────────

function KVRow({
  label,
  value,
  valueColor,
  large,
  noBorder,
}: {
  label: string;
  value: string;
  valueColor?: string;
  large?: boolean;
  noBorder?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-1.5"
      style={{
        borderBottom: noBorder
          ? "none"
          : "0.5px solid #F3F4F6",
      }}
    >
      <span
        style={{
          fontSize: "12px",
          color: "#6B7280",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: large ? "14px" : "12px",
          color: valueColor ?? "#111827",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ShipmentDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const routeState = location.state as ShipmentRouteState | null;
  const draft = routeState?.draft;

  const {
    getShipmentById,
    reload,
  } = useShipments();

  const ctxShipment =
    getShipmentById(id);

  const [
    voyageSummary,
    setVoyageSummary,
  ] = useState<any | null>(null);

  const [
    voyageLoading,
    setVoyageLoading,
  ] = useState<boolean>(false);

  const [
    voyageError,
    setVoyageError,
  ] = useState<string | null>(null);

  const [
    voyageReloadKey,
    setVoyageReloadKey,
  ] = useState(0);

  const [
    charterParty,
    setCharterParty,
  ] = useState<CharterParty | null>(null);

  const [
    charterPartyLoading,
    setCharterPartyLoading,
  ] = useState<boolean>(false);

  const [
    charterPartyError,
    setCharterPartyError,
  ] = useState<string | null>(null);

  const [
    clauseReloadKey,
    setClauseReloadKey,
  ] = useState(0);

  const [
    clauseSaving,
    setClauseSaving,
  ] = useState(false);

  const [
    clauseSaveError,
    setClauseSaveError,
  ] = useState<string | null>(null);

  const [clauseForm, setClauseForm] =
    useState<{
      clauseId: string | null;
      clauseType: string;
      rawText: string;
      parametersText: string;
      operation: ClauseScope;
    }>({
      clauseId: null,
      clauseType: CLAUSE_TYPE_OPTIONS[0],
      rawText: "",
      parametersText: "{}",
      operation: "Global",
    });

  const [
    clauseEditorOpen,
    setClauseEditorOpen,
  ] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Load backend summary
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function loadVoyageSummary() {
      if (!id) {
        setVoyageSummary(null);
        return;
      }

      setVoyageLoading(true);
      setVoyageError(null);

      try {
        const result = await getVoyageSummary(id);

        if (!mounted) return;

        setVoyageSummary(result ?? null);
      } catch (error: any) {
        if (!mounted) return;

        setVoyageError(
          error?.message ??
            "Unable to load voyage summary."
        );

        setVoyageSummary(null);
      } finally {
        if (mounted) {
          setVoyageLoading(false);
        }
      }
    }

    void loadVoyageSummary();

    return () => {
      mounted = false;
    };
  }, [id, voyageReloadKey]);

  // ───────────────────────────────────────────────────────────────────────────
  // Backend data
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    const voyageId = voyageSummary?.voyage?.id ?? null;

    async function loadCharterParty() {
      if (!voyageId) {
        if (!mounted) return;

        setCharterParty(null);
        setCharterPartyError(null);
        setCharterPartyLoading(false);
        return;
      }

      setCharterPartyLoading(true);
      setCharterPartyError(null);

      try {
        const result = await getVoyageCharterParty(voyageId);

        if (!mounted) return;

        setCharterParty(result ?? null);
      } catch (error: any) {
        if (!mounted) return;

        if (error?.status === 404) {
          setCharterParty(null);
          setCharterPartyError(null);
        } else {
          setCharterParty(null);
          setCharterPartyError(
            error?.message ?? "Unable to load charter party clauses."
          );
        }
      } finally {
        if (mounted) {
          setCharterPartyLoading(false);
        }
      }
    }

    void loadCharterParty();

    return () => {
      mounted = false;
    };
  }, [voyageSummary?.voyage?.id, clauseReloadKey]);

  const voyage =
    voyageSummary?.voyage ?? null;

  const summary =
    voyageSummary ?? null;

  const [activeTab, setActiveTab] =
    useState<TabKey>("overview");

  const [isEditing, setIsEditing] =
    useState(false);

  const [form, setForm] = useState(
    {
      port: ctxShipment?.port ?? "",
      cargo: ctxShipment?.cargo ?? "",
      quantity:
        voyage?.cargoQuantity !== undefined &&
        voyage?.cargoQuantity !== null
          ? String(Number(voyage.cargoQuantity))
          : "",
      eta: ctxShipment?.eta ?? "",
    } as VoyageEditForm
  );

  const [
    editSaveError,
    setEditSaveError,
  ] = useState<string | null>(null);

  const [
    editSaving,
    setEditSaving,
  ] = useState(false);

  useEffect(() => {
    setForm({
      port: ctxShipment?.port ?? "",
      cargo: ctxShipment?.cargo ?? "",
      quantity:
        voyage?.cargoQuantity !== undefined &&
        voyage?.cargoQuantity !== null
          ? String(Number(voyage.cargoQuantity))
          : "",
      eta: ctxShipment?.eta ?? "",
    });
  }, [ctxShipment?.id]);

  // ───────────────────────────────────────────────────────────────────────────
  // Normalised shipment object
  // ───────────────────────────────────────────────────────────────────────────

  const shipment = voyage
    ? {
        id: voyage.id,

        supplier:
          summary?.parties?.supplier ??
          draft?.supplier ??
          ctxShipment?.supplier ??
          "Not available",

        receiver:
          summary?.parties?.receiver ??
          draft?.receiver ??
          ctxShipment?.receiver ??
          "Not available",

        vessel:
          voyage.vessel?.name ??
          ctxShipment?.vessel ??
          "Not available",

        port:
          voyage.dischargePort ??
          ctxShipment?.port ??
          "Not available",

        eta:
          voyage.eta ??
          draft?.eta ??
          ctxShipment?.eta ??
          "Not available",

        cargo:
          voyage.cargoType ??
          ctxShipment?.cargo ??
          "Not available",

        quantity:
          voyage.cargoQuantity
            ? `${Number(
                voyage.cargoQuantity
              ).toLocaleString()} MT`
            : ctxShipment?.quantity ??
              "Not available",

        status:
          voyage.status ??
          ctxShipment?.status ??
          "Not available",

        laycanStart:
          voyage.laycanStart ??
          ctxShipment?.laycanStart ??
          "Not available",

        laycanEnd:
          voyage.laycanEnd ??
          ctxShipment?.laycanEnd ??
          "Not available",

        loadPort:
          voyage.loadPort ??
          draft?.loadPort ??
          ctxShipment?.loadPort ??
          "Not available",

        bulkOperationType:
          voyage.bulkOperationType ??
          draft?.bulkOperationType ??
          ctxShipment?.bulkOperationType ??
          null,

        voyageRef:
          voyage.reference ??
          draft?.voyageRef ??
          ctxShipment?.voyageRef ??
          voyage.id,

        laytimeAllowed:
          summary?.commercialTerms?.laytimeAllowed != null
            ? String(summary.commercialTerms.laytimeAllowed)
            : draft?.laytimeAllowed ??
              ctxShipment?.laytimeAllowed ??
              "Not available",

        demurrageRate:
          summary?.commercialTerms?.demurrageRate ??
          draft?.demurrageRate ??
          ctxShipment?.demurrageRate ??
          "Not available",

        dispatchRate:
          summary?.commercialTerms?.dispatchRate ??
          draft?.dispatchRate ??
          ctxShipment?.dispatchRate ??
          "Not available",

        timeCountingBasis:
          summary?.commercialTerms?.timeCountingBasis ??
          draft?.timeCountingBasis ??
          ctxShipment?.timeCountingBasis ??
          "Not available",

        norNoticePeriod:
          summary?.commercialTerms?.norNoticePeriod ??
          draft?.norNoticePeriod ??
          ctxShipment?.norNoticePeriod ??
          "Not available",

        risk:
          summary?.risk &&
          typeof summary.risk.demurrageExposure !==
            "undefined"
            ? Number(
                summary.risk.demurrageExposure
              ) > 100000
              ? "critical"
              : Number(
                  summary.risk.demurrageExposure
                ) > 0
              ? "elevated"
              : "optimal"
            : ctxShipment?.risk ?? "optimal",
      }
    : ctxShipment;

  // ───────────────────────────────────────────────────────────────────────────
  // Safety fallback
  // ───────────────────────────────────────────────────────────────────────────

  if (!shipment) {
    if (voyageLoading) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#F9FAFB",
            padding: "40px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 500,
              color: "#111827",
            }}
          >
            Loading shipment
          </h1>

          <p
            style={{
              marginTop: "8px",
              fontSize: "13px",
              color: "#6B7280",
            }}
          >
            Fetching the latest voyage summary from the backend.
          </p>
        </div>
      );
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#F9FAFB",
          padding: "40px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 500,
            color: "#111827",
          }}
        >
          Shipment not found
        </h1>

        <p
          style={{
            marginTop: "8px",
            fontSize: "13px",
            color: "#6B7280",
          }}
        >
          The requested shipment could not be found.
        </p>

        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: "20px",
            backgroundColor: "#1A4ED8",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Back to Operations
        </button>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UI state
  // ───────────────────────────────────────────────────────────────────────────

  function startEdit() {
    setForm({
      port: shipment.port ?? "",
      eta: shipment.eta ?? "",
      cargo: shipment.cargo ?? "",
      quantity:
        voyage?.cargoQuantity !== undefined &&
        voyage?.cargoQuantity !== null
          ? String(Number(voyage.cargoQuantity))
          : "",
    });

    setEditSaveError(null);
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!shipment.id) {
      setEditSaveError("Voyage ID is required.");
      return;
    }

    const cargoQuantity = parseEditableQuantity(form.quantity);
    const eta = normalizeEditableEta(form.eta);

    if (!form.port.trim()) {
      setEditSaveError("Port is required.");
      return;
    }

    if (!form.cargo.trim()) {
      setEditSaveError("Cargo is required.");
      return;
    }

    if (cargoQuantity === null) {
      setEditSaveError("Quantity must be a valid number.");
      return;
    }

    if (form.eta.trim() && !eta) {
      setEditSaveError("ETA must be a valid date.");
      return;
    }

    setEditSaving(true);
    setEditSaveError(null);

    try {
      await updateVoyage(shipment.id, {
        dischargePort: form.port.trim(),
        cargoType: form.cargo.trim(),
        cargoQuantity,
        ...(eta ? { eta } : {}),
      });

      reload();
      setVoyageReloadKey((value) => value + 1);
      setIsEditing(false);
    } catch (error: any) {
      setEditSaveError(
        error?.message ?? "Unable to save voyage changes."
      );
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditSaveError(null);
    setIsEditing(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation
  // ───────────────────────────────────────────────────────────────────────────

  const charterPartyClauses =
    charterParty?.clauses ?? [];

  const clauseGroups = {
    Global: charterPartyClauses.filter(
      (clause) => getClauseOperation(clause.parameters) === "Global"
    ),
    Loading: charterPartyClauses.filter(
      (clause) => getClauseOperation(clause.parameters) === "Loading"
    ),
    Discharge: charterPartyClauses.filter(
      (clause) => getClauseOperation(clause.parameters) === "Discharge"
    ),
  } as const;

  function startNewClause() {
    setClauseSaveError(null);
    setClauseEditorOpen(true);
    setClauseForm({
      clauseId: null,
      clauseType: CLAUSE_TYPE_OPTIONS[0],
      rawText: "",
      parametersText: "{}",
      operation: "Global",
    });
  }

  function startEditClause(clause: CpClause) {
    const parameters = (clause.parameters ?? {}) as CpClauseParameters;
    const scope = getClauseOperation(parameters);

    setClauseSaveError(null);
    setClauseEditorOpen(true);
    setClauseForm({
      clauseId: clause.id,
      clauseType: clause.clauseType,
      rawText: clause.rawText ?? "",
      parametersText: stringifyClauseParameters(parameters),
      operation: scope,
    });
  }

  async function saveClause() {
    if (!charterParty) {
      setClauseSaveError(
        "Load a charter party before creating or editing clauses."
      );
      return;
    }

    if (!clauseForm.rawText.trim()) {
      setClauseSaveError("Clause text is required.");
      return;
    }

    let parameters: CpClauseParameters;

    try {
      parameters = buildClauseParameters(
        clauseForm.parametersText,
        clauseForm.operation
      );
    } catch {
      setClauseSaveError("Clause parameters must be valid JSON.");
      return;
    }

    setClauseSaving(true);
    setClauseSaveError(null);

    try {
      const payload = {
        clauseType: clauseForm.clauseType,
        rawText: clauseForm.rawText.trim(),
        parameters,
      };

      if (clauseForm.clauseId) {
        await updateCpClause(clauseForm.clauseId, payload);
      } else {
        await createCpClause(charterParty.id, payload);
      }

      setClauseForm({
        clauseId: null,
        clauseType: CLAUSE_TYPE_OPTIONS[0],
        rawText: "",
        parametersText: "{}",
        operation: "Global",
      });
      setClauseEditorOpen(false);
      setClauseReloadKey((value) => value + 1);
    } catch (error: any) {
      setClauseSaveError(
        error?.message ?? "Unable to save clause."
      );
    } finally {
      setClauseSaving(false);
    }
  }

  function cancelClauseEdit() {
    setClauseSaveError(null);
    setClauseEditorOpen(false);
    setClauseForm({
      clauseId: null,
      clauseType: CLAUSE_TYPE_OPTIONS[0],
      rawText: "",
      parametersText: "{}",
      operation: "Global",
    });
  }

  const onOpenClaim = () => {
    navigate("/claims/new");
  };

  const onLaytimeCalc = () => {
    navigate(`/shipments/${shipment.id}/sof`);
  };

  const onSOFTab = () => {
    navigate(`/shipments/${shipment.id}/sof`);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Tabs
  // ───────────────────────────────────────────────────────────────────────────

  const sectionTabs: {
    key: TabKey;
    label: string;
  }[] = [
    {
      key: "overview",
      label: "Overview",
    },
    {
      key: "sof",
      label: "SOF timeline",
    },
    {
      key: "laytime",
      label: "Laytime calc",
    },
    {
      key: "claims",
      label: "Claims",
    },
    {
      key: "documents",
      label: "Documents",
    },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Risk badge
  // ───────────────────────────────────────────────────────────────────────────

  const riskKey =
    shipment.risk in RISK_BADGE
      ? shipment.risk
      : "optimal";

  const badge =
    RISK_BADGE[riskKey];

  const riskLabel =
    RISK_LABEL[riskKey];

  // ───────────────────────────────────────────────────────────────────────────
  // Header metadata
  // ───────────────────────────────────────────────────────────────────────────

  const metaParts = [
    shipment.voyageRef ?? shipment.id,
    shipment.port,
    `${shipment.supplier} → ${shipment.receiver}`,
    shipment.cargo,
    shipment.quantity,
    `ETA ${shipment.eta}`,
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Latest calculation helpers
  // ───────────────────────────────────────────────────────────────────────────

  const calculation =
    summary?.latestCalculation ?? null;

  const calculationSnapshot = (calculation?.decisionSnapshot ?? null) as Record<string, any> | null;
  const reversibleSettlement = calculationSnapshot?.reversibleSettlement ?? null;
  const reversibleConfigured =
    Boolean(reversibleSettlement) ||
    calculationSnapshot?.reversibleLaytimeRule?.enabled === true;
  const reversibleSettlementStatus = (
    reversibleSettlement?.settlementStatus ??
    (reversibleConfigured ? "LEGACY" : null)
  ) as string | null;
  const nonAuthoritativeReversibleSummary =
    reversibleConfigured &&
    (reversibleSettlementStatus === "NONAUTHORITATIVE" ||
      reversibleSettlementStatus === "LEGACY");

  const usedLaytime =
    calculation?.usedLaytime ??
    calculation?.laytimeUsed ??
    null;

  const allowedLaytime =
    calculation?.allowedLaytime ??
    calculation?.allowed ??
    null;

  const remainingLaytime =
    calculation?.remainingLaytime ??
    calculation?.remaining ??
    null;

  const periods =
    Array.isArray(calculation?.periods)
      ? calculation.periods
      : [];

  const risk =
    summary?.risk ?? null;

  const demurrageExposure =
    risk?.demurrageExposure ?? null;

  const despatchCredit =
    risk?.despatchCredit ?? null;

  // ───────────────────────────────────────────────────────────────────────────
  // Timeline documents
  // ───────────────────────────────────────────────────────────────────────────

  const norDocuments = Array.isArray(
    summary?.norDocuments
  )
    ? summary.norDocuments
    : [];

  const sofDocuments = Array.isArray(
    summary?.sofDocuments
  )
    ? summary.sofDocuments
    : [];

  const timelineDocuments = [
    ...norDocuments,
    ...sofDocuments,
  ].sort((a: any, b: any) => {
    const aTime = new Date(
      a.uploadDate ??
        a.createdAt ??
        a.date ??
        0
    ).getTime();

    const bTime = new Date(
      b.uploadDate ??
        b.createdAt ??
        b.date ??
        0
    ).getTime();

    return aTime - bTime;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F9FAFB",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <PageHeader
        crumbs={[
          {
            label: "Operations",
            to: "/",
          },
          {
            label: "Shipment board",
            to: "/",
          },
          {
            label: `${shipment.vessel} · ${shipment.voyageRef ?? shipment.id}`,
          },
        ]}
        actions={
          <>
            {isEditing ? (
              <>
                <button
                  className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                  style={{
                    height: "32px",
                    fontSize: "12px",
                    color: "#374151",
                    borderColor: "#E5E7EB",
                    borderWidth: "0.5px",
                    backgroundColor: "#ffffff",
                  }}
                  onClick={cancelEdit}
                >
                  Cancel
                </button>

                <button
                  className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                  style={{
                    height: "32px",
                    fontSize: "12px",
                    color: "#ffffff",
                    backgroundColor: "#1A4ED8",
                    border: "none",
                    opacity: editSaving ? 0.7 : 1,
                  }}
                  disabled={editSaving}
                  onClick={saveEdit}
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </>
            ) : (
              <>
                <button
                  className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                  style={{
                    height: "32px",
                    fontSize: "12px",
                    color: "#374151",
                    borderColor: "#E5E7EB",
                    borderWidth: "0.5px",
                    backgroundColor: "#ffffff",
                  }}
                  onClick={startEdit}
                >
                  <Edit3 size={11} />
                  Edit
                </button>

              </>
            )}
          </>
        }
      />

      {/* ─────────────────────────────────────────────────────────────────────
          Shipment header
      ───────────────────────────────────────────────────────────────────── */}

      <div
        style={{
          padding: "16px 24px",
          backgroundColor: "#ffffff",
          borderBottom: "0.5px solid #E5E7EB",
        }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#111827",
            }}
          >
            {shipment.vessel}
          </h1>

          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
            style={{
              backgroundColor: badge.bg,
              color: badge.text,
              fontSize: "11px",
            }}
          >
            <span
              className="rounded-full"
              style={{
                width: "5px",
                height: "5px",
                backgroundColor: badge.dot,
              }}
            />

            {riskLabel}
          </span>
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center flex-wrap gap-2">
            {(
              [
                ["port", "Port"],
                ["cargo", "Cargo"],
                ["quantity", "Quantity"],
                ["eta", "ETA"],
              ] as [
                keyof typeof form,
                string
              ][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-1.5"
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                }}
              >
                {label}

                <input
                  value={form[key]}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      [key]: event.target.value,
                    })
                  }
                  style={{
                    fontSize: "12px",
                    color: "#111827",
                    border: "0.5px solid #E5E7EB",
                    borderRadius: "6px",
                    padding: "2px 6px",
                    width:
                      key === "cargo"
                        ? "130px"
                        : key === "eta"
                          ? "160px"
                          : "100px",
                  }}
                />
              </label>
            ))}
            </div>

            {editSaveError ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "#B91C1C",
                }}
              >
                {editSaveError}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className="flex items-center flex-wrap"
            style={{
              gap: "10px",
            }}
          >
            {metaParts.map((part, index) => (
              <span
                key={`${part}-${index}`}
                className="flex items-center gap-2.5"
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                }}
              >
                {part}

                {index <
                  metaParts.length - 1 && (
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: "3px",
                      height: "3px",
                      backgroundColor: "#D1D5DB",
                    }}
                  />
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          KPI strip
      ───────────────────────────────────────────────────────────────────── */}

      <div
        className="flex gap-3 flex-shrink-0"
        style={{
          padding: "16px 24px 0",
          backgroundColor: "#ffffff",
        }}
      >
        {[
          {
            label: "Laytime used",
            value: nonAuthoritativeReversibleSummary
              ? "Not authoritative"
              : usedLaytime
              ? formatValue(usedLaytime)
              : "Not yet recorded",
            vc: "#1A4ED8",
            sub: nonAuthoritativeReversibleSummary
              ? "See operation results"
              : allowedLaytime
              ? `Of ${formatValue(
                  allowedLaytime
                )}`
              : "Laytime calculation pending",
          },

          {
            label: "Remaining laytime",
            value: nonAuthoritativeReversibleSummary
              ? "Not authoritative"
              : remainingLaytime
              ? formatValue(
                  remainingLaytime
                )
              : "Not yet recorded",
            vc: "#22543D",
            sub: nonAuthoritativeReversibleSummary
              ? "See operation results"
              : calculation
              ? "Backend calculation"
              : "Laytime calculation pending",
          },

          {
            label: "Current exposure",
            value:
              demurrageExposure !== null
                ? formatMoney(
                    demurrageExposure
                  )
                : "Not yet calculated",
            vc: "#B45309",
            sub: risk
              ? "Backend risk summary"
              : "Calculation pending",
          },

          {
            label: "Deductions applied",
            value:
              periods.length > 0
                ? `${periods.length} events`
                : "0",
            vc: "#374151",
            sub:
              periods.length > 0
                ? "Recorded deduction periods"
                : "No deductions recorded",
          },
        ].map(
          ({
            label,
            value,
            vc,
            sub,
          }) => (
            <div
              key={label}
              className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
              style={{
                backgroundColor: "#F9FAFB",
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                marginBottom: "16px",
              }}
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

              <p
                style={{
                  fontSize: "18px",
                  fontWeight: 500,
                  color: vc,
                  lineHeight: 1.2,
                }}
              >
                {value}
              </p>

              <p
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                }}
              >
                {sub}
              </p>
            </div>
          )
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          Tabs
      ───────────────────────────────────────────────────────────────────── */}

      <div
        className="flex items-stretch flex-shrink-0"
        style={{
          borderBottom:
            "0.5px solid #E5E7EB",
          backgroundColor: "#ffffff",
          paddingLeft: "24px",
        }}
      >
        {sectionTabs.map((tab) => {
          const isActive =
            activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);

                if (tab.key === "sof") {
                  onSOFTab();
                }

                if (tab.key === "laytime") {
                  onLaytimeCalc();
                }
              }}
              className="relative px-4 py-3 cursor-pointer transition-colors"
              style={{
                fontSize: "13px",
                fontWeight: isActive
                  ? 500
                  : 400,
                color: isActive
                  ? "#111827"
                  : "#6B7280",
                background: "none",
                border: "none",
              }}
            >
              {tab.label}

              {isActive && (
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: "2px",
                    backgroundColor: "#1A4ED8",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          Main body
      ───────────────────────────────────────────────────────────────────── */}

      <div
        className="flex gap-3.5 flex-1"
        style={{
          padding: "16px 24px",
        }}
      >
        {/* LEFT COLUMN */}

        <div className="flex-1 min-w-0 flex flex-col gap-3.5">
          <LaytimeCalculationResultPanel calculation={calculation} />

          {/* Active laytime clocks */}

          <div
            className="rounded-xl border p-[16px_18px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Active laytime clocks
              </span>

              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{
                  fontSize: "10px",
                  backgroundColor: "#EFF6FF",
                  color: "#1E40AF",
                }}
              >
                {calculation
                  ? "2 running"
                  : "0 running"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {calculation ? (
                <>
                  <ClockCard
                    label="Supplier clock"
                    value={
                      nonAuthoritativeReversibleSummary
                        ? "Not authoritative"
                        : usedLaytime
                        ? formatValue(
                            usedLaytime
                          )
                        : "Recorded"
                    }
                    valueColor="#B45309"
                    sub={
                      nonAuthoritativeReversibleSummary
                        ? "See operation results"
                        : remainingLaytime
                        ? `${formatValue(
                            remainingLaytime
                          )} remaining`
                        : "See laytime calculation"
                    }
                    pct={
                      nonAuthoritativeReversibleSummary
                        ? 0
                        : allowedLaytime &&
                      usedLaytime
                        ? Math.min(
                            100,
                            Math.round(
                              (Number(
                                usedLaytime
                              ) /
                                Number(
                                  allowedLaytime
                                )) *
                                100
                            )
                          )
                        : 0
                    }
                    barColor="#F59E0B"
                    startTime={formatDateTime(
                      shipment.laycanStart
                    )}
                    startLabel="used"
                    microRows={[
                      {
                        k: "Dem rate",
                        v: formatMoney(
                          demurrageExposure,
                          "-"
                        ),
                      },
                      {
                        k: "Dispatch rate",
                        v: formatMoney(
                          despatchCredit,
                          "-"
                        ),
                      },
                      {
                        k: "Laycan open",
                        v: formatDate(
                          shipment.laycanStart,
                          "-"
                        ),
                      },
                      {
                        k: "Laycan close",
                        v: formatDate(
                          shipment.laycanEnd,
                          "-"
                        ),
                      },
                    ]}
                  />

                  <ClockCard
                    label="Receiver clock"
                    value={
                      nonAuthoritativeReversibleSummary
                        ? "Not authoritative"
                        : usedLaytime
                        ? formatValue(
                            usedLaytime
                          )
                        : "Recorded"
                    }
                    valueColor="#1A4ED8"
                    sub={
                      nonAuthoritativeReversibleSummary
                        ? "See operation results"
                        : remainingLaytime
                        ? `${formatValue(
                            remainingLaytime
                          )} remaining`
                        : "See laytime calculation"
                    }
                    pct={
                      nonAuthoritativeReversibleSummary
                        ? 0
                        : allowedLaytime &&
                      usedLaytime
                        ? Math.min(
                            100,
                            Math.round(
                              (Number(
                                usedLaytime
                              ) /
                                Number(
                                  allowedLaytime
                                )) *
                                100
                            )
                          )
                        : 0
                    }
                    barColor="#3B82F6"
                    startTime={formatDateTime(
                      shipment.laycanStart
                    )}
                    startLabel="used"
                    microRows={[
                      {
                        k: "Dem rate",
                        v: formatMoney(
                          demurrageExposure,
                          "-"
                        ),
                      },
                      {
                        k: "Dispatch rate",
                        v: formatMoney(
                          despatchCredit,
                          "-"
                        ),
                      },
                      {
                        k: "Laycan open",
                        v: formatDate(
                          shipment.laycanStart,
                          "-"
                        ),
                      },
                      {
                        k: "Laycan close",
                        v: formatDate(
                          shipment.laycanEnd,
                          "-"
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <div
                  className="col-span-2"
                  style={{
                    color: "#6B7280",
                    fontSize: "12px",
                  }}
                >
                  No active laytime clocks
                  recorded.
                </div>
              )}
            </div>
          </div>

          {/* Operations timeline */}

          <div
            className="rounded-xl border p-[16px_18px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <span
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Operations timeline
              </span>

              <span
                style={{
                  fontSize: "11px",
                  color: "#9CA3AF",
                }}
              >
                {shipment.laycanStart &&
                shipment.laycanEnd
                  ? `${formatDate(
                      shipment.laycanStart
                    )} – ${formatDate(
                      shipment.laycanEnd
                    )}`
                  : "Operational events"}
              </span>
            </div>

            <div className="pl-[10px]">
              {voyageLoading && (
                <p
                  style={{
                    color: "#6B7280",
                    fontSize: "12px",
                  }}
                >
                  Loading timeline…
                </p>
              )}

              {voyageError && (
                <p
                  style={{
                    color: "#B45309",
                    fontSize: "12px",
                  }}
                >
                  Unable to load timeline:{" "}
                  {voyageError}
                </p>
              )}

              {!voyageLoading &&
                !voyageError &&
                timelineDocuments.length ===
                  0 && (
                  <p
                    style={{
                      color: "#6B7280",
                      fontSize: "12px",
                    }}
                  >
                    No operational events
                    recorded yet.
                  </p>
                )}

              {!voyageLoading &&
                !voyageError &&
                timelineDocuments.length >
                  0 && (
                  <div>
                    {timelineDocuments.map(
                      (
                        doc: any,
                        index: number
                      ) => {
                        const timestamp =
                          doc.uploadDate ??
                          doc.createdAt ??
                          doc.date;

                        const eventName =
                          doc.type ??
                          doc.documentType ??
                          doc.filename ??
                          "Operational event";

                        const detail =
                          doc.notes ??
                          doc.description ??
                          doc.filename ??
                          "Operational document recorded.";

                        return (
                          <TimelineEvent
                            key={
                              doc.id ??
                              `${eventName}-${index}`
                            }
                            ev={{
                              state:
                                index ===
                                timelineDocuments.length -
                                  1
                                  ? "active"
                                  : "done",

                              timestamp:
                                formatDateTime(
                                  timestamp
                                ),

                              name: String(
                                eventName
                              ),

                              detail: String(
                                detail
                              ),
                            }}
                            last={
                              index ===
                              timelineDocuments.length -
                                1
                            }
                          />
                        );
                      }
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Contractual parties */}

          <div
            className="rounded-xl border p-[16px_18px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <span
              className="block mb-1"
              style={{
                fontSize: "11px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Contractual parties
            </span>

            <PartyRow
              role="Supplier"
              name={
                shipment.supplier ??
                "Not available"
              }
              badge={
                summary?.charterParty
                  ? "Attached"
                  : undefined
              }
              badgeBg="#C6F6D5"
              badgeText="#22543D"
            />

            <PartyRow
              role="Receiver"
              name={
                shipment.receiver ??
                "Not available"
              }
              badge={
                summary?.charterParty
                  ? "Attached"
                  : undefined
              }
              badgeBg="#C6F6D5"
              badgeText="#22543D"
            />

            <PartyRow
              role="Vessel owner"
              name={
                voyage?.vessel?.owner ??
                voyage?.vessel?.operator ??
                voyage?.vessel?.name ??
                "Not available"
              }
              badge={
                voyage?.vessel
                  ? "Confirmed"
                  : undefined
              }
              badgeBg="#EFF6FF"
              badgeText="#1E40AF"
            />

            <PartyRow
              role="Port agent"
              name={
                voyage?.portAgent ??
                "Not available"
              }
              badge={
                norDocuments.length > 0
                  ? "On site"
                  : undefined
              }
              badgeBg="#F3F4F6"
              badgeText="#374151"
              last
            />
          </div>

          <CharterPartyTermsPanel
            charterParty={charterParty}
            commercialTerms={summary?.commercialTerms ?? null}
            loading={charterPartyLoading}
            error={charterPartyError}
            onReload={() => setClauseReloadKey((value) => value + 1)}
          />

        </div>

        {/* RIGHT SIDEBAR */}

        <div
          style={{
            width: "210px",
            flexShrink: 0,
          }}
          className="flex flex-col gap-3"
        >
          {/* Warning */}

          <div
            className="flex items-start gap-2.5 rounded-lg p-[10px_12px]"
            style={{
              backgroundColor: "#FFFBEB",
              border: "0.5px solid #FDE68A",
              borderLeft:
                "2.5px solid #F59E0B",
            }}
          >
            <AlertTriangle
              size={13}
              style={{
                color: "#B45309",
                flexShrink: 0,
                marginTop: "1px",
              }}
            />

            <p
              style={{
                fontSize: "11px",
                color: "#7B341E",
                lineHeight: 1.4,
              }}
            >
              <strong
                style={{
                  fontWeight: 500,
                }}
              >
                Terminal congestion:
              </strong>{" "}
              Operational risk information
              will appear here when provided
              by the backend.
            </p>
          </div>

          {/* Position summary */}

          <div
            className="rounded-xl border p-[14px_16px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <p
              className="mb-2"
              style={{
                fontSize: "10px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Position summary
            </p>

            <KVRow
              label="Supplier net"
              value={
                despatchCredit !==
                null
                  ? `–${formatMoney(
                      despatchCredit
                    )}`
                  : "Not available"
              }
              valueColor="#B45309"
            />

            <KVRow
              label="Receiver net"
              value={
                demurrageExposure !==
                null
                  ? formatMoney(
                      demurrageExposure
                    )
                  : "Not available"
              }
              valueColor="#22543D"
            />

            <KVRow
              label="Deductions"
              value={
                periods.length > 0
                  ? `${periods.length} periods`
                  : "0"
              }
            />

            <KVRow
              label="Clock mismatch"
              value={formatValue(
                summary?.clockMismatch
              )}
            />

            <div
              style={{
                borderTop:
                  "0.5px solid #E5E7EB",
                margin: "8px 0",
              }}
            />

            <KVRow
              label="Total exposure"
              value={
                demurrageExposure !==
                null
                  ? formatMoney(
                      demurrageExposure
                    )
                  : "Not available"
              }
              valueColor="#C53030"
              large
              noBorder
            />
          </div>

          {/* Shipment details */}

          <div
            className="rounded-xl border p-[14px_16px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <p
              className="mb-2"
              style={{
                fontSize: "10px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Shipment details
            </p>

            <KVRow
              label="Product"
              value={formatValue(
                voyage?.cargoType ??
                  shipment.cargo
              )}
            />

            <KVRow
              label="Quantity"
              value={
                voyage?.cargoQuantity
                  ? `${Number(
                      voyage.cargoQuantity
                    ).toLocaleString()} MT`
                  : formatValue(
                      shipment.quantity
                    )
              }
            />

            <KVRow
              label="Load port"
              value={formatValue(
                shipment.loadPort
              )}
            />

            <KVRow
              label="Discharge"
              value={formatValue(
                voyage?.dischargePort ??
                  shipment.port
              )}
            />

            <KVRow
              label="Laytime operation"
              value={formatValue(
                voyage?.laytimeOperation ??
                  shipment.laytimeOperation ??
                  "Discharge"
              )}
            />

            <KVRow
              label="Bulk operation type"
              value={formatBulkOperationType(
                voyage?.bulkOperationType ??
                  shipment.bulkOperationType ??
                  null
              )}
            />

            <KVRow
              label="Voyage"
              value={formatValue(
                shipment.voyageRef ??
                  shipment.id
              )}
            />

            <KVRow
              label="Laytime"
              value={formatValue(
                shipment.laytimeAllowed !== "Not available" &&
                  shipment.laytimeAllowed !== "" &&
                  shipment.laytimeAllowed != null
                  ? `${shipment.laytimeAllowed}h`
                  : "Not available"
              )}
            />

            <KVRow
              label="Demurrage"
              value={formatValue(
                shipment.demurrageRate !==
                  "Not available" &&
                shipment.demurrageRate !== "" &&
                shipment.demurrageRate != null
                  ? `$${Number(
                      shipment.demurrageRate
                    ).toLocaleString()}/day`
                  : "Not available"
              )}
            />

            <KVRow
              label="Dispatch"
              value={formatValue(
                shipment.dispatchRate !==
                  "Not available" &&
                shipment.dispatchRate !== "" &&
                shipment.dispatchRate != null
                  ? `$${Number(
                      shipment.dispatchRate
                    ).toLocaleString()}/day`
                  : "Not available"
              )}
            />

            <KVRow
              label="Basis"
              value={formatValue(
                shipment.timeCountingBasis
              )}
            />

            <KVRow
              label="NOR"
              value={formatValue(
                shipment.norNoticePeriod
              )}
            />

            <KVRow
              label="Status"
              value={formatValue(
                voyage?.status ??
                  shipment.status
              )}
              valueColor="#1A4ED8"
              noBorder
            />
          </div>

          {/* Actions */}

          <div className="flex flex-col gap-2">
            <button
              onClick={onLaytimeCalc}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
              style={{
                height: "34px",
                fontSize: "13px",
                color: "#374151",
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#ffffff",
              }}
            >
              <ArrowUpRight size={11} />
              Full laytime calc ↗
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
