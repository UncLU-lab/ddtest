import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Anchor,
  Download,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";

import { createVoyage, getVessels } from "../lib/api";
import { useShipments, estimateRisk } from "./data/ShipmentsContext";
import { RISK_LABEL, RISK_BADGE } from "./data/shipments";

type Scenario = "optimistic" | "likely" | "pessimistic";

type BackendVoyageStatus =
  | "Planned"
  | "Active"
  | "Completed"
  | "Cancelled";

function toIsoDateString(value?: string) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) return "";

  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T00:00:00.000Z`
      : trimmed;

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString();
}

function mapDraftVoyageStatus(): BackendVoyageStatus {
  return "Planned";
}

function SectionEyebrow({
  label,
  badge,
  badgeStyle,
}: {
  label: string;
  badge?: string;
  badgeStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        style={{
          fontSize: "11px",
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 400,
        }}
      >
        {label}
      </span>
      {badge && (
        <span
          className="rounded-full px-2 py-0.5"
          style={{
            fontSize: "10px",
            fontWeight: 500,
            ...(badgeStyle ?? {}),
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function formatDateSafe(d?: string) {
  if (!d) return "TBD";

  const dt = new Date(d);

  if (isNaN(dt.getTime())) {
    return String(d);
  }

  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addHours(d?: string, hours = 0) {
  if (!d) return undefined;

  const dt = new Date(d);

  if (isNaN(dt.getTime())) {
    return undefined;
  }

  dt.setHours(dt.getHours() + hours);

  return dt.toISOString();
}

function buildScenarioConfig(draft: any, exposure: number) {
  const eta = draft.eta || draft.laycanClose || draft.laycanEnd;

  return {
    optimistic: {
      label: "Optimistic",
      eta: formatDateSafe(addHours(eta, -12) ?? eta),
      etaColor: "#22543D",
      prob: "25%",
      riskLabel: "Optimal",
      riskBg: "#C6F6D5",
      riskText: "#22543D",
    },

    likely: {
      label: "Most likely",
      eta: formatDateSafe(eta),
      etaColor: "#B45309",
      prob: "60%",
      riskLabel: exposure > 0 ? "Elevated" : "Optimal",
      riskBg: exposure > 0 ? "#FEEBC8" : "#C6F6D5",
      riskText: exposure > 0 ? "#7B341E" : "#22543D",
    },

    pessimistic: {
      label: "Pessimistic",
      eta: formatDateSafe(addHours(eta, 24) ?? eta),
      etaColor: "#C53030",
      prob: "15%",
      riskLabel:
        exposure > 50000
          ? "Breach risk"
          : exposure > 0
          ? "Elevated"
          : "Optimal",
      riskBg: "#FED7D7",
      riskText: "#9B2C2C",
    },
  };
}

function ScenarioCard({
  active,
  onClick,
  c,
}: {
  variant: Scenario;
  active: boolean;
  onClick: () => void;
  c: any;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 text-left cursor-pointer transition-colors rounded-lg p-[11px_13px]"
      style={{
        border: `0.5px solid ${active ? "#1A4ED8" : "#E5E7EB"}`,
        backgroundColor: active ? "#EFF6FF" : "#ffffff",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {c.label}
      </span>

      <span
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: c.etaColor,
        }}
      >
        {c.eta}
      </span>

      <div className="flex items-center justify-between">
        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
          {c.prob} probability
        </span>

        <span
          className="rounded-full px-1.5 py-0.5 font-semibold"
          style={{
            fontSize: "10px",
            backgroundColor: c.riskBg,
            color: c.riskText,
          }}
        >
          {c.riskLabel}
        </span>
      </div>
    </button>
  );
}

function LaycanBar({
  label,
  segments,
  etaPos,
  dates,
}: {
  label: string;
  segments: { pct: number; color: string }[];
  etaPos: number;
  dates: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          style={{
            fontSize: "11px",
            color: "#6B7280",
            width: "90px",
            flexShrink: 0,
          }}
        >
          {label}
        </span>

        <div
          className="relative flex-1 rounded overflow-hidden"
          style={{
            height: "28px",
            backgroundColor: "#F9FAFB",
          }}
        >
          <div className="flex h-full">
            {segments.map((s, i) => (
              <div
                key={i}
                style={{
                  width: `${s.pct}%`,
                  backgroundColor: s.color,
                }}
              />
            ))}
          </div>

          <div
            className="absolute top-0 bottom-0"
            style={{
              left: `${etaPos}%`,
              width: "2px",
              backgroundColor: "#1A4ED8",
            }}
          />

          <div
            className="absolute top-0 bottom-0 flex items-center"
            style={{
              left: `${etaPos + 1}%`,
            }}
          >
            <span
              style={{
                fontSize: "9px",
                color: "#1A4ED8",
                fontWeight: 500,
              }}
            >
              ETA
            </span>
          </div>
        </div>
      </div>

      <div className="flex ml-[calc(90px+8px)]">
        {dates.map((d, i) => (
          <span
            key={i}
            style={{
              fontSize: "9px",
              color: "#9CA3AF",
              flex: 1,
              textAlign:
                i === 0
                  ? "left"
                  : i === dates.length - 1
                  ? "right"
                  : "center",
            }}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

type FlagState = "danger" | "warn" | "info" | "success";

const flagConfig: Record<
  FlagState,
  {
    bg: string;
    iconBg: string;
    titleColor: string;
    valueColor: string;
    icon: React.ReactNode;
  }
> = {
  danger: {
    bg: "#FFF5F5",
    iconBg: "#FED7D7",
    titleColor: "#9B2C2C",
    valueColor: "#C53030",
    icon: <AlertTriangle size={14} color="#C53030" />,
  },

  warn: {
    bg: "#FFFBEB",
    iconBg: "#FEEBC8",
    titleColor: "#7B341E",
    valueColor: "#B45309",
    icon: <Clock size={14} color="#B45309" />,
  },

  info: {
    bg: "#EFF6FF",
    iconBg: "#BFDBFE",
    titleColor: "#1E40AF",
    valueColor: "#1A4ED8",
    icon: <TrendingUp size={14} color="#1A4ED8" />,
  },

  success: {
    bg: "#F0FFF4",
    iconBg: "#C6F6D5",
    titleColor: "#22543D",
    valueColor: "#276749",
    icon: <CheckCircle size={14} color="#276749" />,
  },
};

function FlagRow({
  state,
  title,
  desc,
  value,
}: {
  state: FlagState;
  title: string;
  desc: string;
  value: string;
}) {
  const c = flagConfig[state];

  return (
    <div
      className="flex items-start gap-3 rounded-lg p-[10px_12px]"
      style={{ backgroundColor: c.bg }}
    >
      <div
        className="flex items-center justify-center rounded-md flex-shrink-0"
        style={{
          width: "28px",
          height: "28px",
          backgroundColor: c.iconBg,
        }}
      >
        {c.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: c.titleColor,
            marginBottom: "2px",
          }}
        >
          {title}
        </p>

        <p
          style={{
            fontSize: "11px",
            color: "#6B7280",
            lineHeight: 1.4,
            marginBottom: "4px",
          }}
        >
          {desc}
        </p>

        <p
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: c.valueColor,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function ExposureCard({
  label,
  value,
  valueColor,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg p-[10px_12px]"
      style={{
        border: `0.5px solid ${
          highlight ? "#1A4ED8" : "#E5E7EB"
        }`,
        backgroundColor: highlight ? "#EFF6FF" : "#ffffff",
      }}
    >
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

      <span
        style={{
          fontSize: "16px",
          fontWeight: 500,
          color: valueColor,
        }}
      >
        {value}
      </span>

      <span
        style={{
          fontSize: "11px",
          color: "#9CA3AF",
        }}
      >
        {sub}
      </span>
    </div>
  );
}

function RecItem({
  action,
  rationale,
}: {
  action: string;
  rationale: string;
}) {
  return (
    <div
      className="rounded-lg p-[9px_11px]"
      style={{ backgroundColor: "#F9FAFB" }}
    >
      <p
        style={{
          fontSize: "11px",
          lineHeight: 1.5,
          color: "#374151",
        }}
      >
        <strong
          style={{
            color: "#111827",
            fontWeight: 500,
          }}
        >
          {action}
        </strong>{" "}
        <span style={{ color: "#6B7280" }}>{rationale}</span>
      </p>
    </div>
  );
}

export default function PreOpsRiskEngine() {
  const navigate = useNavigate();

  const {
    draft,
    addShipment,
    clearDraft,
    reload,
  } = useShipments();

  const { risk, exposure } = estimateRisk(draft);

  const badge = RISK_BADGE[risk];

  const scenarioConfig = buildScenarioConfig(
    draft,
    exposure
  );

  const [activeScenario, setActiveScenario] =
    useState<Scenario>("likely");

  const [creating, setCreating] = useState(false);

  const onProceed = async () => {
    if (creating) return;

    setCreating(true);

    try {
      /*
       * IMPORTANT:
       * Backend CreateVoyageDto requires:
       *
       * vesselId
       * cargoQuantity
       * cargoType
       * loadPort
       * dischargePort
       * laycanStart
       * laycanEnd
       */

      const selectedVesselId =
        draft.vesselId ||
        (
          await getVessels()
        ).find((v: any) => {
          const name =
            v.name ??
            v.vesselName ??
            v.displayName ??
            "";

          return (
            name.toLowerCase() ===
            String(draft.vessel || "").toLowerCase()
          );
        })?.id;

      if (!selectedVesselId) {
        throw new Error(
          `Could not find vessel "${draft.vessel}" in the backend. Please select a valid vessel.`
        );
      }

      /*
       * Convert the draft into the ACTUAL backend DTO.
       */
      const dto = {
        vesselId: selectedVesselId,

        cargoQuantity: Number(draft.quantity) || 0,

        cargoType:
          draft.productType ||
          "Unknown",

        reference:
          draft.voyageRef?.trim() ||
          undefined,

        supplier:
          draft.supplier?.trim() ||
          undefined,

        receiver:
          draft.receiver?.trim() ||
          undefined,

        loadPort:
          draft.loadPort || "",

        dischargePort:
          draft.dischargePort || "",

        laycanStart:
          toIsoDateString(
            draft.laycanOpen ||
              draft.laycanStart ||
              ""
          ),

        laycanEnd:
          toIsoDateString(
            draft.laycanClose ||
              draft.laycanEnd ||
              ""
          ),

        laytimeOperation:
          draft.laytimeOperation ||
          "Discharge",

        eta:
          toIsoDateString(draft.eta),

        laytimeAllowed:
          draft.laytimeAllowed
            ? Number(draft.laytimeAllowed)
            : undefined,

        demurrageRate:
          draft.demurrageRate
            ? Number(draft.demurrageRate)
            : undefined,

        dispatchRate:
          draft.dispatchRate
            ? Number(draft.dispatchRate)
            : undefined,

        timeCountingBasis:
          draft.timeCountingBasis?.trim() ||
          undefined,

        norNoticePeriod:
          draft.norNoticePeriod?.trim() ||
          undefined,

        status: mapDraftVoyageStatus(),
      };

      console.log(
        "Creating voyage with DTO:",
        dto
      );

      const createdVoyage =
        await createVoyage(dto);

      const voyageId =
        createdVoyage?.id ??
        createdVoyage?.voyageId ??
        createdVoyage?.uuid;

      if (!voyageId) {
        throw new Error(
          "Voyage was created but the backend did not return an ID."
        );
      }

      // Use reload() to sync with backend after POST /api/v1/voyages succeeds.
      // The backend response is the source of truth, so we refresh context from the API.
      reload();

      clearDraft();

      navigate(`/shipments/${voyageId}`, {
        state: { draft },
      });
    } catch (error: any) {
      console.error(
        "Failed to initialise shipment:",
        error
      );

      alert(
        error?.message ||
          "Failed to create shipment."
      );
    } finally {
      setCreating(false);
    }
  };

  const onBackToShipment = () => {
    navigate("/shipments/new");
  };

  function exportRiskReport() {
    const lines = [
      `Pre-ops risk report — ${
        draft.vessel || "New vessel"
      }`,

      `Voyage reference: ${
        draft.voyageRef || "unassigned ref"
      }`,

      `Route: ${
        draft.loadPort || "—"
      } → ${
        draft.dischargePort || "—"
      }`,

      `Laycan window: ${
        draft.laycanOpen || "—"
      } – ${
        draft.laycanClose || "—"
      }`,

      `ETA: ${draft.eta || "—"}`,

      `Scenario: ${activeScenario}`,

      `Risk level: ${RISK_LABEL[risk]}`,

      `Estimated exposure: $${exposure.toLocaleString()}`,
    ];

    const blob = new Blob(
      [lines.join("\n")],
      {
        type: "text/plain;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `pre-ops-risk-report-${
        draft.voyageRef || "draft"
      }.txt`;

    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "#F9FAFB",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <nav
        className="flex items-center justify-between px-6 flex-shrink-0"
        style={{
          height: "56px",
          backgroundColor: "#ffffff",
          borderBottom:
            "0.5px solid #E5E7EB",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: "30px",
              height: "30px",
              backgroundColor: "#1A4ED8",
            }}
          >
            <Anchor
              size={15}
              color="#ffffff"
            />
          </div>

          <div className="flex flex-col leading-tight">
            <span
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Demurrage Defender
            </span>

            <span
              style={{
                fontSize: "12px",
                color: "#6B7280",
              }}
            >
              Operations Command
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5"
          style={{ fontSize: "13px" }}
        >
          <span
            style={{
              color: "#6B7280",
              cursor: "pointer",
            }}
            onClick={onBackToShipment}
          >
            New shipment
          </span>

          <span
            style={{ color: "#D1D5DB" }}
          >
            /
          </span>

          <span
            style={{
              color: "#111827",
              fontWeight: 500,
            }}
          >
            Pre-ops risk check
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToShipment}
            className="px-3 py-1.5 rounded-md border"
            style={{
              fontSize: "13px",
              color: "#374151",
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            Back
          </button>

          <button
            onClick={onProceed}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
            style={{
              fontSize: "13px",
              color: "#ffffff",
              backgroundColor: creating
                ? "#93A3C7"
                : "#1A4ED8",
              border: "none",
            }}
          >
            {creating
              ? "Initialising..."
              : "Initialise shipment"}

            {!creating && (
              <ArrowUpRight size={12} />
            )}
          </button>
        </div>
      </nav>

      <div
        className="flex items-start justify-between flex-shrink-0"
        style={{
          padding: "16px 24px",
          borderBottom:
            "0.5px solid #E5E7EB",
          backgroundColor: "#ffffff",
        }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1
              style={{
                fontSize: "17px",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Pre-ops risk engine
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
                  backgroundColor:
                    badge.dot,
                }}
              />

              {RISK_LABEL[risk]}
            </span>
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#6B7280",
            }}
          >
            {draft.vessel ||
              "New vessel"}{" "}
            ·{" "}
            {draft.voyageRef ||
              "unassigned ref"}{" "}
            ·{" "}
            {draft.dischargePort ||
              "discharge port TBD"}{" "}
            terminal · Laycan window:{" "}
            {draft.laycanOpen || "—"}{" "}
            –{" "}
            {draft.laycanClose || "—"}{" "}
            · ETA:{" "}
            {draft.eta || "—"}
          </p>
        </div>
      </div>

      <div
        className="flex gap-3.5 flex-1"
        style={{
          padding: "16px 24px",
        }}
      >
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          <div
            className="rounded-xl border p-[16px_18px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <SectionEyebrow
              label="ETA scenario modelling"
              badge="3 scenarios"
              badgeStyle={{
                backgroundColor: "#EFF6FF",
                color: "#1E40AF",
              }}
            />

            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {(
                [
                  "optimistic",
                  "likely",
                  "pessimistic",
                ] as Scenario[]
              ).map((v) => (
                <ScenarioCard
                  key={v}
                  variant={v}
                  active={
                    activeScenario === v
                  }
                  onClick={() =>
                    setActiveScenario(v)
                  }
                  c={scenarioConfig[v]}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <LaycanBar
                label="Supplier laycan"
                segments={[
                  {
                    pct: 28,
                    color: "#F3F4F6",
                  },
                  {
                    pct: 30,
                    color: "#C6F6D5",
                  },
                  {
                    pct: 14,
                    color: "#FEEBC8",
                  },
                  {
                    pct: 28,
                    color: "#FED7D7",
                  },
                ]}
                etaPos={52}
                dates={[
                  "Oct 20",
                  "Oct 23",
                  "Oct 25",
                  "Oct 27",
                  "Oct 30",
                ]}
              />

              <LaycanBar
                label="Receiver laycan"
                segments={[
                  {
                    pct: 33,
                    color: "#F3F4F6",
                  },
                  {
                    pct: 28,
                    color: "#C6F6D5",
                  },
                  {
                    pct: 16,
                    color: "#FEEBC8",
                  },
                  {
                    pct: 23,
                    color: "#FED7D7",
                  },
                ]}
                etaPos={52}
                dates={[
                  "Oct 20",
                  "Oct 24",
                  "Oct 26",
                  "Oct 28",
                  "Oct 30",
                ]}
              />
            </div>

            <div className="flex items-center gap-4 mt-4">
              {[
                {
                  color: "#C6F6D5",
                  label: "Inside laycan",
                },
                {
                  color: "#FEEBC8",
                  label: "Marginal",
                },
                {
                  color: "#FED7D7",
                  label: "Outside laycan",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5"
                >
                  <span
                    className="rounded-sm flex-shrink-0"
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor:
                        item.color,
                    }}
                  />

                  <span
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-xl border p-[16px_18px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <SectionEyebrow
              label="Risk & opportunity flags"
              badge={String(
                draft.voyageRef ||
                  "Draft"
              )}
              badgeStyle={{
                backgroundColor: "#FED7D7",
                color: "#9B2C2C",
              }}
            />

            <div className="flex flex-col gap-2">
              <FlagRow
                state={
                  exposure > 0
                    ? "danger"
                    : "info"
                }
                title="Receiver laycan conflict"
                desc={
                  draft.eta
                    ? `ETA: ${formatDateSafe(
                        draft.eta
                      )}`
                    : "Receiver laycan alignment — data incomplete."
                }
                value={`Est. demurrage: $${exposure.toLocaleString()}`}
              />

              <FlagRow
                state="warn"
                title="Port congestion — recent trend"
                desc={
                  draft.loadPort
                    ? `Historical congestion may affect ${draft.loadPort} → ${draft.dischargePort}`
                    : "Port congestion risk — port unknown"
                }
                value="Review port conditions"
              />

              <FlagRow
                state="info"
                title="Speed optimisation window"
                desc={
                  draft.vessel
                    ? `Adjusting speed may reduce exposure for ${draft.vessel}.`
                    : "Speed optimisation can reduce exposure."
                }
                value={`Potential reduction: $${Math.max(
                  0,
                  Math.round(
                    exposure * 0.5
                  )
                ).toLocaleString()}`}
              />

              <FlagRow
                state={
                  exposure > 0
                    ? "warn"
                    : "success"
                }
                title="Supplier laycan status"
                desc={
                  draft.laycanOpen ||
                  draft.laycanStart
                    ? "Supplier laycan information available."
                    : "Supplier laycan data incomplete."
                }
                value={
                  exposure > 0
                    ? `$${exposure.toLocaleString()} est.`
                    : "No demurrage exposure"
                }
              />
            </div>
          </div>

          <div
            className="rounded-xl border p-[16px_18px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <SectionEyebrow
              label="Exposure forecast by scenario"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <ExposureCard
                label="Optimistic"
                value={"—"}
                valueColor="#22543D"
                sub={"Data unavailable"}
              />

              <ExposureCard
                label="Most likely"
                value={`$${Math.round(exposure).toLocaleString()}`}
                valueColor="#B45309"
                sub={"Current estimated exposure"}
                highlight
              />

              <ExposureCard
                label="Pessimistic"
                value={"—"}
                valueColor="#C53030"
                sub={"Data unavailable"}
              />

              <ExposureCard
                label="Expected value"
                value={`$${Math.round(exposure).toLocaleString()}`}
                valueColor="#374151"
                sub={"From current draft & risk estimate"}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            width: "210px",
            flexShrink: 0,
          }}
          className="flex flex-col gap-3"
        >
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <p
              className="mb-3"
              style={{
                fontSize: "10px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Vessel inputs
            </p>

            {[
              {
                k: "Vessel",
                v: draft.vessel || "—",
              },
              {
                k: "ETA",
                v: formatDateSafe(
                  draft.eta
                ),
              },
              {
                k: "Cargo",
                v: draft.productType || "—",
              },
              {
                k: "Quantity",
                v: draft.quantity
                  ? `${Number(
                      draft.quantity
                    ).toLocaleString()} MT`
                  : "—",
              },
            ].map(({ k, v }) => (
              <div
                key={k}
                className="flex items-center justify-between"
                style={{
                  marginBottom: "7px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                  }}
                >
                  {k}
                </span>

                <span
                  style={{
                    fontSize: "12px",
                    color: "#111827",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}

            <div
              style={{
                borderTop:
                  "0.5px solid #E5E7EB",
                margin: "10px 0",
              }}
            />

            {[
              {
                k: "Load port",
                v: draft.loadPort || "—",
              },
              {
                k: "Discharge",
                v:
                  draft.dischargePort ||
                  "—",
              },
              {
                k: "Dem. rate",
                v: draft.demurrageRate
                  ? `$${Number(
                      draft.demurrageRate
                    ).toLocaleString()}/day`
                  : "—",
              },
            ].map(({ k, v }) => (
              <div
                key={k}
                className="flex items-center justify-between"
                style={{
                  marginBottom: "7px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                  }}
                >
                  {k}
                </span>

                <span
                  style={{
                    fontSize: "12px",
                    color: "#111827",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl border p-[14px_16px]"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <p
              className="mb-2.5"
              style={{
                fontSize: "10px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Recommendations
            </p>

            <div className="flex flex-col gap-2">
              <RecItem
                action="Review vessel speed."
                rationale="Earlier arrival may reduce laycan exposure."
              />

              <RecItem
                action="Issue NOR on arrival."
                rationale="Helps trigger laytime according to the applicable terms."
              />

              <RecItem
                action="Notify receiver of delay risk."
                rationale="Early notice can help manage operational exposure."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onProceed}
              disabled={creating}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg"
              style={{
                height: "38px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#ffffff",
                backgroundColor: creating
                  ? "#93A3C7"
                  : "#1A4ED8",
                border: "none",
              }}
            >
              {creating
                ? "Creating..."
                : "Go to ops timeline"}

              {!creating && (
                <ArrowUpRight
                  size={13}
                />
              )}
            </button>

            <button
              onClick={exportRiskReport}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border"
              style={{
                height: "36px",
                fontSize: "13px",
                color: "#374151",
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#ffffff",
              }}
            >
              <Download size={12} />
              Export risk report
            </button>

            <button
              onClick={onBackToShipment}
              className="w-full flex items-center justify-center rounded-lg border"
              style={{
                height: "36px",
                fontSize: "13px",
                color: "#6B7280",
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#ffffff",
              }}
            >
              Back to shipment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
