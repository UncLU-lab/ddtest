import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Anchor,
  Check,
  Ship,
  FileText,
  Clock,
  ChevronDown,
  Edit3,
  LayoutTemplate,
  Upload,
  AlertTriangle,
} from "lucide-react";
import {
  useShipments,
  ShipmentDraft,
  ShipmentCommercialTermsDraft,
  emptyShipmentCommercialTermsDraft,
  missingDraftFields,
} from "./data/ShipmentsContext";
import { getVessels } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
  hint,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label style={{ fontSize: "11px", color: "#374151", fontWeight: 500 }}>
        {label}
        {required && (
          <span style={{ color: "#EF4444", marginLeft: "2px" }}>*</span>
        )}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{hint}</span>
      )}
    </div>
  );
}

function Input({
  value,
  placeholder,
  onChange,
}: {
  value?: string;
  placeholder?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full outline-none"
      style={{
        height: "34px",
        border: "0.5px solid #E5E7EB",
        borderRadius: "8px",
        padding: "0 10px",
        fontSize: "12px",
        color: "#111827",
        backgroundColor: "#ffffff",
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
    />
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full appearance-none outline-none cursor-pointer"
        style={{
          height: "34px",
          border: "0.5px solid #E5E7EB",
          borderRadius: "8px",
          padding: "0 28px 0 10px",
          fontSize: "12px",
          color: "#111827",
          backgroundColor: "#ffffff",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "#9CA3AF" }}
      />
    </div>
  );
}

function SectionEyebrow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span style={{ color: "#9CA3AF" }}>{icon}</span>
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
    </div>
  );
}

function SubLabel({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: 400 }}>
        {children}
      </span>
      {badge && (
        <span
          className="rounded-full px-2 py-0.5"
          style={{ fontSize: "10px", color: "#6B7280", backgroundColor: "#F3F4F6" }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-4"
      style={{ borderTop: "0.5px solid #E5E7EB" }}
    />
  );
}

function OperationTermsSection({
  title,
  terms,
  onChange,
}: {
  title: string;
  terms: ShipmentCommercialTermsDraft;
  onChange: <K extends keyof ShipmentCommercialTermsDraft>(
    key: K,
    value: ShipmentCommercialTermsDraft[K],
  ) => void;
}) {
  return (
    <div
      className="rounded-lg border p-[12px_12px] mt-3"
      style={{
        borderColor: "#E5E7EB",
        borderWidth: "0.5px",
        backgroundColor: "#F9FAFB",
      }}
    >
      <SubLabel>{title}</SubLabel>
      <p style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "-2px", marginBottom: "10px" }}>
        Leave fields blank to fall back to Global terms.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <FormField label="Laytime allowed (hrs)">
          <Input
            value={terms.laytimeAllowed}
            onChange={(v) => onChange("laytimeAllowed", v)}
            placeholder="Optional"
          />
        </FormField>
        <FormField label="Demurrage rate ($/day)">
          <Input
            value={terms.demurrageRate}
            onChange={(v) => onChange("demurrageRate", v)}
            placeholder="Optional"
          />
        </FormField>
        <FormField label="Despatch rate ($/day)">
          <Input
            value={terms.dispatchRate}
            onChange={(v) => onChange("dispatchRate", v)}
            placeholder="Optional"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <FormField label="Time counting basis">
          <Select
            value={terms.timeCountingBasis}
            onChange={(v) => onChange("timeCountingBasis", v)}
            options={["", "SHEX", "SHINC"]}
          />
        </FormField>
        <FormField label="NOR notice period">
          <Input
            value={terms.norNoticePeriod}
            onChange={(v) => onChange("norNoticePeriod", v)}
            placeholder="Optional"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FormField label="Weather working">
          <Select
            value={terms.weatherWorking}
            onChange={(v) => onChange("weatherWorking", v as ShipmentCommercialTermsDraft["weatherWorking"])}
            options={["", "Enabled", "Disabled"]}
          />
        </FormField>
        <FormField label="WIBON">
          <Select
            value={terms.wibon}
            onChange={(v) => onChange("wibon", v as ShipmentCommercialTermsDraft["wibon"])}
            options={["", "Enabled", "Disabled"]}
          />
        </FormField>
        <FormField label="WIPON">
          <Select
            value={terms.wipon}
            onChange={(v) => onChange("wipon", v as ShipmentCommercialTermsDraft["wipon"])}
            options={["", "Enabled", "Disabled"]}
          />
        </FormField>
      </div>
    </div>
  );
}

