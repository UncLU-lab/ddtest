import { getAuthMode, getFirebaseAuth } from "./auth";

// API client for the Demurrage Defender backend

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

async function getAccessToken(): Promise<string> {
  const authMode = getAuthMode();

  if (authMode === "development") {
    const token = import.meta.env.VITE_DEVELOPMENT_AUTH_TOKEN;

    if (!token) {
      throw new Error(
        "VITE_DEVELOPMENT_AUTH_TOKEN is required in development authentication mode.",
      );
    }

    return token;
  }

  const auth = getFirebaseAuth();
  await auth.authStateReady();

  if (!auth.currentUser) {
    throw new Error("Authentication is required.");
  }

  return auth.currentUser.getIdToken();
}

const fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${await getAccessToken()}`);
  headers.delete("x-organization-id");

  return globalThis.fetch(input, {
    ...init,
    headers,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Vessel {
  id: string;
  name: string;
  imoNumber?: string;
  imo?: string;
  vesselType?: string;
  flag?: string;
  [key: string]: unknown;
}

export type ContractExtractionStatus = "FOUND" | "NOT_FOUND" | "AMBIGUOUS" | "UNSUPPORTED" | "INVALID";

export interface ContractExtractionField {
  rawValue: string | null;
  normalizedValue: string | number | null;
  status: ContractExtractionStatus;
  sourceSnippet: string | null;
  warning?: string;
  vesselId?: string;
}

export interface ContractExtractionResult {
  fields: Record<string, ContractExtractionField>;
  warnings: string[];
}

export interface CreateVesselDto {
  imo: string;
  name: string;
  flag: string;
  type: string;
  dwt: number;
}

export interface UpdateVesselDto extends Partial<CreateVesselDto> {}

export interface Voyage {
  id: string;
  vesselId: string;
  cargoQuantity: number | string;
  cargoType: string;
  reference?: string;
  loadPort: string;
  dischargePort: string;
  laytimeOperation?: "Loading" | "Discharge";
  bulkOperationType?: "dry_bulk" | "tanker" | null;
  laycanStart: string;
  laycanEnd: string;
  eta?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export type VoyageRiskLevel = "critical" | "elevated" | "optimal";

export interface VoyageListItem extends Voyage {
  vessel?: Vessel | null;
  supplier: string | null;
  receiver: string | null;
  risk: VoyageRiskLevel;
  exposure: number;
  openDisputeCount: number;
  amountUnderDispute: number;
  calculationStale: boolean;
  laycanExpired: boolean;
  laytimeAllowed?: string | number | null;
  demurrageRate?: string | number | null;
  dispatchRate?: string | number | null;
  timeCountingBasis?: string | null;
  norNoticePeriod?: string | null;
  despatchCredit?: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface SofDocument {
  id: string;
  voyageId: string;
  filePath: string;
  uploadDate: string;
  status: "Draft" | "Final";
  operation?: "Loading" | "Discharge" | null;
  [key: string]: unknown;
}

export interface SofEvent {
  id: string;
  sofId: string;
  eventTime: string;
  eventType: string;
  operation?: "Loading" | "Discharge" | null;
  remarks?: string | null;
  confidenceScore?: string | null;
  isManualOverride: boolean;
  overrideReason?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export type NorPortRelation =
  | "INSIDE_PORT_LIMITS"
  | "OUTSIDE_PORT_LIMITS"
  | "UNKNOWN";
export type NorBerthRelation = "AT_BERTH" | "NOT_AT_BERTH" | "UNKNOWN";
export type NorWaitingPlace =
  | "ANCHORAGE"
  | "PILOT_STATION"
  | "CUSTOMARY_WAITING_PLACE"
  | "OTHER"
  | "NONE"
  | "UNKNOWN";

export interface NorTenderLocationEvidence {
  id: string;
  voyageId: string;
  operation: "Loading" | "Discharge";
  evidenceTime: string;
  portRelation: NorPortRelation;
  berthRelation: NorBerthRelation;
  waitingPlace: NorWaitingPlace;
  source: "MANUAL" | "SOF" | "OCR" | "AIS";
  sofDocumentId?: string | null;
  sourceReference?: string | null;
  note?: string | null;
  norDocumentId?: string | null;
  norTenderedEventId?: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface CreateNorTenderLocationEvidenceDto {
  evidenceTime: string;
  operation: "Loading" | "Discharge";
  portRelation: NorPortRelation;
  berthRelation: NorBerthRelation;
  waitingPlace: NorWaitingPlace;
  source: "MANUAL" | "SOF";
  sofDocumentId?: string;
  sourceReference?: string;
  note?: string;
  norDocumentId?: string;
  norTenderedEventId?: string;
}

export interface LaytimeCalculation {
  id: string;
  voyageId: string;
  version: number;
  allowedLaytime: string | null;
  usedLaytime: string | null;
  demurrageAmount: string | null;
  despatchAmount: string | null;
  settlementAuthorityStatus?: ReversibleSettlementStatus | null;
  currency?: string | null;
  status: "Draft" | "Final";
  calculatedAt: string;
  warnings?: string[] | null;
  engineVersion?: string | null;
  inputSnapshot?: LaytimeCalculationInputSnapshot | null;
  decisionSnapshot?: LaytimeDecisionSnapshot | null;
  [key: string]: unknown;
}

export interface LaytimeCalculationOperationSelection {
  voyageLaytimeOperation?: "Loading" | "Discharge";
  hasLoadingCompletion?: boolean;
  hasDischargeCompletion?: boolean;
  mixedOperationEvidence?: boolean;
  includedCompletionEventIds?: string[];
  excludedCompletionEventIds?: string[];
}

export interface LaytimeCalculationInputSnapshot {
  sofDocumentSelection?: LaytimeCalculationSofDocumentSelection | null;
  operationSelection?: LaytimeCalculationOperationSelection | null;
  operationResult?: {
    source?: string | null;
    operation?: "Loading" | "Discharge" | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface LaytimeCalculationSofDocumentSelection {
  voyageLaytimeOperation?: "Loading" | "Discharge";
  candidateDocumentIds?: string[];
  includedDocumentIds?: string[];
  excludedDocumentIds?: string[];
  matchingDocumentIds?: string[];
  legacyNullDocumentIds?: string[];
  oppositeOperationDocumentIds?: string[];
  rule?: string;
}

export interface LaytimeDecisionIgnoredException {
  startTime: string;
  endTime: string;
  appliedClauseId: string | null;
  reason: string;
}

export interface ReversibleLaytimeRuleSnapshot {
  clauseId?: string | null;
  clauseType?: "reversible_laytime";
  enabled?: boolean | null;
  clauseParameters?: Record<string, unknown> | null;
  rawText?: string | null;
  warnings?: string[] | null;
  contractStatus?: "absent" | "disabled" | "legacy" | "v1" | "invalid" | "ambiguous";
  settlementVersion?: 1 | null;
  allowanceMode?: "sum_operation_allowances" | null;
  conflictingClauseIds?: string[];
}

export type ReversibleSettlementStatus =
  | "FINAL_AUTHORITATIVE"
  | "PROVISIONAL"
  | "NONAUTHORITATIVE"
  | "LEGACY";

export interface ReversibleSettlementSnapshot {
  version?: 1 | null;
  allowanceMode?: "sum_operation_allowances" | null;
  cargoQuantityBasis?: "voyage_cargo_quantity" | null;
  thresholdMode?: "combined_pool" | null;
  settlementStatus?: ReversibleSettlementStatus;
  reasonCode?: string;
  reason?: string;
  reversibleClauseId?: string | null;
  loadingChildCalculationId?: string | null;
  dischargeChildCalculationId?: string | null;
  loadingAllowance?: {
    clauseId?: string;
    source?: "operation-specific" | "global-fallback";
    mechanism?: "hours" | "days" | "rate";
    allowedSeconds?: number;
    [key: string]: unknown;
  } | null;
  dischargeAllowance?: {
    clauseId?: string;
    source?: "operation-specific" | "global-fallback";
    mechanism?: "hours" | "days" | "rate";
    allowedSeconds?: number;
    [key: string]: unknown;
  } | null;
  loadingCountableInputSeconds?: number | null;
  dischargeCountableInputSeconds?: number | null;
  combinedAllowedSeconds?: number | null;
  combinedUsedSeconds?: number;
  combinedOverrunSeconds?: number;
  combinedSavedSeconds?: number;
  demurrageRate?: number | null;
  despatchRate?: number | null;
  despatchTimeBasis?: "all_time_saved" | "working_time_saved" | null;
  demurrageAmount?: number;
  despatchAmount?: number;
  currency?: string | null;
  currencySource?: "charter_party_settlement_currency";
  currencyAuthorityStatus?: "AVAILABLE" | "CURRENCY_AUTHORITY_REQUIRED";
  threshold?: {
    operation?: "Loading" | "Discharge";
    timestamp?: string;
    cumulativeSeconds?: number;
  } | null;
  timeline?: Array<Record<string, unknown>>;
  warnings?: string[];
  [key: string]: unknown;
}

export function reversibleSettlementStatusLabel(
  status?: ReversibleSettlementStatus | null,
): string {
  switch (status) {
    case "FINAL_AUTHORITATIVE":
      return "FINAL - AUTHORITATIVE";
    case "PROVISIONAL":
      return "PROVISIONAL";
    case "NONAUTHORITATIVE":
      return "NON-AUTHORITATIVE";
    case "LEGACY":
      return "LEGACY";
    default:
      return "NOT AVAILABLE";
  }
}

export interface ReversibleLaytimeOperationAnalysis {
  allowedSeconds?: number | null;
  usedSeconds?: number | null;
  surplusSeconds?: number | null;
  overrunSeconds?: number | null;
}

export interface ReversibleLaytimePoolAnalysis {
  totalAllowedSeconds?: number | null;
  totalUsedSeconds?: number | null;
  totalSurplusBeforeTransferSeconds?: number | null;
  totalOverrunBeforeTransferSeconds?: number | null;
  loadingSurplusAvailableToOffsetDischargeOverrunSeconds?: number | null;
  dischargeSurplusAvailableToOffsetLoadingOverrunSeconds?: number | null;
  transferableSurplusSeconds?: number | null;
  netPooledOverrunSeconds?: number | null;
  netPooledSurplusSeconds?: number | null;
}

export interface ReversibleLaytimeAnalysisSnapshot {
  status?: "available" | "not-available";
  reason?: string;
  mode?: "contract-enabled" | "audit-only";
  contractRuleApplied?: boolean;
  loading?: ReversibleLaytimeOperationAnalysis | null;
  discharge?: ReversibleLaytimeOperationAnalysis | null;
  pool?: ReversibleLaytimePoolAnalysis | null;
}

export interface LaytimeDecisionSnapshot {
  commencement?: {
    commencedAt?: string | null;
    [key: string]: unknown;
  };
  cargoCompletion?: {
    selectedTime?: string | null;
    eventTime?: string | null;
    selectedEventId?: string | null;
    excludedEventIds?: string[] | null;
    [key: string]: unknown;
  } | null;
  weatherWorking?: {
    clauseId?: string | null;
    clauseParameters?: Record<string, unknown> | null;
    enabled?: boolean | null;
    applied?: boolean | null;
    totalWeatherTimeDeductedBeforeDemurrage?: number | null;
    [key: string]: unknown;
  } | null;
  demurrage?: {
    startedAt?: string | null;
    ignoredExceptions?: LaytimeDecisionIgnoredException[];
    [key: string]: unknown;
  } | null;
  reversibleLaytimeRule?: ReversibleLaytimeRuleSnapshot | null;
  reversibleLaytimeAnalysis?: ReversibleLaytimeAnalysisSnapshot | null;
  reversibleSettlement?: ReversibleSettlementSnapshot | null;
  nonReversibleSettlement?: NonReversibleSettlementSnapshot | null;
  [key: string]: unknown;
}

export interface NonReversibleOperationSettlementSnapshot {
  operation?: "Loading" | "Discharge";
  childCalculationId?: string;
  childLifecycle?: "Draft";
  childVersion?: number | null;
  allowedSeconds?: number;
  usedSeconds?: number;
  balanceType?: "DEMURRAGE" | "DESPATCH" | "BALANCED";
  savedSeconds?: number;
  excessSeconds?: number;
  demurrageAmount?: number;
  despatchAmount?: number;
  despatchBasis?: "all_time_saved" | "working_time_saved" | null;
  authorityStatus?: ReversibleSettlementStatus;
  currency?: string | null;
}

export interface NonReversibleSettlementSnapshot {
  version?: 1 | null;
  settlementMode?: "separate_operation_results" | "legacy_primary_operation";
  expectedOperationScope?: LaytimeOperationScope | null;
  expectedOperations?: Array<"Loading" | "Discharge">;
  settlementStatus?: ReversibleSettlementStatus;
  reasonCode?: string;
  operations?: Partial<Record<"Loading" | "Discharge", NonReversibleOperationSettlementSnapshot>>;
  missingOperations?: Array<"Loading" | "Discharge">;
  monetaryAggregation?: {
    status?: "AVAILABLE" | "CURRENCY_AUTHORITY_REQUIRED" | "CURRENCY_MISMATCH";
    currency?: string | null;
    grossDemurrage?: number | null;
    grossDespatch?: number | null;
    netExposure?: number | null;
    netDirection?: "NET_PAYABLE" | "NET_RECEIVABLE" | "BALANCED" | null;
    legalNetting?: false;
    claimableAsAggregate?: false;
  };
  finalizationBlockers?: string[];
}

export interface LaytimeCalculationResult {
  calculation: LaytimeCalculation;
  warnings: string[];
}

export interface LaytimeCalculationAudit {
  calculation: {
    id: string;
    voyageId: string;
    version: number;
    status: "Draft" | "Final";
    calculatedAt: string;
    allowedLaytime: string | null;
    usedLaytime: string | null;
    excessLaytime: string | null;
    savedLaytime: string | null;
    demurrageAmount: string | null;
    despatchAmount: string | null;
    settlementAuthorityStatus?: ReversibleSettlementStatus | null;
    currency?: string | null;
  };
  auditAvailable: boolean;
  engineVersion: string | null;
  warnings: string[];
  inputs: Record<string, unknown> | null;
  decisions: Record<string, unknown> | null;
}

export interface LaytimeOperationResult {
  id: string;
  parentCalculationId: string;
  operation: "Loading" | "Discharge";
  voyageId: string;
  version: number;
  allowedLaytime: string;
  usedLaytime: string;
  demurrageAmount: string;
  despatchAmount: string;
  currency?: string | null;
  status: "Draft" | "Final";
  calculatedAt: string;
  engineVersion?: string | null;
  inputSnapshot?: LaytimeCalculationInputSnapshot | null;
  decisionSnapshot?: LaytimeDecisionSnapshot | null;
  warnings?: string[] | null;
}

export type ClauseOperation = "Loading" | "Discharge";

export interface CpClauseParameters extends Record<string, unknown> {
  operation?: ClauseOperation;
}

export interface CpClause {
  id: string;
  charterPartyId: string;
  clauseType: string;
  rawText: string;
  parameters: CpClauseParameters;
  [key: string]: unknown;
}

export interface CharterParty {
  id: string;
  voyageId: string;
  laytimeOperationScope?: LaytimeOperationScope | null;
  settlementCurrency?: string | null;
  clauses?: CpClause[] | null;
  [key: string]: unknown;
}

export type LaytimeOperationScope = "Loading" | "Discharge" | "LoadingAndDischarge";

export interface CreateCpClauseDto {
  clauseType: string;
  rawText: string;
  parameters: CpClauseParameters;
}

export interface UpdateCpClauseDto extends Partial<CreateCpClauseDto> {}

export async function getVoyageCharterParty(voyageId: string): Promise<CharterParty> {
  if (!voyageId) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/charter-party`
  );

  const result = await parseResponse(response);
  return unwrapData<CharterParty>(result);
}

