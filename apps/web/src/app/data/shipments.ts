export type RiskLevel = "critical" | "elevated" | "optimal";

export type Shipment = {
  id: string;
  vessel: string;
  port: string;
  loadPort?: string;
  voyageRef?: string;
  supplier: string;
  receiver: string;
  eta: string;
  risk: RiskLevel;
  exposure: number;
  cargo: string;
  quantity: string;

  status?: string;
  laycanStart?: string;
  laycanEnd?: string;
  laytimeOperation?: string;
  laytimeAllowed?: string;
  demurrageRate?: string;
  dispatchRate?: string;
  timeCountingBasis?: string;
  norNoticePeriod?: string;

  despatchCredit?: number;
  openDisputeCount?: number;
  amountUnderDispute?: number;

  readyToCalculate?: boolean;
  calculationStale?: boolean;
  laycanExpired?: boolean;
  blockers?: string[];
};

export const shipments: Shipment[] = [
  {
    id: "VOY-2310",
    vessel: "Maran Gas Apollonia",
    port: "Rotterdam",
    supplier: "Shell International",
    receiver: "Uniper SE",
    eta: "24 Oct 08:00",
    risk: "critical",
    exposure: 124000,
    cargo: "LNG",
    quantity: "70,000 MT",
  },
  {
    id: "VOY-2311",
    vessel: "BW Magnolia",
    port: "Singapore",
    supplier: "Vitol Asia",
    receiver: "PetroChina",
    eta: "25 Oct 14:30",
    risk: "elevated",
    exposure: 42500,
    cargo: "LNG",
    quantity: "65,000 MT",
  },
  {
    id: "VOY-2308",
    vessel: "Gaslog Geneva",
    port: "Houston",
    supplier: "Cheniere",
    receiver: "EDF Trading",
    eta: "28 Oct 10:15",
    risk: "optimal",
    exposure: -12000,
    cargo: "LNG",
    quantity: "68,000 MT",
  },
  {
    id: "VOY-2312",
    vessel: "Mol Hestia",
    port: "Fujairah",
    supplier: "ADNOC",
    receiver: "Totalenergies",
    eta: "26 Oct 22:00",
    risk: "elevated",
    exposure: 18200,
    cargo: "LNG",
    quantity: "60,000 MT",
  },
  {
    id: "VOY-2309",
    vessel: "Valencia Knutsen",
    port: "Zhoushan",
    supplier: "CNOOC",
    receiver: "Kogas",
    eta: "30 Oct 06:45",
    risk: "optimal",
    exposure: 0,
    cargo: "LNG",
    quantity: "64,000 MT",
  },
];

export function getShipment(id?: string | null): Shipment {
  return shipments.find((s) => s.id === id) ?? shipments[0];
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  critical: "Critical risk",
  elevated: "Elevated risk",
  optimal: "Optimal",
};

export const RISK_BADGE: Record<RiskLevel, { bg: string; text: string; dot: string }> = {
  critical: { bg: "#FED7D7", text: "#9B2C2C", dot: "#C53030" },
  elevated: { bg: "#FEEBC8", text: "#7B341E", dot: "#C05621" },
  optimal:  { bg: "#C6F6D5", text: "#22543D", dot: "#276749" },
};

export const alerts = [
  {
    id: 1,
    borderColor: "#EF4444",
    typeColor: "#EF4444",
    type: "Laycan breach risk",
    subject: "Maran Gas Apollonia",
    shipmentId: "VOY-2310",
    desc: "Delayed at entrance lock. ETA now outside laycan window (+8h).",
    time: "14:28 UTC",
  },
  {
    id: 2,
    borderColor: "#F59E0B",
    typeColor: "#F59E0B",
    type: "Terminal congestion",
    subject: "Port of Singapore",
    shipmentId: "VOY-2311",
    desc: "Terminal 3 reporting high congestion. Turnaround +12h expected.",
    time: "14:15 UTC",
  },
  {
    id: 3,
    borderColor: "#3B82F6",
    typeColor: "#3B82F6",
    type: "Early arrival exposure",
    subject: "Gaslog Geneva",
    shipmentId: "VOY-2308",
    desc: "Cruising at 18kts. Est. 14h early arrival — adjust speed to optimise.",
    time: "13:42 UTC",
  },
  {
    id: 4,
    borderColor: "#E5E7EB",
    typeColor: "#6B7280",
    type: "Deductible event log",
    subject: "BW Magnolia",
    shipmentId: "VOY-2311",
    desc: "Weather delay recorded at Gulf of Mexico.",
    time: "23:30 UTC",
  },
];

export const laytimeRows = [
  { vessel: "Maran Gas Apol.", shipmentId: "VOY-2310", laytime: 48, deductible: 7, demurrage: 45, dispatch: 0 },
  { vessel: "BW Magnolia", shipmentId: "VOY-2311", laytime: 55, deductible: 8, demurrage: 37, dispatch: 0 },
  { vessel: "Gaslog Geneva", shipmentId: "VOY-2308", laytime: 60, deductible: 0, demurrage: 0, dispatch: 40 },
];
