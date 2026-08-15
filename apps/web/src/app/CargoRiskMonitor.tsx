import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "./Layout";
import {
  createVessel,
  getVessel,
  getVesselVoyages,
  getVessels,
  updateVessel,
  type Vessel as ApiVessel,
  type Voyage as ApiVoyage,
} from "../lib/api";

type VesselRecord = ApiVessel;
type VoyageRecord = ApiVoyage;

function formatText(value: unknown, fallback = "Not available") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function formatDateTime(value: unknown, fallback = "Not available") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString();
}

function formatDwt(value: unknown, fallback = "Not available") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return `${numeric.toLocaleString()} DWT`;
}

function formatQuantity(value: unknown, fallback = "Not available") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : fallback;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== "") {
    return numeric.toLocaleString();
  }

  const text = String(value).trim();
  return text || fallback;
}

type VesselFormValues = {
  name: string;
  imo: string;
  flag: string;
  type: string;
  dwt: string;
};

type VesselFormField = keyof VesselFormValues;
type VesselFormErrors = Partial<Record<VesselFormField, string>>;

const vesselFieldConfigs = [
  {
    id: "vessel-name",
    label: "Name",
    field: "name" as const,
    type: "text",
    placeholder: "e.g. Test Vessel",
  },
  {
    id: "vessel-imo",
    label: "IMO",
    field: "imo" as const,
    type: "text",
    placeholder: "7 digits, e.g. 9412301",
    helper: "Enter exactly 7 digits.",
  },
  {
    id: "vessel-flag",
    label: "Flag",
    field: "flag" as const,
    type: "text",
    placeholder: "e.g. Panama",
  },
  {
    id: "vessel-type",
    label: "Type",
    field: "type" as const,
    type: "text",
    placeholder: "e.g. LNG carrier",
  },
  {
    id: "vessel-dwt",
    label: "DWT",
    field: "dwt" as const,
    type: "number",
    placeholder: "e.g. 100000",
    helper: "Enter a positive whole number.",
  },
] as const;

function emptyVesselForm(): VesselFormValues {
  return {
    name: "",
    imo: "",
    flag: "",
    type: "",
    dwt: "",
  };
}

function vesselFormFromRecord(vessel?: VesselRecord | null): VesselFormValues {
  return {
    name: String(vessel?.name ?? ""),
    imo: String(vessel?.imo ?? ""),
    flag: String(vessel?.flag ?? ""),
    type: String(vessel?.type ?? ""),
    dwt: vessel?.dwt !== undefined && vessel?.dwt !== null ? String(vessel.dwt) : "",
  };
}

function validateVesselForm(form: VesselFormValues): VesselFormErrors {
  const nextErrors: VesselFormErrors = {};

  if (!form.name.trim()) {
    nextErrors.name = "Name is required.";
  }

  if (!/^\d{7}$/.test(form.imo.trim())) {
    nextErrors.imo = "IMO must be exactly 7 digits.";
  }

  if (!form.flag.trim()) {
    nextErrors.flag = "Flag is required.";
  }

  if (!form.type.trim()) {
    nextErrors.type = "Type is required.";
  }

  const dwtValue = Number(form.dwt);
  if (
    !form.dwt.trim() ||
    !Number.isFinite(dwtValue) ||
    !Number.isInteger(dwtValue) ||
    dwtValue <= 0
  ) {
    nextErrors.dwt = "DWT must be a positive whole number.";
  }

  return nextErrors;
}