function RiskBarRow({
  label,
  pct,
  color,
  valueColor,
}: {
  label: string;
  pct: number;
  color: string;
  valueColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex-shrink-0"
        style={{ width: "80px", fontSize: "11px", color: "#6B7280" }}
      >
        {label}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: "5px", backgroundColor: "#F3F4F6" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="flex-shrink-0 font-medium"
        style={{ width: "30px", fontSize: "11px", color: valueColor, textAlign: "right" }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateShipmentForm() {
  const navigate = useNavigate();
  const { draft, setDraft } = useShipments();
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  function update<K extends keyof ShipmentDraft>(key: K, value: ShipmentDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function toggleDeductible(tag: string) {
    const has = draft.deductibleCategories.includes(tag);
    update(
      "deductibleCategories",
      has ? draft.deductibleCategories.filter((t) => t !== tag) : [...draft.deductibleCategories, tag]
    );
  }

  function updateCommercialTerms(
    section: "loadingTerms" | "dischargeTerms",
    key: keyof ShipmentCommercialTermsDraft,
    value: string,
  ) {
    const current = draft[section] ?? emptyShipmentCommercialTermsDraft;

    setDraft({
      ...draft,
      [section]: {
        ...current,
        [key]: value,
      },
    });
  }

  const missing = missingDraftFields(draft);

  const onClose = () => navigate("/");
  const onInitialise = () => {
    if (missing.length > 0) {
      setAttemptedSubmit(true);
      return;
    }
    navigate("/shipments/new/risk-check");
  };

  const allDeductibleTags = ["Rain / weather", "Berth congestion", "Terminal downtime", "Mechanical breakdown", "Tide / draft", "Documentation", "Shifting"];

  const steps = [
    { n: 1, label: "Vessel & cargo", done: true },
    { n: 2, label: "Deal framework", active: true },
    { n: 3, label: "Laytime terms" },
    { n: 4, label: "Parties & review" },
  ];

  const dealModes: { key: ShipmentDraft["dealMode"]; icon: React.ReactNode; title: string; sub: string }[] = [
    { key: "spot", icon: <Edit3 size={15} />, title: "Spot recap", sub: "Manual entry" },
    { key: "term", icon: <LayoutTemplate size={15} />, title: "Term agreement", sub: "Supplier template" },
    { key: "upload", icon: <Upload size={15} />, title: "Upload contract", sub: "Auto-extraction" },
  ];

  // Minimal vessel picker component: loads vessels and stores selected vessel.id in draft.vesselId
  function VesselPicker({ draft, update }: { draft: ShipmentDraft; update: <K extends keyof ShipmentDraft>(k: K, v: ShipmentDraft[K]) => void }) {
    const [vessels, setVessels] = useState<any[] | null>(null);

    useEffect(() => {
      let mounted = true;
      getVessels()
        .then((list) => { if (mounted) setVessels(list); })
        .catch(() => { if (mounted) setVessels([]); });
      return () => { mounted = false; };
    }, []);

    if (vessels === null) {
      return <Input value={draft.vessel} onChange={(v) => update("vessel", v)} placeholder="Loading vessels..." />;
    }

    if (vessels.length === 0) {
      return <Input value={draft.vessel} onChange={(v) => update("vessel", v)} placeholder="e.g. BW Magnolia" />;
    }

    return (
      <div className="relative">
        <select
          value={draft.vesselId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            const sel = vessels.find((x: any) => x.id === id);
            update("vesselId" as any, id as any);
            if (sel) update("vessel", sel.name as any);
          }}
          className="w-full appearance-none outline-none cursor-pointer"
          style={{
            height: "34px",
            border: "0.5px solid #E5E7EB",
            borderRadius: "8px",
            padding: "0 28px 0 10px",
            fontSize: "12px",
            color: "#111827",
            backgroundColor: "#ffffff",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
        >
          <option value="">Select vessel…</option>
          {vessels.map((v: any) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "#9CA3AF" }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Nav ── */}
      <nav
        className="flex items-center justify-between px-6"
        style={{
          height: "56px",
          backgroundColor: "#ffffff",
          borderBottom: "0.5px solid #E5E7EB",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: "30px", height: "30px", backgroundColor: "#1A4ED8" }}
          >
            <Anchor size={15} color="#ffffff" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "#111827" }}>
              Demurrage Defender
            </span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Operations Command</span>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5" style={{ fontSize: "13px" }}>
          <span style={{ color: "#6B7280" }}>Operations</span>
          <span style={{ color: "#D1D5DB" }}>/</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>New shipment</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ fontSize: "13px", color: "#6B7280", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#111827")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#6B7280")}
          >
            Cancel
          </button>
        </div>
      </nav>

      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4">
        <h1 style={{ fontSize: "18px", fontWeight: 500, color: "#111827", marginBottom: "4px" }}>
          Create new shipment
        </h1>
        <p style={{ fontSize: "13px", color: "#6B7280" }}>
          Initialise a maritime cargo operation and set up laytime clocks
        </p>
      </div>

      {/* ── Step Indicator ── */}
      <div
        className="px-6 flex items-stretch gap-0"
        style={{ borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
      >
        {steps.map((step) => (
          <div
            key={step.n}
            className="flex items-center gap-2.5 px-5 py-3 relative cursor-pointer"
            style={{ minWidth: "160px" }}
          >
            {/* Active underline */}
            {step.active && (
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{ height: "2px", backgroundColor: "#1A4ED8" }}
              />
            )}
            {/* Step circle */}
            {step.done ? (
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: "20px", height: "20px", backgroundColor: "#10B981" }}
              >
                <Check size={11} color="#ffffff" strokeWidth={2.5} />
              </div>
            ) : (
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0 font-medium"
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: step.active ? "#1A4ED8" : "#F3F4F6",
                  color: step.active ? "#ffffff" : "#9CA3AF",
                  fontSize: "11px",
                }}
              >
                {step.n}
              </div>
            )}
            <span
              style={{
                fontSize: "13px",
                fontWeight: step.active ? 500 : 400,
                color: step.active ? "#111827" : step.done ? "#374151" : "#9CA3AF",
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="px-6 pt-5 pb-8 flex gap-4">

        {/* ── Left: Form Cards ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — Vessel & cargo */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionEyebrow icon={<Ship size={13} />} label="Vessel & cargo" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormField label="Vessel name" required>
                <VesselPicker draft={draft} update={update} />
              </FormField>
              <FormField label="Voyage ref." required>
                <Input value={draft.voyageRef} onChange={(v) => update("voyageRef", v)} placeholder="e.g. VOY-2313" />
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <FormField label="Product type" required>
                <Select value={draft.productType} onChange={(v) => update("productType", v)} options={["LNG", "LPG", "Crude", "Products"]} />
              </FormField>
              <FormField label="Quantity MT" required>
                <Input value={draft.quantity} onChange={(v) => update("quantity", v)} placeholder="e.g. 65000" />
              </FormField>
              <FormField label="ETA" required>
                <Input value={draft.eta} onChange={(v) => update("eta", v)} placeholder="YYYY-MM-DD" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Load port" required>
                <Input value={draft.loadPort} onChange={(v) => update("loadPort", v)} placeholder="e.g. Sabine Pass, TX" />
              </FormField>
              <FormField label="Discharge port" required>
                <Input value={draft.dischargePort} onChange={(v) => update("dischargePort", v)} placeholder="e.g. Singapore" />
              </FormField>
            </div>
          </div>

          {/* Card 2 — Deal framework */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionEyebrow icon={<FileText size={13} />} label="Deal framework" />

            {/* Toggle mode buttons */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {dealModes.map((mode) => {
                const isActive = draft.dealMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    onClick={() => update("dealMode", mode.key)}
                    className="flex flex-col items-center gap-1 rounded-lg p-[9px] transition-colors cursor-pointer"
                    style={{
                      border: `0.5px solid ${isActive ? "#1A4ED8" : "#E5E7EB"}`,
                      backgroundColor: isActive ? "#EFF6FF" : "#ffffff",
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff";
                    }}
                  >
                    <span style={{ color: isActive ? "#1A4ED8" : "#6B7280" }}>{mode.icon}</span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: isActive ? "#1E40AF" : "#374151",
                      }}
                    >
                      {mode.title}
                    </span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{mode.sub}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormField
                label="Supplier"
                required
                hint="Template auto-fills known terms"
              >
                <Select value={draft.supplier} onChange={(v) => update("supplier", v)} options={["", "Vitol Asia", "Shell International", "ADNOC", "Cheniere", "CNOOC"]} />
              </FormField>
              <FormField label="Receiver" required>
                <Select value={draft.receiver} onChange={(v) => update("receiver", v)} options={["", "PetroChina", "Uniper SE", "EDF Trading", "Totalenergies", "Kogas"]} />
              </FormField>
            </div>
            <FormField label="Intermediary / trader">
              <Input value={draft.intermediary} onChange={(v) => update("intermediary", v)} placeholder="Search entity database…" />
            </FormField>
          </div>

          {/* Card 3 — Laytime terms */}
          <div
            className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          >
            <SectionEyebrow icon={<Clock size={13} />} label="Laytime terms" />

            <SubLabel>Supplier clock</SubLabel>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormField label="Laycan open" required>
                <Input value={draft.laycanOpen} onChange={(v) => update("laycanOpen", v)} placeholder="YYYY-MM-DD" />
              </FormField>
              <FormField label="Laycan close" required>
                <Input value={draft.laycanClose} onChange={(v) => update("laycanClose", v)} placeholder="YYYY-MM-DD" />
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <FormField label="Laytime allowed (hrs)" required>
                <Input value={draft.laytimeAllowed} onChange={(v) => update("laytimeAllowed", v)} placeholder="e.g. 72" />
              </FormField>
              <FormField label="Demurrage rate ($/day)" required>
                <Input value={draft.demurrageRate} onChange={(v) => update("demurrageRate", v)} placeholder="e.g. 25000" />
              </FormField>
              <FormField label="Dispatch rate ($/day)">
                <Input value={draft.dispatchRate} onChange={(v) => update("dispatchRate", v)} placeholder="e.g. 12500" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Time counting basis" required>
                <Select value={draft.timeCountingBasis} onChange={(v) => update("timeCountingBasis", v)} options={["6h SHINC", "SHEX", "SHINC", "WWD", "CQD"]} />
              </FormField>
              <FormField label="NOR notice period">
                <Select value={draft.norNoticePeriod} onChange={(v) => update("norNoticePeriod", v)} options={["6 hours", "12 hours", "24 hours", "Immediate"]} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <FormField label="Laytime operation" required>
                <Select
                  value={draft.laytimeOperation}
                  onChange={(v) => update("laytimeOperation", v as ShipmentDraft["laytimeOperation"])}
                  options={["Discharge", "Loading"]}
                />
              </FormField>
            </div>

            <OperationTermsSection
              title="Loading-specific terms"
              terms={draft.loadingTerms ?? emptyShipmentCommercialTermsDraft}
              onChange={(key, value) => updateCommercialTerms("loadingTerms", key, value)}
            />

            <OperationTermsSection
              title="Discharge-specific terms"
              terms={draft.dischargeTerms ?? emptyShipmentCommercialTermsDraft}
              onChange={(key, value) => updateCommercialTerms("dischargeTerms", key, value)}
            />

            <Divider />
            <SubLabel badge="independent">Receiver clock</SubLabel>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormField label="Receiver laycan open">
                <Input value={draft.receiverLaycanOpen} onChange={(v) => update("receiverLaycanOpen", v)} placeholder="YYYY-MM-DD" />
              </FormField>
              <FormField label="Receiver laycan close">
                <Input value={draft.receiverLaycanClose} onChange={(v) => update("receiverLaycanClose", v)} placeholder="YYYY-MM-DD" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Laytime allowed (hrs)">
                <Input value={draft.receiverLaytimeAllowed} onChange={(v) => update("receiverLaytimeAllowed", v)} placeholder="e.g. 48" />
              </FormField>
              <FormField label="Demurrage rate ($/day)">
                <Input value={draft.receiverDemurrageRate} onChange={(v) => update("receiverDemurrageRate", v)} placeholder="e.g. 22000" />
              </FormField>
            </div>

            <Divider />
            <SubLabel>Deductible delay categories</SubLabel>

            <div className="flex flex-wrap gap-1.5">
              {allDeductibleTags.map((tag) => {
                const active = draft.deductibleCategories.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleDeductible(tag)}
                    className="rounded-full px-[9px] py-[3px] transition-colors cursor-pointer"
                    style={{
                      fontSize: "11px",
                      border: `0.5px solid ${active ? "#1A4ED8" : "#E5E7EB"}`,
                      backgroundColor: active ? "#EFF6FF" : "#ffffff",
                      color: active ? "#1E40AF" : "#6B7280",
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff"; }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Sidebar ── */}
        <div style={{ width: "220px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Shipment summary */}
          <div
            className="rounded-xl p-[14px_16px]"
            style={{ backgroundColor: "#F9FAFB", border: "0.5px solid #E5E7EB" }}
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
              Shipment summary
            </p>
            {[
              { k: "Vessel", v: draft.vessel || "—", vc: undefined },
              { k: "Route", v: (draft.loadPort || draft.dischargePort) ? `${draft.loadPort || "—"} → ${draft.dischargePort || "—"}` : "—", vc: undefined },
              { k: "ETA", v: draft.eta || "—", vc: undefined },
              { k: "Supplier", v: draft.supplier || "—", vc: undefined },
              { k: "Receiver", v: draft.receiver || "—", vc: undefined },
              { k: "Laytime", v: draft.laytimeAllowed ? `${draft.laytimeAllowed}h ${draft.timeCountingBasis}` : "—", vc: "#1A4ED8" },
              { k: "Demurrage", v: draft.demurrageRate ? `$${Number(draft.demurrageRate).toLocaleString()}/day` : "—", vc: undefined },
            ].map(({ k, v, vc }) => (
              <div
                key={k}
                className="flex items-center justify-between"
                style={{ marginBottom: "7px" }}
              >
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{k}</span>
                <span
                  style={{
                    fontSize: "12px",
                    color: vc ?? "#111827",
                    fontWeight: 400,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          {/* Pre-ops risk preview */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
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
              Pre-ops risk preview
            </p>
            <div className="flex flex-col gap-2.5">
              <RiskBarRow label="Laycan breach" pct={38} color="#F59E0B" valueColor="#B45309" />
              <RiskBarRow label="Port delay" pct={62} color="#EF4444" valueColor="#C53030" />
              <RiskBarRow label="Clock mismatch" pct={24} color="#10B981" valueColor="#276749" />
            </div>
            <div
              className="mt-3 pt-3"
              style={{ borderTop: "0.5px solid #E5E7EB" }}
            >
              <p style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.4 }}>
                Based on Singapore terminal data · last 90 days
              </p>
            </div>
          </div>

          {/* Required fields missing */}
          <div
            className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
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
              {missing.length > 0 ? "Required fields missing" : "Ready to initialise"}
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {missing.length > 0 ? (
                missing.map((warn) => (
                  <div
                    key={warn}
                    className="flex items-center gap-1.5 rounded-lg px-[10px] py-[7px]"
                    style={{
                      backgroundColor: "#FFFBEB",
                      border: "0.5px solid #FDE68A",
                    }}
                  >
                    <AlertTriangle
                      size={12}
                      style={{ color: "#B45309", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "11px", color: "#B45309" }}>{warn}</span>
                  </div>
                ))
              ) : (
                <div
                  className="flex items-center gap-1.5 rounded-lg px-[10px] py-[7px]"
                  style={{ backgroundColor: "#F0FDF4", border: "0.5px solid #BBF7D0" }}
                >
                  <Check size={12} style={{ color: "#16A34A", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "#166534" }}>All required fields complete</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                className="w-full flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                style={{
                  height: "40px",
                  backgroundColor: "#1A4ED8",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 500,
                  border: "none",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
                onClick={onInitialise}
              >
                Initialise shipment
              </button>
              {attemptedSubmit && missing.length > 0 && (
                <p style={{ fontSize: "11px", color: "#C53030", textAlign: "center" }}>
                  Fill in the highlighted fields to continue
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
