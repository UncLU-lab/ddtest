import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";
import SOFTimeline from "./SOFTimeline";
import { resolveLocalDateTimeInTimeZone } from "../lib/sourceTimeZone";

const apiMocks = vi.hoisted(() => ({
  createBulkDispute: vi.fn(),
  createLaytimeStatement: vi.fn(),
  finalizeLaytimeCalculation: vi.fn(),
  createNorTenderLocationEvidence: vi.fn(),
  createSofDocument: vi.fn(),
  createSofEvent: vi.fn(),
  getLaytimeCalculations: vi.fn(),
  getLaytimeOperationResults: vi.fn(),
  getLaytimeStatements: vi.fn(),
  getNorTenderLocationEvidence: vi.fn(),
  getSofDocuments: vi.fn(),
  getSofEvents: vi.fn(),
  importSofFixture: vi.fn(),
  reversibleSettlementStatusLabel: vi.fn(
    (status?: string | null) => status ?? "Not available",
  ),
  runLaytimeCalculation: vi.fn(),
  updateSofDocument: vi.fn(),
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

function buildEvent(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function buildRainEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "rain-1",
    sofId: "sof-1",
    eventTime: "2026-09-16T00:00:00.000Z",
    eventType: "RAIN_STOPPAGE",
    operation: "Discharge" as const,
    remarks: JSON.stringify({
      cause: "Weather",
      duration: "6",
      deductible: false,
      notes: "Rain stopped cargo work",
    }),
    confidenceScore: null,
    isManualOverride: true,
    overrideReason: null,
    createdAt: "2026-09-16T00:00:00.000Z",
    ...overrides,
  };
}

function buildCalculation(overrides: Record<string, unknown> = {}) {
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

function buildNonReversibleCalculation(
  overrides: Record<string, unknown> = {},
) {
  return buildCalculation({
    allowedLaytime: null,
    usedLaytime: null,
    decisionSnapshot: {
      commencement: {
        commencedAt: "2026-09-15T06:45:00.000Z",
      },
      cargoCompletion: {
        selectedTime: "2026-09-19T04:00:00.000Z",
        eventTime: "2026-09-19T04:00:00.000Z",
        selectedEventId: "completion-1",
        excludedEventIds: [],
      },
      nonReversibleSettlement: {
        version: 1,
        settlementMode: "separate_operation_results",
        expectedOperationScope: "Discharge",
        expectedOperations: ["Discharge"],
        settlementStatus: "PROVISIONAL",
        finalizationEligible: true,
        operations: {
          Discharge: {
            operation: "Discharge",
            allowedSeconds: 259200,
            usedSeconds: 299700,
          },
        },
        monetaryAggregation: {
          status: "AVAILABLE",
          currency: "USD",
          netExposure: 9375,
          netDirection: "NET_PAYABLE",
          legalNetting: false,
          claimableAsAggregate: false,
        },
      },
    },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.createBulkDispute.mockReset();
  apiMocks.createLaytimeStatement.mockReset();
  apiMocks.finalizeLaytimeCalculation.mockReset();
  apiMocks.createNorTenderLocationEvidence.mockReset();
  apiMocks.createSofDocument.mockReset();
  apiMocks.createSofEvent.mockReset();
  apiMocks.getLaytimeCalculations.mockReset();
  apiMocks.getLaytimeOperationResults.mockReset();
  apiMocks.getLaytimeStatements.mockReset();
  apiMocks.getNorTenderLocationEvidence.mockReset();
  apiMocks.getSofDocuments.mockReset();
  apiMocks.getSofEvents.mockReset();
  apiMocks.importSofFixture.mockReset();
  apiMocks.runLaytimeCalculation.mockReset();
  apiMocks.updateSofDocument.mockReset();
  apiMocks.updateSofEvent.mockReset();
  apiMocks.getSofDocuments.mockResolvedValue({ data: [buildDocument()] });
  apiMocks.createSofDocument.mockResolvedValue(buildDocument());
  apiMocks.updateSofDocument.mockResolvedValue(buildDocument());
  apiMocks.getSofEvents.mockResolvedValue({ data: [buildEvent()] });
  apiMocks.getNorTenderLocationEvidence.mockResolvedValue({ data: [] });
  apiMocks.getLaytimeCalculations.mockResolvedValue({ data: [] });
  apiMocks.getLaytimeOperationResults.mockResolvedValue([]);
  apiMocks.getLaytimeStatements.mockResolvedValue([]);
  apiMocks.createLaytimeStatement.mockResolvedValue({});
  apiMocks.finalizeLaytimeCalculation.mockResolvedValue({});
  apiMocks.importSofFixture.mockResolvedValue({
    sofDocumentId: "sof-1",
    operation: "Discharge",
    eventCount: 1,
    createdDocument: true,
  });
});

describe("SOFTimeline laytime error handling", () => {
  it("previews and imports a valid fixture without finalising or calculating", async () => {
    const user = userEvent.setup();
    const fixture = {
      version: 1,
      operation: "Loading" as const,
      sourceTimeZone: "Australia/Sydney",
      events: [
        {
          eventTime: "2026-09-07T00:00",
          eventType: "NOR_TENDERED",
          exceptionCandidate: false,
        },
        {
          eventTime: "2026-09-09T06:00",
          eventType: "CARGO_COMPLETED",
          exceptionCandidate: false,
        },
      ],
    };
    apiMocks.getSofDocuments.mockResolvedValue({ data: [] });
    apiMocks.getSofEvents.mockResolvedValue({ data: [] });
    apiMocks.importSofFixture.mockResolvedValue({
      sofDocumentId: "fixture-sof",
      operation: "Loading",
      eventCount: 2,
      createdDocument: true,
    });

    render(<SOFTimeline />);

    expect(await screen.findByRole("button", { name: "Import fixture" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import fixture" }));
    const input = screen.getByLabelText("Choose fixture JSON");
    await user.upload(
      input,
      new File([JSON.stringify(fixture)], "stage-wx-003.json", {
        type: "application/json",
      }),
    );

    expect(await screen.findByText(/Loading \| Australia\/Sydney \| 2 events/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import events" }));

    await waitFor(() =>
      expect(apiMocks.importSofFixture).toHaveBeenCalledWith("voyage-1", fixture),
    );
    expect(apiMocks.getSofDocuments).toHaveBeenCalledTimes(2);
    expect(apiMocks.finalizeLaytimeCalculation).not.toHaveBeenCalled();
    expect(apiMocks.runLaytimeCalculation).not.toHaveBeenCalled();
  });

  it("shows local fixture validation errors and does not call the import endpoint", async () => {
    const user = userEvent.setup();
    apiMocks.getSofDocuments.mockResolvedValue({ data: [] });
    apiMocks.getSofEvents.mockResolvedValue({ data: [] });

    render(<SOFTimeline />);
    await screen.findByRole("button", { name: "Import fixture" });
    await user.click(screen.getByRole("button", { name: "Import fixture" }));
    await user.upload(
      screen.getByLabelText("Choose fixture JSON"),
      new File(
        [
          JSON.stringify({
            version: 1,
            operation: "Loading",
            sourceTimeZone: "Australia/Nowhere",
            events: [
              {
                eventTime: "2026-09-07T00:00",
                eventType: "NOT_A_SOF_EVENT",
                exceptionCandidate: false,
              },
            ],
          }),
        ],
        "invalid.json",
        { type: "application/json" },
      ),
    );

    expect(await screen.findByText("Fixture validation failed.")).toBeInTheDocument();
    expect(apiMocks.importSofFixture).not.toHaveBeenCalled();
  });

  it("finalises the explicitly selected SOF and keeps recalculation explicit", async () => {
    const draft = { ...buildDocument(), status: "Draft" as const };
    apiMocks.getSofDocuments.mockResolvedValue({ data: [draft] });
    apiMocks.updateSofDocument.mockResolvedValue({ ...draft, status: "Final" });

    render(<SOFTimeline />);

    expect(await screen.findByText("SOF source")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finalise SOF" }));
    expect(
      screen.getByText(
        /will become Final and may be used as authoritative evidence/i,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm finalise" }));

    await waitFor(() =>
      expect(apiMocks.updateSofDocument).toHaveBeenCalledWith("sof-1", {
        status: "Final",
      }),
    );
    expect(apiMocks.runLaytimeCalculation).not.toHaveBeenCalled();
  });

  it("identifies each SOF and finalises only the selected document", async () => {
    const olderDraft = {
      ...buildDocument(),
      id: "11111111-1111-4111-8111-aaaaaaaa1111",
      uploadDate: "2026-08-28T07:47:00.000Z",
      status: "Draft" as const,
    };
    const newerDraft = {
      ...buildDocument(),
      id: "22222222-2222-4222-8222-bbbbbbbb2222",
      uploadDate: "2026-08-29T07:47:00.000Z",
      status: "Draft" as const,
    };
    apiMocks.getSofDocuments.mockResolvedValue({
      data: [olderDraft, newerDraft],
    });
    apiMocks.getSofEvents.mockResolvedValue({ data: [] });
    apiMocks.updateSofDocument.mockResolvedValue({
      ...olderDraft,
      status: "Final",
    });

    render(<SOFTimeline />);

    const selector = await screen.findByRole("combobox", {
      name: "Reviewing SOF document",
    });
    const options = within(selector).getAllByRole("option");
    expect(options[0]).toHaveTextContent(/statement-of-facts\.pdf · Draft/);
    expect(options[0]).toHaveTextContent(/…bbbb2222/);
    expect(options[1]).toHaveTextContent(/…aaaa1111/);
    expect(selector).toHaveValue(newerDraft.id);

    fireEvent.change(selector, { target: { value: olderDraft.id } });
    await waitFor(() => expect(selector).toHaveValue(olderDraft.id));
    fireEvent.click(screen.getByRole("button", { name: "Finalise SOF" }));

    expect(screen.getByText(new RegExp(olderDraft.id))).toBeInTheDocument();
    expect(screen.getAllByText(/uploaded.*2026/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Confirm finalise" }));

    await waitFor(() =>
      expect(apiMocks.updateSofDocument).toHaveBeenCalledWith(olderDraft.id, {
        status: "Final",
      }),
    );
    expect(apiMocks.updateSofDocument).not.toHaveBeenCalledWith(newerDraft.id, {
      status: "Final",
    });
  });
  it("uses the associated NOR source timezone for location evidence", async () => {
    apiMocks.getSofEvents.mockResolvedValue({
      data: [
        buildEvent({
          eventTime: "2026-10-10T00:30:00.000Z",
          sourceTimeZone: "Australia/Perth",
          operation: "Loading",
        }),
      ],
    });
    apiMocks.createNorTenderLocationEvidence.mockResolvedValue({});

    render(<SOFTimeline />);
    await screen.findByText("NOR tendered");
    fireEvent.click(
      screen.getByRole("button", { name: /add location evidence/i }),
    );

    const candidate = screen.getByRole("option", { name: /Australia\/Perth/ });
    expect(candidate.textContent).toMatch(/8:30|08:30/);
    fireEvent.change(screen.getByLabelText(/associated NOR tender/i), {
      target: { value: "event-1" },
    });
    expect(screen.getByLabelText(/source timezone/i)).toHaveValue(
      "Australia/Perth",
    );

    fireEvent.change(screen.getByLabelText(/observed at/i), {
      target: { value: "2026-10-10T08:25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /record evidence/i }));

    await waitFor(() =>
      expect(apiMocks.createNorTenderLocationEvidence).toHaveBeenCalledWith(
        "voyage-1",
        expect.objectContaining({
          evidenceTime: "2026-10-10T00:25:00.000Z",
          sourceTimeZone: "Australia/Perth",
          norTenderedEventId: "event-1",
        }),
      ),
    );
  });

  it("keeps the page rendered and shows the backend 422 message when laytime calculation fails", async () => {
    apiMocks.runLaytimeCalculation.mockRejectedValue({
      status: 422,
      message: "Laytime calculation rejected by backend",
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("SOF event log")).toBeInTheDocument();
    expect(
      screen.getByText("NOR tender-location evidence"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Operation selection")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /run laytime calculation/i }),
    );

    expect(
      await screen.findByText("Laytime calculation rejected by backend"),
    ).toBeInTheDocument();
    expect(screen.getByText("SOF event log")).toBeInTheDocument();
    expect(
      screen.getByText("NOR tender-location evidence"),
    ).toBeInTheDocument();
    expect(screen.getByText("NOR tendered")).toBeInTheDocument();
    expect(
      screen.queryByText("Backend laytime calculation loaded."),
    ).not.toBeInTheDocument();
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
    fireEvent.click(
      screen.getByRole("button", { name: /run laytime calculation/i }),
    );

    expect(
      await screen.findByText("Discharge completion found"),
    ).toBeInTheDocument();
    expect(screen.getByText("Voyage laytime operation")).toBeInTheDocument();
    expect(screen.getByText("Discharge")).toBeInTheDocument();
    expect(
      screen.queryByText("Laytime calculation failed"),
    ).not.toBeInTheDocument();
    expect(apiMocks.runLaytimeCalculation).toHaveBeenCalledWith("voyage-1");
  });

  it("creates a Laytime Statement only from the authoritative calculation", async () => {
    const calculation = buildCalculation({
      settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
      status: "Final",
      currency: "USD",
    });
    apiMocks.getLaytimeCalculations.mockResolvedValue({ data: [calculation] });
    apiMocks.createLaytimeStatement.mockResolvedValue({
      id: "statement-1",
      organizationId: "org-1",
      voyageId: "voyage-1",
      sourceCalculationId: calculation.id,
      sourceCalculationVersion: calculation.version,
      authoritativeSofDocumentIds: ["sof-1"],
      settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
      currency: "USD",
      version: 1,
      createdAt: "2026-09-15T06:45:00.000Z",
      statementSnapshot: {
        voyage: { reference: "VOY-1" },
        calculation: {
          calculatedAt: calculation.calculatedAt,
          settlement: {
            combinedAllowedSeconds: 86400,
            combinedUsedSeconds: 86400,
            combinedOverrunSeconds: 0,
            demurrageAmount: 0,
            despatchAmount: 0,
          },
          reversibleAnalysis: { pool: { transferableSurplusSeconds: 0 } },
          children: [],
        },
        sofDocuments: [{ filePath: "statement-of-facts.pdf", id: "sof-1" }],
      },
    });

    render(<SOFTimeline />);
    expect(
      await screen.findByRole("button", { name: "Create Laytime Statement" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Create Laytime Statement" }),
    );

    await waitFor(() =>
      expect(apiMocks.createLaytimeStatement).toHaveBeenCalledWith(
        calculation.id,
      ),
    );
    expect(await screen.findByText("Statement V1")).toBeInTheDocument();
    expect(screen.getByText("FINAL_AUTHORITATIVE")).toBeInTheDocument();
    expect(
      screen.getByText(/Final commercial position: USD 0\.00/),
    ).toBeInTheDocument();
  });

  it("finalizes the exact authoritative calculation without recalculating or creating a statement", async () => {
    const calculation = buildCalculation({
      settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
      status: "Draft",
    });
    apiMocks.getLaytimeCalculations.mockResolvedValue({ data: [calculation] });
    apiMocks.finalizeLaytimeCalculation.mockResolvedValue({
      ...calculation,
      status: "Final",
    });

    render(<SOFTimeline />);
    expect(await screen.findByText("Calculation status")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Finalise calculation" }),
    );
    expect(
      screen.getByText(/Inputs and results will not change/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm finalise" }));

    await waitFor(() =>
      expect(apiMocks.finalizeLaytimeCalculation).toHaveBeenCalledWith(
        calculation.id,
      ),
    );
    expect((await screen.findAllByText("Final")).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole("button", { name: "Create Laytime Statement" }),
    ).toBeEnabled();
    expect(apiMocks.runLaytimeCalculation).not.toHaveBeenCalled();
    expect(apiMocks.createLaytimeStatement).not.toHaveBeenCalled();
  });

  it("allows an eligible non-reversible calculation to be finalized while its settlement is provisional", async () => {
    const calculation = buildNonReversibleCalculation({
      settlementAuthorityStatus: "PROVISIONAL",
      status: "Draft",
    });
    apiMocks.getLaytimeCalculations.mockResolvedValue({ data: [calculation] });
    apiMocks.finalizeLaytimeCalculation.mockResolvedValue({
      ...calculation,
      status: "Final",
      settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Calculation status")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalise calculation" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Finalise calculation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm finalise" }));

    await waitFor(() =>
      expect(apiMocks.finalizeLaytimeCalculation).toHaveBeenCalledWith(
        calculation.id,
      ),
    );
  });

  it("keeps the created latest calculation when a stale refresh response arrives", async () => {
    const version2 = buildCalculation({
      id: "calc-2",
      version: 2,
      settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
      status: "Final",
      decisionSnapshot: {
        commencement: { commencedAt: "2026-09-15T06:45:00.000Z" },
        reversibleSettlement: { settlementStatus: "FINAL_AUTHORITATIVE" },
      },
    });
    const version3 = buildCalculation({
      id: "calc-3",
      version: 3,
      settlementAuthorityStatus: "PROVISIONAL",
      status: "Draft",
      decisionSnapshot: {
        commencement: { commencedAt: "2026-09-15T06:45:00.000Z" },
        reversibleSettlement: {
          settlementStatus: "PROVISIONAL",
          reasonCode: "DRAFT_SOF_EVIDENCE",
          reason:
            "No finalised Statement of Facts was available; the calculation used draft SOF events.",
        },
      },
    });

    apiMocks.getLaytimeCalculations
      .mockResolvedValueOnce({ data: [version2] })
      .mockResolvedValueOnce({ data: [version2] });
    apiMocks.runLaytimeCalculation.mockResolvedValueOnce({
      calculation: version3,
      warnings: [],
    });

    render(<SOFTimeline />);
    expect(
      (await screen.findAllByText("FINAL_AUTHORITATIVE")).length,
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: /run laytime calculation/i }),
    );

    await waitFor(() =>
      expect(screen.getAllByText("PROVISIONAL").length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByText("FINAL_AUTHORITATIVE")).toHaveLength(0);
    expect(apiMocks.getLaytimeCalculations).toHaveBeenCalledTimes(2);
  });

  it("selects the highest version when the calculation list is not insertion ordered", async () => {
    const version2 = buildCalculation({ id: "calc-2", version: 2 });
    const version3 = buildCalculation({
      id: "calc-3",
      version: 3,
      settlementAuthorityStatus: "PROVISIONAL",
    });
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [version3, version2],
    });

    render(<SOFTimeline />);

    await waitFor(() =>
      expect(apiMocks.getLaytimeOperationResults).toHaveBeenCalledWith(
        "calc-3",
      ),
    );
    expect(apiMocks.getLaytimeOperationResults).not.toHaveBeenCalledWith(
      "calc-2",
    );
  });

  it("does not render operation children from another parent version", async () => {
    const calculation = buildCalculation({ id: "calc-3", version: 3 });
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [calculation],
    });
    apiMocks.getLaytimeOperationResults.mockResolvedValue([
      {
        id: "loading-v2",
        parentCalculationId: "calc-2",
        operation: "Loading",
        voyageId: "voyage-1",
        version: 2,
        allowedLaytime: "1 days 00:00:00",
        usedLaytime: "0 days 00:00:00",
        demurrageAmount: "0.00",
        despatchAmount: "0.00",
        status: "Draft",
        calculatedAt: "2026-09-15T06:45:00.000Z",
      },
    ]);

    render(<SOFTimeline />);

    expect(
      await screen.findByText(
        "Operation results do not belong to the selected laytime calculation version.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading operation result"),
    ).not.toBeInTheDocument();
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

  it("shows the reversible contract rule as applied when authority is provisional", async () => {
    const calculation = buildCalculation({
      settlementAuthorityStatus: "PROVISIONAL",
      status: "Draft",
      decisionSnapshot: {
        reversibleLaytimeRule: {
          enabled: true,
          contractStatus: "v1",
          settlementVersion: 1,
          allowanceMode: "sum_operation_allowances",
        },
        reversibleLaytimeAnalysis: {
          status: "available",
          mode: "contract-enabled",
          contractRuleApplied: true,
          loading: null,
          discharge: null,
          pool: null,
        },
        reversibleSettlement: {
          settlementStatus: "PROVISIONAL",
          reasonCode: "DRAFT_SOF_EVIDENCE",
          reason: "Draft SOF evidence",
        },
      },
    });
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [calculation],
    });

    render(<SOFTimeline />);

    const ruleLabel = await screen.findByText("Contract rule applied");
    expect(ruleLabel.parentElement).toHaveTextContent("Yes");
    expect(screen.getAllByText("PROVISIONAL").length).toBeGreaterThan(0);
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
    expect(
      screen.queryByText("Discharge completion found"),
    ).not.toBeInTheDocument();
  });
});

describe("SOFTimeline exception candidate semantics", () => {
  it("shows neutral exception-candidate wording for weather events even when remarks.deductible is false", async () => {
    apiMocks.getSofEvents.mockResolvedValue({
      data: [buildRainEvent()],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Rain stoppage")).toBeInTheDocument();
    expect(screen.getAllByText("Exception candidate").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Deductible")).not.toBeInTheDocument();
  });

  it("uses neutral exception-candidate wording in the manual event form and keeps the persisted remarks payload compatible", async () => {
    const user = userEvent.setup();
    render(<SOFTimeline />);

    expect(await screen.findByText("SOF event log")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));

    expect(
      screen.getByLabelText(/mark as exception candidate/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Actual deductible time is determined by Charter Party rules during the laytime calculation.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/mark as deductible/i),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/event type/i), {
      target: { value: "RAIN_STOPPAGE" },
    });
    fireEvent.change(screen.getByLabelText(/event time/i), {
      target: { value: "2026-09-16T00:00" },
    });
    fireEvent.change(screen.getByLabelText(/source timezone/i), {
      target: { value: "Australia/Perth" },
    });
    fireEvent.change(screen.getByLabelText(/cause/i), {
      target: { value: "Weather" },
    });
    fireEvent.click(screen.getByLabelText(/mark as exception candidate/i));
    fireEvent.change(screen.getByLabelText(/^notes$/i), {
      target: { value: "Rain stopped cargo work" },
    });
    const saveEvent = screen.getByRole("button", { name: /save event/i });
    await waitFor(() => expect(saveEvent).toBeEnabled());
    await user.click(saveEvent);

    await waitFor(() => {
      expect(apiMocks.createSofEvent).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.createSofEvent).toHaveBeenCalledWith(
      "sof-1",
      expect.objectContaining({
        eventType: "RAIN_STOPPAGE",
        sourceTimeZone: "Australia/Perth",
        remarks: JSON.stringify({
          cause: "Weather",
          deductible: true,
          notes: "Rain stopped cargo work",
        }),
      }),
    );
  });

  it("persists the selected operation on an automatically created SOF document", async () => {
    const user = userEvent.setup();
    const loadingDocument = {
      ...buildDocument(),
      operation: "Loading" as const,
    };
    apiMocks.getSofDocuments.mockResolvedValue({ data: [] });
    apiMocks.getSofEvents.mockResolvedValue({ data: [] });
    apiMocks.createSofDocument.mockResolvedValue(loadingDocument);

    render(<SOFTimeline />);

    expect(await screen.findByText("SOF event log")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));
    fireEvent.change(screen.getByLabelText(/source timezone/i), {
      target: { value: "Australia/Sydney" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /operation/i }), {
      target: { value: "Loading" },
    });

    await user.click(screen.getByRole("button", { name: /save event/i }));

    await waitFor(() =>
      expect(apiMocks.createSofDocument).toHaveBeenCalledWith("voyage-1", {
        filePath: "voyages/voyage-1/statement-of-facts.pdf",
        status: "Draft",
        operation: "Loading",
      }),
    );
    expect(apiMocks.createSofEvent).toHaveBeenCalledWith(
      loadingDocument.id,
      expect.objectContaining({ operation: "Loading" }),
    );
  });

  it("submits the visible authoritative SOF event values and resets when reopened", async () => {
    const user = userEvent.setup();
    render(<SOFTimeline />);

    expect(await screen.findByText("SOF event log")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));

    fireEvent.change(screen.getByLabelText(/source timezone/i), {
      target: { value: "Australia/Perth" },
    });
    fireEvent.change(screen.getByLabelText(/event time/i), {
      target: { value: "2026-10-10T08:00" },
    });
    fireEvent.change(screen.getByLabelText(/event type/i), {
      target: { value: "VESSEL_READY_IN_ALL_RESPECTS" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /operation/i }), {
      target: { value: "Loading" },
    });
    fireEvent.change(screen.getByLabelText(/cause/i), {
      target: { value: "Vessel" },
    });
    fireEvent.change(screen.getByLabelText(/^notes$/i), {
      target: { value: "Vessel ready for loading" },
    });
    const saveEvent = screen.getByRole("button", { name: /save event/i });
    await waitFor(() => expect(saveEvent).toBeEnabled());
    await user.click(saveEvent);

    await waitFor(() => {
      expect(apiMocks.createSofEvent).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.createSofEvent).toHaveBeenCalledWith(
      "sof-1",
      expect.objectContaining({
        eventTime: resolveLocalDateTimeInTimeZone(
          "2026-10-10T08:00",
          "Australia/Perth",
        ),
        sourceTimeZone: "Australia/Perth",
        eventType: "VESSEL_READY_IN_ALL_RESPECTS",
        operation: "Loading",
        remarks: JSON.stringify({
          cause: "Vessel",
          deductible: false,
          notes: "Vessel ready for loading",
        }),
      }),
    );
    expect(apiMocks.getSofEvents).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("SOF event created successfully."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add event/i }));
    expect(screen.getByLabelText(/source timezone/i)).toHaveValue("");
    expect(screen.getByLabelText(/event time/i)).not.toHaveValue(
      "2026-10-10T08:00",
    );
    expect(screen.getByLabelText(/event type/i)).toHaveValue("NOR_TENDERED");
    expect(screen.getByRole("combobox", { name: /operation/i })).toHaveValue(
      "Discharge",
    );
    expect(screen.getByLabelText(/^notes$/i)).toHaveValue("");
  });

  it("enables the exact valid Event 12 manual correction and refreshes the corrected row", async () => {
    const originalEvent = buildEvent();
    originalEvent.id = "event-12";
    originalEvent.eventTime = "2026-10-06T14:30:00.000Z";
    originalEvent.eventType = "DISCHARGE_COMPLETED";
    originalEvent.remarks = JSON.stringify({
      cause: "Vessel",
      notes: "Discharge hoses disconnected",
    });
    const correctedEvent = {
      ...originalEvent,
      eventType: "HOSES_DISCONNECTED",
    };
    apiMocks.getSofEvents
      .mockResolvedValueOnce({ data: [originalEvent] })
      .mockResolvedValueOnce({ data: [correctedEvent] });
    apiMocks.updateSofEvent.mockResolvedValue(correctedEvent);

    render(<SOFTimeline />);

    expect(await screen.findByText("Discharge completed")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Discharge completed" }),
    );

    expect(screen.getByRole("combobox", { name: /event type/i })).toHaveValue(
      "DISCHARGE_COMPLETED",
    );
    expect(screen.getByRole("combobox", { name: /operation/i })).toHaveValue(
      "Discharge",
    );
    expect(
      screen.getByDisplayValue("Discharge hoses disconnected"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Make a change before saving.",
    );

    fireEvent.change(screen.getByLabelText(/event type/i), {
      target: { value: "HOSES_DISCONNECTED" },
    });
    const saveChanges = screen.getByRole("button", { name: "Save changes" });
    expect(saveChanges).toBeEnabled();
    expect(
      screen.queryByText(/override reason/i, { selector: "[role=alert]" }),
    ).not.toBeInTheDocument();
    fireEvent.click(saveChanges);

    await waitFor(() => {
      expect(apiMocks.updateSofEvent).toHaveBeenCalledWith(
        "event-12",
        expect.objectContaining({
          eventType: "HOSES_DISCONNECTED",
          operation: "Discharge",
          remarks: JSON.stringify({
            cause: "Vessel",
            deductible: false,
            notes: "Discharge hoses disconnected",
          }),
        }),
      );
    });
    expect(
      await screen.findByText("SOF event updated successfully."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Hoses disconnected")).toBeInTheDocument();
    expect(
      screen.getByText(new Date(originalEvent.eventTime).toLocaleString()),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Discharge hoses disconnected"),
    ).toBeInTheDocument();
    expect(apiMocks.getSofEvents).toHaveBeenCalledTimes(2);
    expect(apiMocks.runLaytimeCalculation).not.toHaveBeenCalled();
  });

  it("cancels a manual event edit without calling the update endpoint", async () => {
    render(<SOFTimeline />);

    expect(await screen.findByText("NOR tendered")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit NOR tendered" }));
    fireEvent.change(screen.getByLabelText(/^notes$/i), {
      target: { value: "This change must be discarded" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(apiMocks.updateSofEvent).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("NOR tendered")).toBeInTheDocument();
  });

  it("keeps the edit open and shows the PATCH error without discarding a manual correction", async () => {
    const originalEvent = buildEvent();
    originalEvent.eventType = "DISCHARGE_COMPLETED";
    originalEvent.remarks = JSON.stringify({
      notes: "Discharge hoses disconnected",
    });
    apiMocks.getSofEvents.mockResolvedValue({ data: [originalEvent] });
    apiMocks.updateSofEvent.mockRejectedValue({
      message: "SOF event update was rejected",
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Discharge completed")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Discharge completed" }),
    );
    fireEvent.change(screen.getByLabelText(/event type/i), {
      target: { value: "HOSES_DISCONNECTED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiMocks.updateSofEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ eventType: "HOSES_DISCONNECTED" }),
      );
    });
    expect(
      await screen.findByText("SOF event update was rejected"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Edit SOF event" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /event type/i })).toHaveValue(
      "HOSES_DISCONNECTED",
    );
    expect(
      screen.getByDisplayValue("Discharge hoses disconnected"),
    ).toBeInTheDocument();
  });

  it('keeps engine-backed calculation totals labeled as "Deductions"', async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [buildCalculation()],
    });

    render(<SOFTimeline />);

    expect((await screen.findAllByText("Deductions")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Backend exception periods")).toBeInTheDocument();
  });
});

describe("SOFTimeline non-reversible single-operation summary", () => {
  it("shows Discharge-only summary values from the persisted non-reversible operation result", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [buildNonReversibleCalculation()],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Laytime allowed")).toBeInTheDocument();
    expect(screen.getAllByText("3d 00h 00m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3d 11h 15m").length).toBeGreaterThan(0);
    expect(screen.getByText("11h 15m over")).toBeInTheDocument();
    expect(
      screen.getAllByText("Discharge operation result").length,
    ).toBeGreaterThan(0);
  });

  it("shows Loading-only summary values from the persisted non-reversible operation result", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [
        buildNonReversibleCalculation({
          decisionSnapshot: {
            commencement: {
              commencedAt: "2026-09-10T06:00:00.000Z",
            },
            cargoCompletion: {
              selectedTime: "2026-09-12T04:00:00.000Z",
              eventTime: "2026-09-12T04:00:00.000Z",
              selectedEventId: "completion-loading-1",
              excludedEventIds: [],
            },
            nonReversibleSettlement: {
              version: 1,
              settlementMode: "separate_operation_results",
              expectedOperationScope: "Loading",
              expectedOperations: ["Loading"],
              settlementStatus: "PROVISIONAL",
              operations: {
                Loading: {
                  operation: "Loading",
                  allowedSeconds: 172800,
                  usedSeconds: 180000,
                },
              },
              monetaryAggregation: {
                status: "AVAILABLE",
                currency: "USD",
                netExposure: 2000,
                netDirection: "NET_PAYABLE",
                legalNetting: false,
                claimableAsAggregate: false,
              },
            },
          },
        }),
      ],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Laytime allowed")).toBeInTheDocument();
    expect(screen.getAllByText("2d 00h 00m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2d 02h 00m").length).toBeGreaterThan(0);
    expect(screen.getByText("02h 00m over")).toBeInTheDocument();
    expect(
      screen.getAllByText("Loading operation result").length,
    ).toBeGreaterThan(0);
  });

  it("does not fabricate aggregate time totals for LoadingAndDischarge scope", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [
        buildNonReversibleCalculation({
          decisionSnapshot: {
            commencement: {
              commencedAt: "2026-09-15T06:45:00.000Z",
            },
            cargoCompletion: {
              selectedTime: "2026-09-19T04:00:00.000Z",
              eventTime: "2026-09-19T04:00:00.000Z",
              selectedEventId: "completion-1",
              excludedEventIds: [],
            },
            nonReversibleSettlement: {
              version: 1,
              settlementMode: "separate_operation_results",
              expectedOperationScope: "LoadingAndDischarge",
              expectedOperations: ["Loading", "Discharge"],
              settlementStatus: "PROVISIONAL",
              operations: {
                Loading: {
                  operation: "Loading",
                  allowedSeconds: 172800,
                  usedSeconds: 180000,
                },
                Discharge: {
                  operation: "Discharge",
                  allowedSeconds: 259200,
                  usedSeconds: 299700,
                },
              },
              monetaryAggregation: {
                status: "AVAILABLE",
                currency: "USD",
                netExposure: 9375,
                netDirection: "NET_PAYABLE",
                legalNetting: false,
                claimableAsAggregate: false,
              },
            },
          },
        }),
      ],
    });
    apiMocks.getLaytimeOperationResults.mockResolvedValue([
      {
        id: "loading-child",
        parentCalculationId: "calc-1",
        operation: "Loading",
        voyageId: "voyage-1",
        version: 2,
        allowedLaytime: "2 days 00:00:00",
        usedLaytime: "2 days 02:00:00",
        demurrageAmount: "2000.00",
        despatchAmount: "0.00",
        currency: "USD",
        status: "Draft",
        calculatedAt: "2026-09-12T04:00:00.000Z",
        inputSnapshot: {
          operationResult: {
            source: "operation-specific-child-calculation",
            operation: "Loading",
          },
        },
      },
      {
        id: "discharge-child",
        parentCalculationId: "calc-1",
        operation: "Discharge",
        voyageId: "voyage-1",
        version: 2,
        allowedLaytime: "3 days 00:00:00",
        usedLaytime: "3 days 11:15:00",
        demurrageAmount: "9375.00",
        despatchAmount: "0.00",
        currency: "USD",
        status: "Draft",
        calculatedAt: "2026-09-19T04:00:00.000Z",
        inputSnapshot: {
          operationResult: {
            source: "operation-specific-child-calculation",
            operation: "Discharge",
          },
        },
      },
    ]);

    render(<SOFTimeline />);

    expect(
      (await screen.findAllByText("See operation results")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Loading").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Discharge").length).toBeGreaterThan(0);
    expect(screen.queryByText("5d 11h 15m")).not.toBeInTheDocument();
  });

  it("uses the persisted selected cargo-completion time when present", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [buildNonReversibleCalculation()],
    });

    render(<SOFTimeline />);

    const expectedCompletion = new Date(
      "2026-09-19T04:00:00.000Z",
    ).toLocaleString();
    expect(await screen.findByText("Cargo completion")).toBeInTheDocument();
    expect(screen.getByText(expectedCompletion)).toBeInTheDocument();
  });

  it("keeps showing Not available when persisted cargo-completion data is missing", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [
        buildNonReversibleCalculation({
          decisionSnapshot: {
            commencement: {
              commencedAt: "2026-09-15T06:45:00.000Z",
            },
            cargoCompletion: null,
            nonReversibleSettlement: {
              version: 1,
              settlementMode: "separate_operation_results",
              expectedOperationScope: "Discharge",
              expectedOperations: ["Discharge"],
              settlementStatus: "PROVISIONAL",
              operations: {
                Discharge: {
                  operation: "Discharge",
                  allowedSeconds: 259200,
                  usedSeconds: 299700,
                },
              },
              monetaryAggregation: {
                status: "AVAILABLE",
                currency: "USD",
                netExposure: 9375,
                netDirection: "NET_PAYABLE",
                legalNetting: false,
                claimableAsAggregate: false,
              },
            },
          },
        }),
      ],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Cargo completion")).toBeInTheDocument();
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
  });

  it("does not present unavailable reversible parent time as zero when settlement is non-authoritative", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [
        buildCalculation({
          allowedLaytime: null,
          usedLaytime: null,
          settlementAuthorityStatus: "NONAUTHORITATIVE",
          decisionSnapshot: {
            reversibleLaytimeRule: { enabled: true },
            reversibleSettlement: {
              settlementStatus: "NONAUTHORITATIVE",
              reasonCode: "REVERSIBLE_EXPLICIT_OPERATION_ALLOWANCES_REQUIRED",
            },
          },
        }),
      ],
    });
    apiMocks.getLaytimeOperationResults.mockResolvedValue([
      {
        id: "discharge-child",
        parentCalculationId: "calc-1",
        operation: "Discharge",
        voyageId: "voyage-1",
        version: 2,
        allowedLaytime: "3 days 00:00:00",
        usedLaytime: "3 days 23:00:00",
        demurrageAmount: "0.00",
        despatchAmount: "0.00",
        currency: "USD",
        status: "Draft",
        calculatedAt: "2026-10-06T14:30:00.000Z",
        warnings: [],
        inputSnapshot: {},
        decisionSnapshot: {},
      },
    ]);

    render(<SOFTimeline />);

    expect(
      await screen.findAllByText("Not authoritative — see operation results"),
    ).not.toHaveLength(0);
    expect(screen.getByText("3d 23h 00m")).toBeInTheDocument();
  });

  it("keeps reversible and legacy parent summary behavior unchanged", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [
        buildCalculation({
          allowedLaytime: "1 days 00:00:00",
          usedLaytime: "0 days 06:00:00",
          decisionSnapshot: {
            commencement: {
              commencedAt: "2026-09-15T06:45:00.000Z",
            },
            cargoCompletion: {
              selectedTime: "2026-09-15T12:45:00.000Z",
              eventTime: "2026-09-15T12:45:00.000Z",
              selectedEventId: "completion-legacy-1",
              excludedEventIds: [],
            },
          },
        }),
      ],
    });

    render(<SOFTimeline />);

    expect(await screen.findByText("Laytime allowed")).toBeInTheDocument();
    expect(screen.getAllByText("1d 00h 00m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("06h 00m").length).toBeGreaterThan(0);
    expect(screen.queryByText("See operation results")).not.toBeInTheDocument();
  });

  it("keeps the informational non-reversible net-position wording unchanged", async () => {
    apiMocks.getLaytimeCalculations.mockResolvedValue({
      data: [buildNonReversibleCalculation()],
    });

    render(<SOFTimeline />);

    expect(
      (await screen.findAllByText("USD 9,375.00 NET_PAYABLE")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Informational only - operation results remain separate",
      ),
    ).toBeInTheDocument();
  });
});
