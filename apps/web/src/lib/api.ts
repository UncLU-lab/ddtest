// API client for the Demurrage Defender backend

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

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
  laycanStart: string;
  laycanEnd: string;
  eta?: string;
  status?: string;
  [key: string]: unknown;
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

export interface LaytimeCalculation {
  id: string;
  voyageId: string;
  version: number;
  allowedLaytime: string;
  usedLaytime: string;
  demurrageAmount: string;
  despatchAmount: string;
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

export interface LaytimeDecisionSnapshot {
  commencement?: {
    commencedAt?: string | null;
    [key: string]: unknown;
  };
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
  [key: string]: unknown;
}

export interface LaytimeCalculationResult {
  calculation: LaytimeCalculation;
  warnings: string[];
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
  laytimeAllowed?: number;
  demurrageRate?: number;
  dispatchRate?: number;
  timeCountingBasis?: string;
  norNoticePeriod?: string;
  status?: "Planned" | "Active" | "Completed" | "Cancelled";
}

export interface UpdateVoyageDto extends Partial<CreateVoyageDto> {}

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
export async function getVoyages(): Promise<Voyage[]> {
  try {
    const response = await fetch(`${API_BASE}/voyages`);

    const result = await parseResponse(response);

    const voyages = unwrapData<unknown>(result);

    if (!Array.isArray(voyages)) {
      return [];
    }

    return voyages as Voyage[];
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

