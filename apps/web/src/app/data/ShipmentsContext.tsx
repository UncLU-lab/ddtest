import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Shipment, RiskLevel } from "./shipments";
import { getVoyages } from "../../lib/api";
import type { VoyageListItem } from "../../lib/api";

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "critical" || value === "elevated" || value === "optimal";
}

function normalizeShipment(item: VoyageListItem): Shipment | null {
  if (!item) return null;
  const id = item.id ?? item.voyageId ?? item.uuid ?? "";

  const vessel =
    item.vessel?.name ??
    item.vesselName ??
    item.vessel ??
    "Unknown vessel";

  const port =
    item.dischargePort ??
    item.port ??
    item.loadPort ??
    "Unknown port";

  const eta =
    item.eta ??
    item.arrivalDate ??
    "TBD";

  const cargo =
    item.cargoType ??
    item.cargo ??
    "Unknown";

  const quantity =
    item.cargoQuantity != null
      ? `${Number(item.cargoQuantity).toLocaleString()} MT`
      : item.quantity ?? "N/A";

  const exposure = Number(item.exposure ?? 0) || 0;
  const despatchCredit = Number(item.despatchCredit ?? 0) || 0;
  const openDisputeCount = Number(item.openDisputeCount ?? 0) || 0;
  const amountUnderDispute = Number(item.amountUnderDispute ?? 0) || 0;
  const calculationStale = Boolean(item.calculationStale);
  const laycanExpired = Boolean(item.laycanExpired);
  const risk: RiskLevel = isRiskLevel(item.risk)
    ? item.risk
    : laycanExpired
      ? "critical"
      : openDisputeCount > 0 || calculationStale || exposure > 0
        ? "elevated"
        : "optimal";

  if (!id) return null;

  return {
    id: String(id),
    vessel: String(vessel),
    port: String(port),
    loadPort:
      item.loadPort ??
      item.departurePort ??
      item.port ??
      undefined,
    voyageRef:
      item.reference ??
      item.code ??
      item.voyageRef ??
      String(id),

    supplier: item.supplier ?? "Not specified",
    receiver: item.receiver ?? "Not specified",

    eta: String(eta),
    risk,
    exposure,
    cargo: String(cargo),
    quantity: String(quantity),

    status: item.status,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    laycanStart: item.laycanStart,
    laycanEnd: item.laycanEnd,
    laytimeOperation:
      item.laytimeOperation ??
      item.laytime_operation ??
      "Discharge",
    bulkOperationType:
      item.bulkOperationType ??
      item.bulk_operation_type ??
      null,
    laytimeAllowed:
      item.laytimeAllowed != null
        ? String(item.laytimeAllowed)
        : undefined,
    demurrageRate:
      item.demurrageRate != null
        ? String(item.demurrageRate)
        : undefined,
    dispatchRate:
      item.dispatchRate != null
        ? String(item.dispatchRate)
        : undefined,
    timeCountingBasis:
      item.timeCountingBasis != null
        ? String(item.timeCountingBasis)
        : undefined,
    norNoticePeriod:
      item.norNoticePeriod != null
        ? String(item.norNoticePeriod)
        : undefined,

    despatchCredit,
    openDisputeCount,
    amountUnderDispute,

    readyToCalculate: false,
    calculationStale,
    laycanExpired,

    blockers: [],
  };
}

export interface ShipmentDraft {
  vessel: string;
  vesselId?: string;
  voyageRef: string;
  productType: string;
  quantity: string;
  eta: string;
  loadPort: string;
  dischargePort: string;
  dealMode: "spot" | "term" | "upload";
  supplier: string;
  receiver: string;
  intermediary: string;
  laycanOpen: string;
  laycanClose: string;
  laytimeOperation: "Loading" | "Discharge";
  bulkOperationType: "" | "dry_bulk" | "tanker";
  laytimeAllowed: string;
  demurrageRate: string;
  dispatchRate: string;
  timeCountingBasis: string;
  shexCalendar: ShipmentShexCalendarDraft;
  norNoticePeriod: string;
  settlementCurrency: string;
  laytimeOperationScope: "" | "Loading" | "Discharge" | "LoadingAndDischarge";
  reversibleLaytime: "" | "Enabled" | "Disabled";
  receiverLaycanOpen: string;
  receiverLaycanClose: string;
  receiverLaytimeAllowed: string;
  receiverDemurrageRate: string;
  deductibleCategories: string[];
  loadingTerms?: ShipmentCommercialTermsDraft;
  dischargeTerms?: ShipmentCommercialTermsDraft;
}

export interface ShipmentCommercialTermsDraft {
  laytimeAllowed: string;
  demurrageRate: string;
  dispatchRate: string;
  timeCountingBasis: string;
  shexCalendar: ShipmentShexCalendarDraft;
  norNoticePeriod: string;
  weatherWorking: "" | "Enabled" | "Disabled";
  wibon: "" | "Enabled" | "Disabled";
  wipon: "" | "Enabled" | "Disabled";
}

export interface ShipmentShexCalendarDraft {
  timeZone: string;
  holidayDates: string[];
  saturdayExcepted: "Yes" | "No";
}

export const emptyShipmentShexCalendarDraft: ShipmentShexCalendarDraft = {
  timeZone: "",
  holidayDates: [],
  saturdayExcepted: "No",
};

export const emptyShipmentCommercialTermsDraft: ShipmentCommercialTermsDraft = {
  laytimeAllowed: "",
  demurrageRate: "",
  dispatchRate: "",
  timeCountingBasis: "",
  shexCalendar: { ...emptyShipmentShexCalendarDraft },
  norNoticePeriod: "",
  weatherWorking: "",
  wibon: "",
  wipon: "",
};

