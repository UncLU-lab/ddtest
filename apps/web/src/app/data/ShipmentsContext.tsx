import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Shipment, RiskLevel } from "./shipments";
import { getVoyages, getVoyageSummary } from "../../lib/api";

function normalizeShipment(item: any, summary?: any): Shipment | null {
  if (!item) return null;
  const id = item.id ?? item.voyageId ?? item.uuid ?? "";
  const parties = summary?.parties ?? {};
  const commercialTerms = summary?.commercialTerms ?? {};

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

  const riskData = summary?.risk ?? {};

  const exposure = Number(riskData?.demurrageExposure ? Number(riskData.demurrageExposure) : 0) || 0;
  const despatchCredit = Number(riskData?.despatchCredit ? Number(riskData.despatchCredit) : 0) || 0;

  let risk: RiskLevel = "optimal";
  if (riskData?.laycanExpired) {
    risk = "critical";
  } else if (
    (riskData?.openDisputeCount ?? 0) > 0 ||
    Boolean(riskData?.calculationStale)
  ) {
    risk = "elevated";
  } else if (exposure > 0) {
    risk = "elevated";
  } else {
    risk = "optimal";
  }

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

    supplier:
      parties.supplier ??
      item.supplier ??
      "Not specified",
    receiver:
      parties.receiver ??
      item.receiver ??
      "Not specified",

    eta: String(eta),
    risk,
    exposure,
    cargo: String(cargo),
    quantity: String(quantity),

    status: item.status,
    laycanStart: item.laycanStart,
    laycanEnd: item.laycanEnd,
    laytimeOperation:
      item.laytimeOperation ??
      item.laytime_operation ??
      "Discharge",
    laytimeAllowed:
      commercialTerms.laytimeAllowed != null
        ? String(commercialTerms.laytimeAllowed)
        : item.laytimeAllowed,
    demurrageRate:
      commercialTerms.demurrageRate ??
      item.demurrageRate,
    dispatchRate:
      commercialTerms.dispatchRate ??
      item.dispatchRate,
    timeCountingBasis:
      commercialTerms.timeCountingBasis ??
      item.timeCountingBasis,
    norNoticePeriod:
      commercialTerms.norNoticePeriod ??
      item.norNoticePeriod,

    despatchCredit,
    openDisputeCount: Number(riskData?.openDisputeCount ?? 0),
    amountUnderDispute: Number(riskData?.amountUnderDispute ? Number(riskData.amountUnderDispute) : 0),

    readyToCalculate: Boolean(riskData?.readyToCalculate),
    calculationStale: Boolean(riskData?.calculationStale),
    laycanExpired: Boolean(riskData?.laycanExpired),

    blockers: riskData?.blockers ?? [],
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
  laytimeAllowed: string;
  demurrageRate: string;
  dispatchRate: string;
  timeCountingBasis: string;
  norNoticePeriod: string;
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
  norNoticePeriod: string;
  weatherWorking: "" | "Enabled" | "Disabled";
  wibon: "" | "Enabled" | "Disabled";
  wipon: "" | "Enabled" | "Disabled";
}

export const emptyShipmentCommercialTermsDraft: ShipmentCommercialTermsDraft = {
  laytimeAllowed: "",
  demurrageRate: "",
  dispatchRate: "",
  timeCountingBasis: "",
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
  laytimeAllowed: "",
  demurrageRate: "",
  dispatchRate: "",
  timeCountingBasis: "6h SHINC",
  norNoticePeriod: "6 hours",
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
  "supplier", "receiver", "laycanOpen", "laycanClose", "laytimeOperation", "laytimeAllowed", "demurrageRate", "timeCountingBasis",
];

const FIELD_LABELS: Record<string, string> = {
  vessel: "Vessel name", voyageRef: "Voyage ref.", productType: "Product type",
  quantity: "Quantity", eta: "ETA", loadPort: "Load port", dischargePort: "Discharge port",
  supplier: "Supplier", receiver: "Receiver", laycanOpen: "Laycan open", laycanClose: "Laycan close",
  laytimeOperation: "Laytime operation", laytimeAllowed: "Laytime allowed", demurrageRate: "Demurrage rate", timeCountingBasis: "Time counting basis",
};

export function missingDraftFields(draft: ShipmentDraft): string[] {
  return REQUIRED_DRAFT_FIELDS.filter((f) => !String(draft[f]).trim()).map((f) => FIELD_LABELS[f] ?? f);
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

const summaries = await Promise.all(
  (resp ?? []).map(async (voyage: any) => {
    try {
      return await getVoyageSummary(voyage.id);
    } catch (error) {
      console.error(
        `Failed to load summary for voyage ${voyage.id}`,
        error
      );
      return null;
    }
  })
);

if (!keepAlive) return;

const mapped: Shipment[] = (resp ?? [])
  .map((voyage: any, index: number) =>
    normalizeShipment(voyage, summaries[index])
  )
  .filter(Boolean) as Shipment[];

setShipments(mapped);
      } catch (err: any) {
        if (!keepAlive) return;
        setApiError(err?.message ?? String(err) ?? "Failed to load voyages");
        setShipments([]);
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