function VesselForm({
  form,
  errors,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
  submitting,
  submitError,
}: {
  form: VesselFormValues;
  errors: VesselFormErrors;
  onChange: (field: VesselFormField, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitLabel: string;
  cancelLabel: string;
  submitting: boolean;
  submitError?: string | null;
}) {
  const submitErrorId = "vessel-submit-error";

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="rounded-xl border p-[16px_18px]"
      style={{
        borderColor: "#E5E7EB",
        borderWidth: "0.5px",
        backgroundColor: "#ffffff",
        maxWidth: "560px",
      }}
    >
      {submitError && (
        <div
          id={submitErrorId}
          role="alert"
          aria-live="assertive"
          className="rounded-lg border px-4 py-3 mb-4"
          style={{
            borderColor: "#FCA5A5",
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
          }}
        >
          <p style={{ fontSize: "12px", fontWeight: 500 }}>{submitError}</p>
        </div>
      )}

      <p
        className="mb-4"
        style={{
          fontSize: "11px",
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        All fields are required.
      </p>

      {vesselFieldConfigs.map((item) => {
        const error = errors[item.field];
        const helpId = `${item.id}-help`;
        const errorTextId = `${item.id}-error`;
        const describedBy = [item.helper ? helpId : null, error ? errorTextId : null, submitError ? submitErrorId : null]
          .filter(Boolean)
          .join(" ");

        return (
          <label key={item.id} htmlFor={item.id} className="flex flex-col gap-1.5 mb-4">
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>
              {item.label} <span style={{ color: "#DC2626" }}>*</span>
            </span>
            <input
              id={item.id}
              type={item.type}
              value={form[item.field]}
              onChange={(event) => onChange(item.field, event.target.value)}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={describedBy || undefined}
              placeholder={item.placeholder}
              min={item.field === "dwt" ? 1 : undefined}
              step={item.field === "dwt" ? 1 : undefined}
              inputMode={item.field === "dwt" ? "numeric" : undefined}
              style={{
                height: "36px",
                border: `0.5px solid ${error ? "#DC2626" : "#E5E7EB"}`,
                borderRadius: "8px",
                padding: "0 10px",
                fontSize: "12px",
              }}
            />
            {item.helper && (
              <p id={helpId} style={{ fontSize: "10px", color: "#6B7280", lineHeight: 1.3 }}>
                {item.helper}
              </p>
            )}
            {error && (
              <p
                id={errorTextId}
                role="alert"
                aria-live="assertive"
                style={{ fontSize: "11px", color: "#B91C1C", lineHeight: 1.3 }}
              >
                {error}
              </p>
            )}
          </label>
        );
      })}

      <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: "0.5px solid #E5E7EB" }}>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md border cursor-pointer"
          style={{
            fontSize: "12px",
            color: "#374151",
            borderColor: "#E5E7EB",
            borderWidth: "0.5px",
            backgroundColor: "#ffffff",
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 rounded-md"
          style={{
            fontSize: "12px",
            color: "#ffffff",
            backgroundColor: submitting ? "#93C5FD" : "#1A4ED8",
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

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
        {link ? (
          <span style={{ fontSize: "11px", color: "#6B7280" }}>Mitigation available</span>
        ) : null}
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

function VesselCard({
  vessel,
  onOpen,
}: {
  vessel: VesselRecord;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col text-left transition-colors cursor-pointer"
      style={{
        backgroundColor: "#ffffff",
        border: "0.5px solid #E5E7EB",
        borderRadius: "0 0 12px 12px",
        borderTop: "2px solid #1A4ED8",
        padding: 0,
      }}
      aria-label={`Open vessel ${formatText(vessel.name)}`}
    >
      <div className="flex flex-col gap-2 p-[13px_14px]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
              {formatText(vessel.name)}
            </p>
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "2px" }}>
              {formatText(vessel.imo)}
            </p>
          </div>

          <span
            className="rounded-full px-2 py-0.5 font-medium"
            style={{
              fontSize: "10px",
              color: "#1E40AF",
              backgroundColor: "#EFF6FF",
              flexShrink: 0,
            }}
          >
            {formatText(vessel.flag)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 mt-0.5">
          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: "12px", color: "#6B7280", flexShrink: 0 }}>Type</span>
            <span style={{ fontSize: "12px", color: "#111827", textAlign: "right" }}>
              {formatText(vessel.type)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: "12px", color: "#6B7280", flexShrink: 0 }}>DWT</span>
            <span style={{ fontSize: "12px", color: "#111827", textAlign: "right" }}>
              {formatDwt(vessel.dwt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: "12px", color: "#6B7280", flexShrink: 0 }}>Created</span>
            <span style={{ fontSize: "12px", color: "#111827", textAlign: "right" }}>
              {formatDateTime(vessel.createdAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: "12px", color: "#6B7280", flexShrink: 0 }}>Updated</span>
            <span style={{ fontSize: "12px", color: "#111827", textAlign: "right" }}>
              {formatDateTime(vessel.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function VesselVoyageCard({
  voyage,
  onOpen,
}: {
  voyage: VoyageRecord;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col text-left transition-colors cursor-pointer"
      style={{
        backgroundColor: "#ffffff",
        border: "0.5px solid #E5E7EB",
        borderRadius: "10px",
        padding: "14px 16px",
      }}
      aria-label={`Open voyage ${formatText(voyage.reference, voyage.id)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
            {formatText(voyage.reference)}
          </p>
          <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "3px" }}>
            {formatText(voyage.status)}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{
            fontSize: "10px",
            color: "#1E40AF",
            backgroundColor: "#EFF6FF",
            flexShrink: 0,
          }}
        >
          {formatText(voyage.cargoType)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {[
          ["Load port", formatText(voyage.loadPort)],
          ["Discharge port", formatText(voyage.dischargePort)],
          ["Cargo quantity", formatQuantity(voyage.cargoQuantity)],
          ["ETA", formatDateTime(voyage.eta)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <span style={{ fontSize: "10px", color: "#6B7280", display: "block" }}>{label}</span>
            <span
              style={{
                fontSize: "12px",
                color: "#111827",
                fontWeight: 500,
                display: "block",
                marginTop: "1px",
                wordBreak: "break-word",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

export function VesselDetail() {
  const { vesselId } = useParams();
  const navigate = useNavigate();
  const [vessel, setVessel] = useState<VesselRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [voyages, setVoyages] = useState<VoyageRecord[]>([]);
  const [voyagesLoading, setVoyagesLoading] = useState(false);
  const [voyagesError, setVoyagesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadVessel() {
      if (!vesselId) {
        if (alive) {
          setVessel(null);
          setLoading(false);
          setNotFound(true);
        }
        return;
      }

      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const result = await getVessel(vesselId);
        if (!alive) return;

        setVessel(result ?? null);
        setNotFound(!result);
        setIsEditing(false);
        setSuccessMessage(null);
      } catch (loadError: any) {
        if (!alive) return;

        if (loadError?.status === 404) {
          setNotFound(true);
          setVessel(null);
        } else {
          setError(loadError?.message ?? "Unable to load vessel.");
          setVessel(null);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadVessel();

    return () => {
      alive = false;
    };
  }, [vesselId]);

  useEffect(() => {
    let alive = true;

    async function loadVoyages() {
      if (!vesselId || !vessel) {
        if (alive) {
          setVoyages([]);
          setVoyagesLoading(false);
          setVoyagesError(null);
        }
        return;
      }

      setVoyagesLoading(true);
      setVoyagesError(null);

      try {
        const result = await getVesselVoyages(vesselId);
        if (!alive) return;

        setVoyages(Array.isArray(result) ? result : []);
      } catch (loadError: any) {
        if (!alive) return;

        setVoyagesError(loadError?.message ?? "Unable to load voyages.");
        setVoyages([]);
      } finally {
        if (alive) {
          setVoyagesLoading(false);
        }
      }
    }

    void loadVoyages();

    return () => {
      alive = false;
    };
  }, [vesselId, vessel]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", padding: "40px", fontFamily: "'Inter', sans-serif" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "#111827" }}>Loading vessel</h1>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#6B7280" }}>
          Fetching the persisted vessel record from the backend.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", padding: "40px", fontFamily: "'Inter', sans-serif" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "#111827" }}>Vessel could not be loaded</h1>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#6B7280" }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate("/vessels")}
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
          Back to vessels
        </button>
      </div>
    );
  }

  if (notFound || !vessel) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", padding: "40px", fontFamily: "'Inter', sans-serif" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "#111827" }}>Vessel not found</h1>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#6B7280" }}>
          The requested vessel could not be found.
        </p>
        <button
          type="button"
          onClick={() => navigate("/vessels")}
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
          Back to vessels
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Vessels", to: "/vessels" }, { label: formatText(vessel.name) }]}
        actions={
          !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{
                height: "34px",
                fontSize: "13px",
                color: "#ffffff",
                backgroundColor: "#1A4ED8",
                border: "none",
              }}
            >
              Edit vessel
            </button>
          ) : null
        }
      />

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: "16px 24px 0",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #BBF7D0",
            backgroundColor: "#F0FDF4",
            color: "#166534",
            fontSize: "12px",
          }}
        >
          {successMessage}
        </div>
      )}

      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: "16px 24px",
          borderBottom: "0.5px solid #E5E7EB",
          backgroundColor: "#ffffff",
        }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>
              {formatText(vessel.name)}
            </h1>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            Persisted vessel record loaded from the backend.
          </p>
        </div>
      </div>

      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>
        <div className="flex-1 min-w-0">
          <h2
            className="mb-3"
            style={{
              fontSize: "11px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Vessel details
          </h2>
          {isEditing ? (
            <VesselEditForm
              vessel={vessel}
              onCancel={() => setIsEditing(false)}
              onSaved={(nextVessel) => {
                setVessel(nextVessel);
                setIsEditing(false);
                setSuccessMessage("Vessel updated successfully.");
              }}
            />
          ) : (
            <div
              className="rounded-xl border p-[16px_18px]"
              style={{
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#ffffff",
              }}
            >
              {[
                ["Name", formatText(vessel.name)],
                ["IMO", formatText(vessel.imo)],
                ["Flag", formatText(vessel.flag)],
                ["Type", formatText(vessel.type)],
                ["DWT", formatDwt(vessel.dwt)],
                ["Created at", formatDateTime(vessel.createdAt)],
                ["Updated at", formatDateTime(vessel.updatedAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-1.5"
                  style={{ borderBottom: "0.5px solid #F3F4F6" }}
                >
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
                  <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5">
            <h2
              className="mb-3"
              style={{
                fontSize: "11px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Voyages
            </h2>

            <div
              className="rounded-xl border p-[16px_18px]"
              style={{
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#ffffff",
              }}
            >
              {voyagesLoading && (
                <p style={{ fontSize: "12px", color: "#6B7280" }}>
                  Loading persisted voyages...
                </p>
              )}

              {!voyagesLoading && voyagesError && (
                <div role="status" aria-live="polite" style={{ fontSize: "12px", color: "#991B1B" }}>
                  {voyagesError}
                </div>
              )}

              {!voyagesLoading && !voyagesError && voyages.length === 0 && (
                <div role="status" aria-live="polite">
                  <p style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>
                    No voyages found.
                  </p>
                  <p style={{ marginTop: "4px", fontSize: "11px", color: "#6B7280" }}>
                    Persisted voyages will appear here when available.
                  </p>
                </div>
              )}

              {!voyagesLoading && !voyagesError && voyages.length > 0 && (
                <div className="grid gap-3">
                  {voyages.map((voyage) => (
                    <VesselVoyageCard
                      key={voyage.id}
                      voyage={voyage}
                      onOpen={() => navigate(`/shipments/${voyage.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ width: "200px", flexShrink: 0 }}>
          <p
            className="mb-3"
            style={{
              fontSize: "11px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Risk intelligence feed
          </p>

          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border p-3"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <p style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>
              No live vessel risk intelligence available.
            </p>
            <p style={{ marginTop: "4px", fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
              Vessel risk intelligence will appear here when persisted signals are available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VesselCreateForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<VesselFormValues>(emptyVesselForm());
  const [fieldErrors, setFieldErrors] = useState<VesselFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateVesselForm(form);
    setFieldErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const created = await createVessel({
        name: form.name.trim(),
        imo: form.imo.trim(),
        flag: form.flag.trim(),
        type: form.type.trim(),
        dwt: Number(form.dwt),
      });

      navigate(`/vessels/${created.id}`);
    } catch (error: any) {
      setSubmitError(error?.message ?? "Unable to create vessel.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field: VesselFormField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError(null);
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Vessels", to: "/vessels" }, { label: "New vessel" }]} />

      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: "16px 24px",
          borderBottom: "0.5px solid #E5E7EB",
          backgroundColor: "#ffffff",
        }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>New vessel</h1>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            Create a persisted vessel record using backend-supported fields only.
          </p>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        <VesselForm
          form={form}
          errors={fieldErrors}
          onChange={updateField}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/vessels")}
          submitLabel={submitting ? "Creating..." : "Create vessel"}
          cancelLabel="Cancel"
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    </div>
  );
}

export function VesselEditForm({
  vessel,
  onCancel,
  onSaved,
}: {
  vessel: VesselRecord;
  onCancel: () => void;
  onSaved: (vessel: VesselRecord) => void;
}) {
  const [form, setForm] = useState<VesselFormValues>(() => vesselFormFromRecord(vessel));
  const [fieldErrors, setFieldErrors] = useState<VesselFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(vesselFormFromRecord(vessel));
    setFieldErrors({});
    setSubmitError(null);
  }, [vessel.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateVesselForm(form);
    setFieldErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const updated = await updateVessel(vessel.id, {
        name: form.name.trim(),
        imo: form.imo.trim(),
        flag: form.flag.trim(),
        type: form.type.trim(),
        dwt: Number(form.dwt),
      });

      const refreshed = await getVessel(vessel.id);
      onSaved(refreshed ?? updated);
    } catch (error: any) {
      setSubmitError(error?.message ?? "Unable to update vessel.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field: VesselFormField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError(null);
  }

  return (
    <VesselForm
      form={form}
      errors={fieldErrors}
      onChange={updateField}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitLabel={submitting ? "Saving..." : "Save changes"}
      cancelLabel="Cancel"
      submitting={submitting}
      submitError={submitError}
    />
  );
}

export default function CargoRiskMonitor() {
  const navigate = useNavigate();
  const [vessels, setVessels] = useState<VesselRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadVessels() {
      setLoading(true);
      setError(null);

      try {
        const result = await getVessels({ page: 1, limit: 200 });
        if (!alive) return;

        setVessels(Array.isArray(result) ? result : []);
      } catch (loadError: any) {
        if (!alive) return;

        setError(loadError?.message ?? "Unable to load vessels.");
        setVessels([]);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadVessels();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Vessels" }]}
        actions={
          <button
            type="button"
            onClick={() => navigate("/vessels/new")}
            className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{
              height: "34px",
              fontSize: "13px",
              color: "#ffffff",
              backgroundColor: "#1A4ED8",
              border: "none",
            }}
          >
            New vessel
          </button>
        }
      />

      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: "16px 24px",
          borderBottom: "0.5px solid #E5E7EB",
          backgroundColor: "#ffffff",
        }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>
              Vessels
            </h1>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            Persisted vessel records loaded from the backend.
          </p>
        </div>
      </div>

      <div
        className="flex gap-4 flex-shrink-0"
        style={{
          padding: "16px 24px",
          borderBottom: "0.5px solid #E5E7EB",
          backgroundColor: "#ffffff",
        }}
      >
        {[
          {
            label: "Total vessels",
            value: loading ? "Not available" : String(vessels.length),
            vc: undefined,
            sub: loading ? "Not available" : "Loaded from persisted backend data",
          },
          { label: "Breach risk", value: "Not available", vc: "#111827", sub: "Not available" },
          { label: "Emerging risk", value: "Not available", vc: "#111827", sub: "Not available" },
          { label: "Global efficiency", value: "Not available", vc: "#111827", sub: "Not available" },
        ].map(({ label, value, vc, sub }) => (
          <div
            key={label}
            className="flex-1 rounded-lg border flex flex-col gap-1 p-[14px_16px]"
            style={{
              backgroundColor: "#F9FAFB",
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
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
                fontSize: "22px",
                fontWeight: 500,
                color: vc ?? "#111827",
                lineHeight: 1.2,
              }}
            >
              {value}
            </p>
            <p style={{ fontSize: "11px", color: "#6B7280" }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>
        <div className="flex-1 min-w-0">
          <h2
            className="mb-3"
            style={{
              fontSize: "11px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Vessel list
          </h2>

          {loading ? (
            <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
              Loading vessels...
            </p>
          ) : error ? (
            <p role="alert" aria-live="assertive" style={{ fontSize: "12px", color: "#B45309" }}>
              Unable to load vessels: {error}
            </p>
          ) : vessels.length === 0 ? (
            <p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#6B7280" }}>
              No vessels found.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {vessels.map((vessel) => (
                <VesselCard
                  key={vessel.id}
                  vessel={vessel}
                  onOpen={() => navigate(`/vessels/${vessel.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ width: "200px", flexShrink: 0 }}>
          <p
            className="mb-3"
            style={{
              fontSize: "11px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Risk intelligence feed
          </p>

          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border p-3"
            style={{
              borderColor: "#E5E7EB",
              borderWidth: "0.5px",
              backgroundColor: "#ffffff",
            }}
          >
            <p style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>
              No live vessel risk intelligence available.
            </p>
            <p style={{ marginTop: "4px", fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
              Vessel risk intelligence will appear here when persisted signals are available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
