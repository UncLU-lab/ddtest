import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import SOFTimeline from "./SOFTimeline";

const apiMocks = vi.hoisted(() => ({
  createBulkDispute: vi.fn(),
  createNorTenderLocationEvidence: vi.fn(),
  createSofDocument: vi.fn(),
  createSofEvent: vi.fn(),
  getLaytimeCalculations: vi.fn(),
  getLaytimeOperationResults: vi.fn(),
  getNorTenderLocationEvidence: vi.fn(),
  getSofDocuments: vi.fn(),
  getSofEvents: vi.fn(),
  reversibleSettlementStatusLabel: vi.fn(
    (status?: string | null) => status ?? "Not available",
  ),
  runLaytimeCalculation: vi.fn(),
  updateSofEvent: vi.fn(),
}));

vi.mock("./Layout", () => ({
  PageHeader: ({
    crumbs,
    actions,
  }: {
    crumbs?: Array<{ label: string }>;
    actions?: ReactNode;
  }) => (
    <div>
      <div>{crumbs?.map((crumb) => crumb.label).join(" / ")}</div>
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock("./data/ShipmentsContext", () => ({
  useShipments: () => ({
    getShipmentById: () => ({
      id: "voyage-1",
      vessel: "MV Stage Test",
      cargoType: "Coal",
      cargoQuantity: 50000,
      port: "SGSIN",
      eta: "2026-08-25T00:00:00Z",
      laytimeOperation: "Discharge",
    }),
  }),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ id: "voyage-1" }),
}));

vi.mock("../lib/api", () => apiMocks);

function buildDocument() {
  return {
    id: "sof-1",
    voyageId: "voyage-1",
    filePath: "voyages/voyage-1/statement-of-facts.pdf",
    uploadDate: "2026-08-25T00:00:00Z",
    status: "Final" as const,
    operation: "Discharge" as const,
  };
}

function buildEvent() {
  return {
    id: "event-1",
    sofId: "sof-1",
    eventTime: "2026-08-25T01:00:00Z",
    eventType: "NOR_TENDERED",
    operation: "Discharge" as const,
    remarks: null,
    confidenceScore: null,
    isManualOverride: true,
    overrideReason: null,
    createdAt: "2026-08-25T01:00:00Z",
  };
}

function buildCalculation(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "calc-1",
    voyageId: "voyage-1",
    version: 2,
    allowedLaytime: "1 days 00:00:00",
    usedLaytime: "0 days 06:00:00",
    demurrageAmount: "9375.00",
    despatchAmount: "0.00",
    settlementAuthorityStatus: "PROVISIONAL",
    currency: "USD",
    status: "Final",
    calculatedAt: "2026-09-15T06:45:00.000Z",
    warnings: [],
    inputSnapshot: {
      operationSelection: {
        voyageLaytimeOperation: "Discharge",
        hasLoadingCompletion: false,
        hasDischargeCompletion: true,
        mixedOperationEvidence: false,
        includedCompletionEventIds: ["event-1"],
        excludedCompletionEventIds: [],
      },
    },
    decisionSnapshot: {
      commencement: {
        commencedAt: "2026-09-15T06:45:00.000Z",
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getSofDocuments.mockResolvedValue({ data: [buildDocument()] });
  apiMocks.getSofEvents.mockResolvedValue({ data: [buildEvent()] });
  apiMocks.getNorTenderLocationEvidence.mockResolvedValue({ data: [] });
  apiMocks.getLaytimeCalculations.mockResolvedValue({ data: [] });
  apiMocks.getLaytimeOperationResults.mockResolvedValue([]);
});

describe("SOFTimeline laytime error handling", () => {
  it("keeps the page rendered and shows the backend 422 message when laytime calculation fails", async () => {
    apiMocks.runLaytimeCalculation.mockRejectedValue({
      status: 422,
      message: "Laytime calculation rejected by backend",
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("SOF event log")).toBeInTheDocument();
    expect(screen.getByText("NOR tender-location evidence")).toBeInTheDocument();
    expect(screen.queryByText("Operation selection")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run laytime calculation/i }));

    expect(
      await screen.findByText("Laytime calculation rejected by backend"),
    ).toBeInTheDocument();
    expect(screen.getByText("SOF event log")).toBeInTheDocument();
    expect(screen.getByText("NOR tender-location evidence")).toBeInTheDocument();
    expect(screen.getByText("NOR tendered")).toBeInTheDocument();
    expect(screen.queryByText("Backend laytime calculation loaded.")).not.toBeInTheDocument();
    expect(screen.queryByText("Operation selection")).not.toBeInTheDocument();
    expect(apiMocks.runLaytimeCalculation).toHaveBeenCalledWith("voyage-1");
  });

  it("renders a successful laytime calculation response using inputSnapshot.operationSelection", async () => {
    const calculation = buildCalculation();
    apiMocks.getLaytimeCalculations.mockResolvedValue({ data: [calculation] });
    apiMocks.runLaytimeCalculation.mockResolvedValue({
      calculation,
      warnings: [],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Operation selection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /run laytime calculation/i }));

    expect(
      await screen.findByText("Discharge completion found"),
    ).toBeInTheDocument();
    expect(screen.getByText("Voyage laytime operation")).toBeInTheDocument();
    expect(screen.getByText("Discharge")).toBeInTheDocument();
    expect(screen.queryByText("Laytime calculation failed")).not.toBeInTheDocument();
    expect(apiMocks.runLaytimeCalculation).toHaveBeenCalledWith("voyage-1");
  });

  it("renders a persisted calculation reload using inputSnapshot.operationSelection without crashing", async () => {
    const calculation = buildCalculation();
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [calculation],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Operation selection")).toBeInTheDocument();
    expect(screen.getByText("Discharge completion found")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Loading completion found")).toBeInTheDocument();
  });

  it("renders the operation-selection section defensively when the optional audit data is absent", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [
        buildCalculation({
          inputSnapshot: {},
        }),
      ],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Operation selection")).toBeInTheDocument();
    expect(
      screen.getAllByText("Not available for this calculation version.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Discharge completion found")).not.toBeInTheDocument();
  });
});