export async function updateCharterParty(
  charterPartyId: string,
  dto: {
    laytimeOperationScope?: LaytimeOperationScope;
    settlementCurrency?: string | null;
  },
): Promise<CharterParty> {
  const response = await fetch(
    `${API_BASE}/charter-parties/${encodeURIComponent(charterPartyId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    },
  );
  return unwrapData<CharterParty>(await parseResponse(response));
}

export async function createCpClause(
  charterPartyId: string,
  dto: CreateCpClauseDto
): Promise<CpClause> {
  if (!charterPartyId) {
    const error: ApiError = {
      message: "Charter party ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/charter-parties/${encodeURIComponent(charterPartyId)}/clauses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  const result = await parseResponse(response);
  return unwrapData<CpClause>(result);
}

export async function updateCpClause(
  clauseId: string,
  dto: UpdateCpClauseDto
): Promise<CpClause> {
  if (!clauseId) {
    const error: ApiError = {
      message: "Clause ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/cp-clauses/${encodeURIComponent(clauseId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  const result = await parseResponse(response);
  return unwrapData<CpClause>(result);
}

export interface CreateBulkDisputeDto {
  voyageId: string;
  type: "demurrage_counter" | "despatch_claim";
  amountDisputed: number;
  status?: "Open" | "Evidence Submitted" | "In Negotiation" | "Resolved";
}

export interface UpdateBulkDisputeDto {
  status?: "Open" | "Evidence Submitted" | "In Negotiation" | "Resolved";
  amountDisputed?: number;
  finalSettlementAmount?: number;
  resolvedDate?: string;
}

export interface BulkDispute {
  id: string;
  voyageId: string;
  type: string;
  amountDisputed: number | string;
  currency?: string | null;
  status?: string;
  createdDate?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export async function getBulkDispute(disputeId: string): Promise<BulkDispute> {
  if (!disputeId) {
    const error: ApiError = {
      message: "Dispute ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(`${API_BASE}/bulk-disputes/${encodeURIComponent(disputeId)}`);
  const result = await parseResponse(response);

  return unwrapData<BulkDispute>(result);
}

export async function updateBulkDispute(
  disputeId: string,
  dto: UpdateBulkDisputeDto
): Promise<BulkDispute> {
  if (!disputeId) {
    const error: ApiError = {
      message: "Dispute ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(`${API_BASE}/bulk-disputes/${encodeURIComponent(disputeId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  const result = await parseResponse(response);
  return unwrapData<BulkDispute>(result);
}

export interface CreateSofDocumentDto {
  filePath: string;
  status?: "Draft" | "Final";
  operation?: "Loading" | "Discharge";
}

export interface UpdateSofDocumentDto extends Partial<CreateSofDocumentDto> {}

export interface CreateSofEventDto {
  eventTime: string;
  eventType: string;
  operation?: "Loading" | "Discharge";
  remarks?: string;
  confidenceScore?: number;
}

export interface UpdateSofEventDto {
  eventTime?: string;
  eventType?: string;
  operation?: "Loading" | "Discharge";
  remarks?: string;
  confidenceScore?: number;
  overrideReason?: string;
}

export interface CreateVoyageDto {
  vesselId: string;
  cargoQuantity: number;
  cargoType: string;
  reference?: string;
  supplier?: string;
  receiver?: string;
  loadPort: string;
  dischargePort: string;
  laycanStart: string;
  laycanEnd: string;
  eta?: string;
  laytimeOperation?: "Loading" | "Discharge";
  bulkOperationType?: "dry_bulk" | "tanker" | null;
  laytimeAllowed?: number;
  demurrageRate?: number;
  dispatchRate?: number;
  timeCountingBasis?: string;
  shexCalendar?: VoyageShexCalendarDto;
  norNoticePeriod?: string;
  settlementCurrency?: string;
  laytimeOperationScope?: LaytimeOperationScope;
  reversibleLaytime?: {
    enabled: boolean;
    settlementVersion?: 1;
    allowanceMode?: "sum_operation_allowances";
  };
  loadingTerms?: VoyageCommercialTermsDto;
  dischargeTerms?: VoyageCommercialTermsDto;
  status?: "Planned" | "Active" | "Completed" | "Cancelled";
}

export interface VoyageCommercialTermsDto {
  laytimeAllowed?: number;
  demurrageRate?: number;
  dispatchRate?: number;
  timeCountingBasis?: string;
  shexCalendar?: VoyageShexCalendarDto;
  norNoticePeriod?: string;
  weatherWorking?: boolean;
  wibon?: boolean;
  wipon?: boolean;
}

export interface VoyageShexCalendarDto {
  calendarVersion: 1;
  timeZone: string;
  holidayDates: string[];
  saturdayExcepted: boolean;
}

export interface UpdateVoyageDto {
  cargoQuantity?: number;
  cargoType?: string;
  dischargePort?: string;
  eta?: string;
}

export interface ApiError {
  message: string;
  status?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response helpers
// ─────────────────────────────────────────────────────────────────────────────

async function parseResponse(response: Response): Promise<any> {
  let result: any = null;

  try {
    result = await response.json();
  } catch {
    // Some responses may not contain JSON.
  }

  if (!response.ok) {
    const rawMessage =
      result?.message ||
      result?.error ||
      `API request failed: ${response.status} ${response.statusText}`;

    const error: ApiError = {
      message: Array.isArray(rawMessage)
        ? rawMessage.join(", ")
        : String(rawMessage),
      status: response.status,
    };

    throw error;
  }

  return result;
}

function unwrapData<T>(result: any): T {
  return result?.data ?? result;
}

function buildQueryString(params?: Record<string, string | number | undefined>): string {
  if (!params) {
    return "";
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Vessels
// ─────────────────────────────────────────────────────────────────────────────

export async function getVessels(
  params?: { page?: number; limit?: number; search?: string; type?: string }
): Promise<Vessel[]> {
  try {
    const response = await fetch(
      `${API_BASE}/vessels${buildQueryString(params)}`
    );

    const result = await parseResponse(response);

    const vessels = unwrapData<unknown>(result);

    if (!Array.isArray(vessels)) {
      if (Array.isArray((result as any)?.data)) {
        return (result as any).data as Vessel[];
      }

      return [];
    }

    return vessels as Vessel[];
  } catch (error) {
    console.error("Failed to fetch vessels:", error);
    throw error;
  }
}

export async function parseContractText(sourceText: string): Promise<ContractExtractionResult> {
  const response = await fetch(`${API_BASE}/contract-extractions/parse-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText }),
  });
  return unwrapData<ContractExtractionResult>(await parseResponse(response));
}

export async function getVesselsPage(
  params?: { page?: number; limit?: number; search?: string; type?: string }
): Promise<Paginated<Vessel>> {
  try {
    const response = await fetch(
      `${API_BASE}/vessels${buildQueryString(params)}`
    );

    const result = await parseResponse(response);

    if (Array.isArray(result)) {
      return {
        data: result as Vessel[],
        meta: {
          page: params?.page ?? 1,
          limit: params?.limit ?? result.length,
          total: result.length,
        },
      };
    }

    return result as Paginated<Vessel>;
  } catch (error) {
    console.error("Failed to fetch vessels page:", error);
    throw error;
  }
}

export async function getAllVessels(): Promise<Vessel[]> {
  const firstPage = await getVesselsPage({ page: 1, limit: 200 });
  const vessels = [...firstPage.data];
  const total = firstPage.meta?.total ?? vessels.length;
  const limit = firstPage.meta?.limit ?? (vessels.length || 200);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await getVesselsPage({ page, limit });
    vessels.push(...nextPage.data);
  }

  return vessels;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voyages
// ─────────────────────────────────────────────────────────────────────────────

export async function getVessel(vesselId: string): Promise<Vessel> {
  if (!vesselId) {
    const error: ApiError = {
      message: "Vessel ID is required.",
      status: 400,
    };

    throw error;
  }

  try {
    const response = await fetch(`${API_BASE}/vessels/${encodeURIComponent(vesselId)}`);
    const result = await parseResponse(response);

    return unwrapData<Vessel>(result);
  } catch (error) {
    console.error(`Failed to fetch vessel ${vesselId}:`, error);
    throw error;
  }
}

export async function createVessel(dto: CreateVesselDto): Promise<Vessel> {
  const response = await fetch(`${API_BASE}/vessels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  const result = await parseResponse(response);
  return unwrapData<Vessel>(result);
}

export async function updateVessel(
  vesselId: string,
  dto: UpdateVesselDto
): Promise<Vessel> {
  if (!vesselId) {
    const error: ApiError = {
      message: "Vessel ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(`${API_BASE}/vessels/${encodeURIComponent(vesselId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  const result = await parseResponse(response);
  return unwrapData<Vessel>(result);
}

export async function getVesselVoyages(vesselId: string): Promise<Voyage[]> {
  if (!vesselId) {
    const error: ApiError = {
      message: "Vessel ID is required.",
      status: 400,
    };

    throw error;
  }

  try {
    const response = await fetch(`${API_BASE}/vessels/${encodeURIComponent(vesselId)}/voyages`);
    const result = await parseResponse(response);

    const voyages = unwrapData<unknown>(result);

    if (!Array.isArray(voyages)) {
      if (Array.isArray((result as any)?.data)) {
        return (result as any).data as Voyage[];
      }

      return [];
    }

    return voyages as Voyage[];
  } catch (error) {
    console.error(`Failed to fetch voyages for vessel ${vesselId}:`, error);
    throw error;
  }
}
export async function getVoyages(): Promise<VoyageListItem[]> {
  try {
    const response = await fetch(`${API_BASE}/voyages`);

    const result = await parseResponse(response);

    const voyages = unwrapData<unknown>(result);

    if (!Array.isArray(voyages)) {
      return [];
    }

    return voyages as VoyageListItem[];
  } catch (error) {
    console.error("Failed to fetch voyages:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create voyage
// ─────────────────────────────────────────────────────────────────────────────

export async function createVoyage(
  dto: CreateVoyageDto
): Promise<Voyage> {
  try {
    const response = await fetch(`${API_BASE}/voyages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });

    const result = await parseResponse(response);

    return unwrapData<Voyage>(result);
  } catch (error) {
    console.error("Failed to create voyage:", error);
    throw error;
  }
}

export async function updateVoyage(
  voyageId: string,
  dto: UpdateVoyageDto,
): Promise<Voyage> {
  if (!voyageId) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  try {
    const response = await fetch(
      `${API_BASE}/voyages/${encodeURIComponent(voyageId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dto),
      }
    );

    const result = await parseResponse(response);

    return unwrapData<Voyage>(result);
  } catch (error) {
    console.error(`Failed to update voyage ${voyageId}:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Voyage summary
// ─────────────────────────────────────────────────────────────────────────────

export async function getVoyageSummary(
  id: string
): Promise<any> {
  if (!id) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  try {
    const response = await fetch(
      `${API_BASE}/voyages/${encodeURIComponent(id)}/summary`
    );

    const result = await parseResponse(response);

    return unwrapData<any>(result);
  } catch (error) {
    console.error(
      `Failed to fetch voyage summary ${id}:`,
      error
    );

    throw error;
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// SOF documents / events
// ───────────────────────────────────────────────────────────────────────────────

export async function getSofDocuments(
  voyageId: string,
  params?: { page?: number; limit?: number }
): Promise<Paginated<SofDocument>> {
  if (!voyageId) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/sof-documents${buildQueryString(params)}`
  );

  const result = await parseResponse(response);
  return result as Paginated<SofDocument>;
}

export async function createSofDocument(
  voyageId: string,
  dto: CreateSofDocumentDto
): Promise<SofDocument> {
  if (!voyageId) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/sof-documents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  const result = await parseResponse(response);
  return unwrapData<SofDocument>(result);
}

export async function getSofEvents(
  sofId: string,
  params?: { page?: number; limit?: number }
): Promise<Paginated<SofEvent>> {
  if (!sofId) {
    const error: ApiError = {
      message: "SOF document ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/sof-documents/${encodeURIComponent(sofId)}/events${buildQueryString(params)}`
  );

  const result = await parseResponse(response);
  return result as Paginated<SofEvent>;
}

export async function createSofEvent(
  sofId: string,
  dto: CreateSofEventDto
): Promise<SofEvent> {
  if (!sofId) {
    const error: ApiError = {
      message: "SOF document ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/sof-documents/${encodeURIComponent(sofId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  const result = await parseResponse(response);
  return unwrapData<SofEvent>(result);
}

export async function updateSofEvent(
  eventId: string,
  dto: UpdateSofEventDto
): Promise<SofEvent> {
  if (!eventId) {
    const error: ApiError = {
      message: "SOF event ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/sof-events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    }
  );

  const result = await parseResponse(response);
  return unwrapData<SofEvent>(result);
}

export async function getNorTenderLocationEvidence(
  voyageId: string,
  params?: {
    page?: number;
    limit?: number;
    operation?: "Loading" | "Discharge";
  },
): Promise<Paginated<NorTenderLocationEvidence>> {
  if (!voyageId) {
    throw { message: "Voyage ID is required.", status: 400 } as ApiError;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/nor-tender-location-evidence${buildQueryString(params)}`,
  );
  return (await parseResponse(response)) as Paginated<NorTenderLocationEvidence>;
}

export async function createNorTenderLocationEvidence(
  voyageId: string,
  dto: CreateNorTenderLocationEvidenceDto,
): Promise<NorTenderLocationEvidence> {
  if (!voyageId) {
    throw { message: "Voyage ID is required.", status: 400 } as ApiError;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/nor-tender-location-evidence`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    },
  );
  return unwrapData<NorTenderLocationEvidence>(await parseResponse(response));
}

export async function getLaytimeCalculations(
  voyageId: string,
  params?: { page?: number; limit?: number }
): Promise<Paginated<LaytimeCalculation>> {
  if (!voyageId) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/laytime-calculations${buildQueryString(params)}`
  );

  const result = await parseResponse(response);
  return result as Paginated<LaytimeCalculation>;
}

export async function getLaytimeOperationResults(
  parentCalculationId: string
): Promise<LaytimeOperationResult[]> {
  if (!parentCalculationId) {
    const error: ApiError = {
      message: "Calculation ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/laytime-calculations/${encodeURIComponent(parentCalculationId)}/operation-results`
  );

  const result = await parseResponse(response);

  if (Array.isArray(result)) {
    return result as LaytimeOperationResult[];
  }

  return (result?.data ?? []) as LaytimeOperationResult[];
}

export async function getLaytimeCalculationAudit(
  calculationId: string,
): Promise<LaytimeCalculationAudit> {
  if (!calculationId) {
    const error: ApiError = {
      message: "Calculation ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/laytime-calculations/${encodeURIComponent(calculationId)}/audit`,
  );

  const result = await parseResponse(response);
  return unwrapData<LaytimeCalculationAudit>(result);
}

export async function runLaytimeCalculation(
  voyageId: string
): Promise<LaytimeCalculationResult> {
  if (!voyageId) {
    const error: ApiError = {
      message: "Voyage ID is required.",
      status: 400,
    };

    throw error;
  }

  const response = await fetch(
    `${API_BASE}/voyages/${encodeURIComponent(voyageId)}/laytime-calculations`,
    {
      method: "POST",
    }
  );

  const result = await parseResponse(response);
  return unwrapData<LaytimeCalculationResult>(result);
}

export async function createBulkDispute(
  dto: CreateBulkDisputeDto
): Promise<any> {
  const response = await fetch(`${API_BASE}/bulk-disputes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dto),
  });

  const result = await parseResponse(response);
  return unwrapData<any>(result);
}

export async function getBulkDisputes(
  params?: { page?: number; limit?: number }
): Promise<Paginated<BulkDispute>> {
  const response = await fetch(`${API_BASE}/bulk-disputes${buildQueryString(params)}`);

  const result = await parseResponse(response);
  if (Array.isArray(result)) {
    return {
      data: result as BulkDispute[],
      meta: {
        page: params?.page ?? 1,
        limit: params?.limit ?? result.length,
        total: result.length,
      },
    };
  }

  return result as Paginated<BulkDispute>;
}

export async function getAllBulkDisputes(): Promise<BulkDispute[]> {
  const firstPage = await getBulkDisputes({ page: 1, limit: 200 });
  const disputes = [...firstPage.data];
  const total = firstPage.meta?.total ?? disputes.length;
  const limit = firstPage.meta?.limit ?? (disputes.length || 200);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await getBulkDisputes({ page, limit });
    disputes.push(...nextPage.data);
  }

  return disputes;
}

