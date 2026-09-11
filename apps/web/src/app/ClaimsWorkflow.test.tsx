import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClaimCreatePanel from "./ClaimCreatePanel";
import ClaimsAuditConsole from "./ClaimsAuditConsole";
import ClaimsList from "./ClaimsList";
import ShipmentClaimsPanel from "./ShipmentClaimsPanel";

const mocks = vi.hoisted(() => ({
  createBulkDispute: vi.fn(),
  getBulkDispute: vi.fn(),
  getBulkDisputes: vi.fn(),
  getLaytimeCalculationAudit: vi.fn(),
  getLaytimeCalculations: vi.fn(),
  getVoyageSummary: vi.fn(),
  getVoyages: vi.fn(),
  updateBulkDispute: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, ...mocks };
});

const authoritativeCalculation = {
  id: "calculation-1",
  voyageId: "voyage-1",
  version: 4,
  allowedLaytime: "3 days",
  usedLaytime: "3 days 04:00:00",
  demurrageAmount: "1200.00",
  despatchAmount: "0.00",
  currency: "USD",
  status: "Final",
  settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
  calculatedAt: "2026-09-20T00:00:00.000Z",
  warnings: [],
  inputSnapshot: { sofDocumentSelection: { includedDocumentIds: ["sof-1"] } },
  decisionSnapshot: {
    reversibleSettlement: {
      settlementStatus: "FINAL_AUTHORITATIVE",
      demurrageAmount: 1200,
      despatchAmount: 0,
    },
    commencement: { commencedAt: "2026-09-16T00:00:00.000Z" },
    cargoCompletion: { selectedTime: "2026-09-20T00:00:00.000Z" },
  },
};

const nonAuthoritativeCalculation = {
  ...authoritativeCalculation,
  settlementAuthorityStatus: "NONAUTHORITATIVE",
  decisionSnapshot: {
    reversibleSettlement: {
      settlementStatus: "NONAUTHORITATIVE",
      demurrageAmount: 1200,
      despatchAmount: 0,
    },
  },
};

const provisionalCalculation = {
  ...authoritativeCalculation,
  status: "Draft",
};

const authoritativeNonReversibleCalculation = {
  ...authoritativeCalculation,
  decisionSnapshot: {
    nonReversibleSettlement: {
      version: 1,
      settlementMode: "separate_operation_results",
      settlementStatus: "PROVISIONAL",
      finalizationEligible: true,
    },
  },
};

const referenceOnlyChildCalculation = {
  ...authoritativeCalculation,
  id: "loading-child",
  parentCalculationId: "reversible-parent",
  operation: "Loading",
};

const claim = {
  id: "claim-1",
  voyageId: "voyage-1",
  type: "demurrage_counter",
  amountDisputed: "1200.00",
  currency: "USD",
  status: "Open",
  createdDate: "2026-09-21T00:00:00.000Z",
  finalSettlementAmount: null,
  resolvedDate: null,
};

function paginated(data: any[]) {
  return { data, meta: { page: 1, limit: 200, total: data.length } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLaytimeCalculations.mockResolvedValue(paginated([authoritativeCalculation]));
  mocks.getBulkDisputes.mockResolvedValue(paginated([claim]));
  mocks.createBulkDispute.mockResolvedValue({ ...claim, id: "claim-created" });
  mocks.getBulkDispute.mockResolvedValue(claim);
  mocks.getVoyageSummary.mockResolvedValue({ voyage: { reference: "VOY-1", counterpartyLinks: [] } });
  mocks.getLaytimeCalculationAudit.mockResolvedValue({ auditAvailable: true, warnings: [], calculation: {} });
  mocks.updateBulkDispute.mockResolvedValue(claim);
  mocks.getVoyages.mockResolvedValue([]);
});

