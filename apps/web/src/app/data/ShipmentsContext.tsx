import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Shipment, RiskLevel } from "./shipments";
import { getVoyages } from "../../lib/api";

function normalizeShipment(item: any): Shipment | null {
  if (!item) return null;

  const id = item.id ?? item.voyageId ?? item.uuid ?? "";
  const vessel = item.vessel?.name ?? item.vessel ?? item.vesselName ?? "Unknown vessel";
  const port = item.loadPort ?? item.port ?? item.dischargePort ?? "Unknown port";
  const supplier = item.supplier ?? item.counterparty?.name ?? "Unknown supplier";
  const receiver = item.receiver ?? item.buyer ?? item.counterparty?.name ?? "Unknown receiver";
  const eta = item.eta ?? item.laycanEnd ?? item.arrivalDate ?? item.updatedAt ?? "TBD";
  const cargo = item.cargoType ?? item.cargo ?? "LNG";
  const quantity = item.cargoQuantity ? `${Number(item.cargoQuantity).toLocaleString()} MT` : item.quantity ?? "N/A";

  const risk =
    item.risk ??
    (item.status === "Completed" ? "optimal" : item.status === "Active" ? "elevated" : "optimal");
  const exposure = typeof item.exposure === "number" ? item.exposure : 0;

  if (!id) return null;

  return {
    id: String(id),
    vessel: String(vessel),
    port: String(port),
    supplier: String(supplier),
    receiver: String(receiver),
    eta: String(eta),
    risk: risk as RiskLevel,
    exposure: Number(exposure),
    cargo: String(cargo),
    quantity: String(quantity),
  };
}

export interface ShipmentDraft {
  vessel: string;
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
}

export const emptyDraft: ShipmentDraft = {
  vessel: "",
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
};

export const REQUIRED_DRAFT_FIELDS: (keyof ShipmentDraft)[] = [
  "vessel", "voyageRef", "productType", "quantity", "eta", "loadPort", "dischargePort",
  "supplier", "receiver", "laycanOpen", "laycanClose", "laytimeAllowed", "demurrageRate", "timeCountingBasis",
];

const FIELD_LABELS: Record<string, string> = {
  vessel: "Vessel name", voyageRef: "Voyage ref.", productType: "Product type",
  quantity: "Quantity", eta: "ETA", loadPort: "Load port", dischargePort: "Discharge port",
  supplier: "Supplier", receiver: "Receiver", laycanOpen: "Laycan open", laycanClose: "Laycan close",
  laytimeAllowed: "Laytime allowed", demurrageRate: "Demurrage rate", timeCountingBasis: "Time counting basis",
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
}

const ShipmentsContext = createContext<ShipmentsContextValue | null>(null);

export function ShipmentsProvider({ children }: { children: ReactNode }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [draft, setDraft] = useState<ShipmentDraft>(emptyDraft);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let keepAlive = true;

    async function loadShipments() {
      try {
        const voyages = await getVoyages();
        const mapped = voyages.map(normalizeShipment).filter(Boolean) as Shipment[];

        if (keepAlive) {
          setShipments(mapped);
          setApiError(null);
        }
      } catch (error: any) {
        console.error('Failed to load shipments:', error);
        if (keepAlive) {
          setApiError(error.message || 'Failed to load shipment data');
          setShipments([]);
        }
      }
    }

    void loadShipments();

    return () => {
      keepAlive = false;
    };
  }, []);

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
    <ShipmentsContext.Provider value={{ shipments, getShipmentById, addShipment, updateShipment, draft, setDraft, clearDraft }}>
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
