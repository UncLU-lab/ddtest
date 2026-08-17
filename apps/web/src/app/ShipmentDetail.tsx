import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  Edit3,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "./Layout";
import { RISK_LABEL, RISK_BADGE } from "./data/shipments";
import { useShipments } from "./data/ShipmentsContext";
import { getVoyageSummary } from "../lib/api";

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
  };
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
    updateShipment,
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
  }, [id]);

  // ───────────────────────────────────────────────────────────────────────────
  // Backend data
  // ───────────────────────────────────────────────────────────────────────────

  const voyage =
    voyageSummary?.voyage ?? null;

  const summary =
    voyageSummary ?? null;

  const shipmentForm = {
    vessel: ctxShipment?.vessel ?? "",
    port: ctxShipment?.port ?? "",
    supplier: ctxShipment?.supplier ?? "",
    receiver: ctxShipment?.receiver ?? "",
    eta: ctxShipment?.eta ?? "",
    cargo: ctxShipment?.cargo ?? "",
    quantity: ctxShipment?.quantity ?? "",
  };

  const [activeTab, setActiveTab] =
    useState<TabKey>("overview");

  const [isEditing, setIsEditing] =
    useState(false);

  const [form, setForm] = useState(
    shipmentForm
  );

  useEffect(() => {
    setForm(shipmentForm);
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
      vessel: shipment.vessel ?? "",
      port: shipment.port ?? "",
      supplier: shipment.supplier ?? "",
      receiver: shipment.receiver ?? "",
      eta: shipment.eta ?? "",
      cargo: shipment.cargo ?? "",
      quantity: shipment.quantity ?? "",
    });

    setIsEditing(true);
  }

  function saveEdit() {
    updateShipment(shipment.id, form);
    setIsEditing(false);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation
  // ───────────────────────────────────────────────────────────────────────────

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
                  }}
                  onClick={saveEdit}
                >
                  Save changes
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
          {isEditing ? (
            <input
              value={form.vessel}
              onChange={(event) =>
                setForm({
                  ...form,
                  vessel: event.target.value,
                })
              }
              style={{
                fontSize: "18px",
                fontWeight: 500,
                color: "#111827",
                border: "0.5px solid #E5E7EB",
                borderRadius: "6px",
                padding: "2px 8px",
              }}
            />
          ) : (
            <h1
              style={{
                fontSize: "18px",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              {shipment.vessel}
            </h1>
          )}

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
          <div className="flex items-center flex-wrap gap-2">
            {(
              [
                ["port", "Port"],
                ["supplier", "Supplier"],
                ["receiver", "Receiver"],
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
                      key === "supplier" ||
                      key === "receiver"
                        ? "110px"
                        : "90px",
                  }}
                />
              </label>
            ))}
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
            value: usedLaytime
              ? formatValue(usedLaytime)
              : "Not yet recorded",
            vc: "#1A4ED8",
            sub: allowedLaytime
              ? `Of ${formatValue(
                  allowedLaytime
                )}`
              : "Laytime calculation pending",
          },

          {
            label: "Remaining laytime",
            value: remainingLaytime
              ? formatValue(
                  remainingLaytime
                )
              : "Not yet recorded",
            vc: "#22543D",
            sub: calculation
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
                      usedLaytime
                        ? formatValue(
                            usedLaytime
                          )
                        : "Recorded"
                    }
                    valueColor="#B45309"
                    sub={
                      remainingLaytime
                        ? `${formatValue(
                            remainingLaytime
                          )} remaining`
                        : "See laytime calculation"
                    }
                    pct={
                      allowedLaytime &&
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
                      usedLaytime
                        ? formatValue(
                            usedLaytime
                          )
                        : "Recorded"
                    }
                    valueColor="#1A4ED8"
                    sub={
                      remainingLaytime
                        ? `${formatValue(
                            remainingLaytime
                          )} remaining`
                        : "See laytime calculation"
                    }
                    pct={
                      allowedLaytime &&
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