export const emptyDraft: ShipmentDraft = {
  vessel: "",
  vesselId: "",
  voyageRef: "",
  productType: "LNG",
  quantity: "",
  eta: "",
  loadPort: "",
  dischargePort: "",
  dealMode: "term",
  supplier: "",
  receiver: "",
  intermediary: "",
  laycanOpen: "",
  laycanClose: "",
  laytimeOperation: "Discharge",
  bulkOperationType: "",
  laytimeAllowed: "",
  demurrageRate: "",
  dispatchRate: "",
  timeCountingBasis: "6h SHINC",
  shexCalendar: { ...emptyShipmentShexCalendarDraft },
  norNoticePeriod: "6 hours",
  settlementCurrency: "",
  laytimeOperationScope: "",
  reversibleLaytime: "",
  receiverLaycanOpen: "",
  receiverLaycanClose: "",
  receiverLaytimeAllowed: "",
  receiverDemurrageRate: "",
  deductibleCategories: [],
  loadingTerms: { ...emptyShipmentCommercialTermsDraft },
  dischargeTerms: { ...emptyShipmentCommercialTermsDraft },
};

export const REQUIRED_DRAFT_FIELDS: (keyof ShipmentDraft)[] = [
  "vessel", "voyageRef", "productType", "quantity", "eta", "loadPort", "dischargePort",
  "supplier", "receiver", "laycanOpen", "laycanClose", "laytimeOperation", "bulkOperationType", "laytimeAllowed", "demurrageRate", "timeCountingBasis",
];

const FIELD_LABELS: Record<string, string> = {
  vessel: "Vessel name", voyageRef: "Voyage ref.", productType: "Product type",
  quantity: "Quantity", eta: "ETA", loadPort: "Load port", dischargePort: "Discharge port",
  supplier: "Supplier", receiver: "Receiver", laycanOpen: "Laycan open", laycanClose: "Laycan close",
  laytimeOperation: "Laytime operation", bulkOperationType: "Bulk operation type", laytimeAllowed: "Laytime allowed", demurrageRate: "Demurrage rate", timeCountingBasis: "Time counting basis",
};

export function usesExplicitReversibleOperationAllowances(draft: Pick<ShipmentDraft, "laytimeOperationScope" | "reversibleLaytime">): boolean {
  return draft.laytimeOperationScope === "LoadingAndDischarge" && draft.reversibleLaytime === "Enabled";
}

export function missingDraftFields(draft: ShipmentDraft): string[] {
  const explicitReversibleOperationAllowances = usesExplicitReversibleOperationAllowances(draft);
  const missing = REQUIRED_DRAFT_FIELDS
    .filter((f) => f !== "laytimeAllowed" || !explicitReversibleOperationAllowances)
    .filter((f) => !String(draft[f]).trim())
    .map((f) => FIELD_LABELS[f] ?? f);
  if (explicitReversibleOperationAllowances) {
    if (!String(draft.loadingTerms?.laytimeAllowed ?? "").trim()) {
      missing.push("Loading laytime allowance");
    }
    if (!String(draft.dischargeTerms?.laytimeAllowed ?? "").trim()) {
      missing.push("Discharge laytime allowance");
    }
  }
  return missing;
}

interface ShipmentsContextValue {
  shipments: Shipment[];
  getShipmentById: (id?: string | null) => Shipment | undefined;
  addShipment: (s: Shipment) => void;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
  draft: ShipmentDraft;
  setDraft: (d: ShipmentDraft) => void;
  clearDraft: () => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const ShipmentsContext = createContext<ShipmentsContextValue | null>(null);

export function ShipmentsProvider({ children }: { children: ReactNode }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [draft, setDraft] = useState<ShipmentDraft>(emptyDraft);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let keepAlive = true;

    async function loadShipments() {
      setLoading(true);
      setApiError(null);
      try {
        const resp = await getVoyages();

        if (!keepAlive) return;

        const mapped: Shipment[] = (resp ?? [])
          .map((voyage: VoyageListItem) => normalizeShipment(voyage))
          .filter(Boolean) as Shipment[];

        setShipments(mapped);
      } catch (err: any) {
        if (!keepAlive) return;
        setApiError(err?.message ?? String(err) ?? "Failed to load voyages");
      } finally {
        if (keepAlive) setLoading(false);
      }
    }

    void loadShipments();

    return () => {
      keepAlive = false;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function getShipmentById(id?: string | null) {
    return shipments.find((s) => s.id === id);
  }

  function addShipment(s: Shipment) {
    setShipments((prev) => [s, ...prev]);
  }

  function updateShipment(id: string, patch: Partial<Shipment>) {
    setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function clearDraft() {
    setDraft(emptyDraft);
  }

  return (
    <ShipmentsContext.Provider value={{ shipments, getShipmentById, addShipment, updateShipment, draft, setDraft, clearDraft, loading, error: apiError, reload }}>
      {children}
    </ShipmentsContext.Provider>
  );
}

export function useShipments() {
  const ctx = useContext(ShipmentsContext);
  if (!ctx) throw new Error("useShipments must be used within a ShipmentsProvider");
  return ctx;
}

// Rough, transparent estimate — NOT a real laytime calculation — just enough
// to make a newly-created shipment show a plausible risk/exposure on the
// dashboard instead of a hardcoded placeholder.
export function estimateRisk(draft: ShipmentDraft): { risk: RiskLevel; exposure: number } {
  const rate = Number(draft.demurrageRate) || 0;
  const allowed = Number(draft.laytimeAllowed) || 0;
  if (!rate || !allowed) return { risk: "elevated", exposure: 0 };
  const exposure = Math.round(rate * 0.5);
  const risk: RiskLevel = exposure > 60000 ? "critical" : exposure > 15000 ? "elevated" : "optimal";
  return { risk, exposure };
}