describe("claims workflow", () => {
  it("renders persisted shipment claims and filters to the voyage endpoint", async () => {
    render(<ShipmentClaimsPanel voyageId="voyage-1" onOpenClaim={vi.fn()} />);

    expect(await screen.findByText("claim-1")).toBeInTheDocument();
    expect(screen.getByText("Demurrage counterclaim")).toBeInTheDocument();
    expect(screen.getByText("$1,200.00")).toBeInTheDocument();
    expect(mocks.getBulkDisputes).toHaveBeenCalledWith({ voyageId: "voyage-1", page: 1, limit: 200 });
  });

  it("creates a claim through the real endpoint from a final authoritative reversible result", async () => {
    render(<ClaimCreatePanel initialVoyageId="voyage-1" onCreated={vi.fn()} />);

    expect(await screen.findByText(/Eligible source: final authoritative reversible settlement/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Create claim" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(mocks.createBulkDispute).toHaveBeenCalledWith({
      voyageId: "voyage-1",
      type: "demurrage_counter",
      amountDisputed: 1200,
      status: "Open",
    }));
  });

  it("keeps a non-authoritative reversible result out of claim creation", async () => {
    mocks.getLaytimeCalculations.mockResolvedValue(paginated([nonAuthoritativeCalculation]));
    render(<ClaimCreatePanel initialVoyageId="voyage-1" />);

    expect(await screen.findByText(/not commercially authoritative/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create claim" })).toBeDisabled();
    expect(mocks.createBulkDispute).not.toHaveBeenCalled();
  });

  it("does not present a final authoritative non-reversible result as claimable until the backend supports operation-linked claims", async () => {
    mocks.getLaytimeCalculations.mockResolvedValue(paginated([authoritativeNonReversibleCalculation]));
    render(<ClaimCreatePanel initialVoyageId="voyage-1" />);

    expect(await screen.findByText(/operation-linked authoritative source calculation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create claim" })).toBeDisabled();
    expect(screen.getByLabelText(/Amount disputed/)).toHaveValue(null);
    expect(mocks.createBulkDispute).not.toHaveBeenCalled();
  });

  it("keeps a provisional result out of final claim creation", async () => {
    mocks.getLaytimeCalculations.mockResolvedValue(paginated([provisionalCalculation]));
    render(<ClaimCreatePanel initialVoyageId="voyage-1" />);

    expect(await screen.findByText(/Calculation is still provisional/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create claim" })).toBeDisabled();
    expect(mocks.createBulkDispute).not.toHaveBeenCalled();
  });

  it("keeps a reference-only reversible child out of independent claim creation", async () => {
    mocks.getLaytimeCalculations.mockResolvedValue(paginated([referenceOnlyChildCalculation]));
    render(<ClaimCreatePanel initialVoyageId="voyage-1" />);

    expect(await screen.findByText(/supporting evidence only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create claim" })).toBeDisabled();
    expect(mocks.createBulkDispute).not.toHaveBeenCalled();
  });

  it("surfaces backend validation errors without creating a fake claim", async () => {
    mocks.createBulkDispute.mockRejectedValue(new Error("The claim amount must match the finalized authoritative reversible settlement."));
    render(<ClaimCreatePanel initialVoyageId="voyage-1" />);
    const button = await screen.findByRole("button", { name: "Create claim" });
    fireEvent.click(button);

    expect(await screen.findByText(/claim amount must match/i)).toBeInTheDocument();
  });

  it("renders persisted claim detail and records resolution through the PATCH endpoint", async () => {
    render(
      <MemoryRouter>
        <ClaimsAuditConsole claimId="claim-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Persisted bulk-dispute record and supported backend context.")).toBeInTheDocument();
    expect(screen.getByText("Final authoritative")).toBeInTheDocument();
    expect(screen.getByText(/does not persist a source calculation ID/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Final settlement amount"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Resolved date"), { target: { value: "2026-09-22T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolve claim" }));

    await waitFor(() => expect(mocks.updateBulkDispute).toHaveBeenCalledWith("claim-1", expect.objectContaining({
      status: "Resolved",
      finalSettlementAmount: 1000,
    })));
  });

  it("handles an empty claim list safely", async () => {
    mocks.getBulkDisputes.mockResolvedValue(paginated([]));
    render(
      <MemoryRouter>
        <ClaimsList onOpenClaim={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No persisted claims were returned by the API.")).toBeInTheDocument();
  });
});
