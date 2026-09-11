import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LaytimeCalculation, LaytimeCalculationAudit } from "../lib/api";
import { CalculationExplanation } from "./CalculationExplanation";

const commencementTime = "2026-09-15T00:00:00.000Z";
const completionTime = "2026-09-18T00:00:00.000Z";

function baseSnapshot() {
  return {
    commencement: {
      basis: "nor_accepted",
      norDocumentId: "nor-selected",
      norTenderedEventId: "nor-selected-event",
      tenderTime: "2026-09-14T18:00:00.000Z",
      acceptedTime: "2026-09-14T18:15:00.000Z",
      commencedAt: commencementTime,
      commencementRule: "notice-hours",
      noticeHours: 6,
      noticeSource: "charter-party",
      readinessEventId: "readiness-selected",
      readinessTime: "2026-09-14T17:45:00.000Z",
      readinessSource: "operation-specific",
      validityStatus: "valid",
      validityBasis: "accepted",
      validityWarnings: [],
      freePratique: {
        eventId: "free-pratique-selected",
        status: "granted-before-nor",
        grantedTime: "2026-09-14T16:00:00.000Z",
        source: "SOF",
        wifponEnabled: true,
        wifponApplied: false,
        warnings: [],
      },
      rejectedNorCandidates: [
        {
          source: "sof-event",
          norTenderedEventId: "nor-rejected-event",
          tenderTime: "2026-09-14T15:00:00.000Z",
          warnings: ["Candidate was not ready."],
        },
      ],
      freePratiqueRejectedCandidates: [],
      location: {
        overallStatus: "PASS",
        associationBasis: "explicit-sof-nor-tendered-event",
        berth: { status: "PASS", reason: "At berth" },
        port: { status: "PASS", reason: "Inside port" },
        selectedEvidence: { id: "location-selected", evidenceTime: "2026-09-14T15:30:00.000Z" },
      },
    },
    cargoCompletion: {
      selectedEventId: "completion-selected",
      selectedEventType: "CARGO_COMPLETED",
      selectedTime: completionTime,
      selectionBasis: "dry-bulk-hatches-closed",
      candidateEventIds: ["completion-selected", "completion-excluded"],
      excludedEventIds: ["completion-excluded"],
      warnings: [],
    },
    periods: [
      {
        startTime: commencementTime,
        endTime: "2026-09-16T00:00:00.000Z",
        periodType: "laytime",
        operation: "Discharge",
      },
      {
        startTime: "2026-09-16T00:00:00.000Z",
        endTime: "2026-09-16T02:00:00.000Z",
        periodType: "exception",
        exceptionKinds: ["weather"],
        operation: "Discharge",
      },
      {
        startTime: "2026-09-16T02:00:00.000Z",
        endTime: completionTime,
        periodType: "demurrage",
        operation: "Discharge",
      },
    ],
    weatherWorking: {
      enabled: true,
      applied: true,
      totalWeatherTimeDeductedBeforeDemurrage: 7200,
    },
    shexCalendar: {
      shex: true,
      timeZone: "Australia/Sydney",
      generatedIntervals: [],
      sourceType: "explicit-contractual-dates",
      legacyCompatibilityUsed: false,
    },
    atutc: {
      enabled: true,
      applied: true,
      restoredSeconds: 1800,
      restoredIntervals: [
        { startTime: "2026-09-16T03:00:00.000Z", endTime: "2026-09-16T03:30:00.000Z" },
      ],
    },
  };
}

function buildCalculation(overrides: Record<string, unknown> = {}) {
  return {
    id: "calculation-1",
    voyageId: "voyage-1",
    version: 1,
    allowedLaytime: "1 days 00:00:00",
    usedLaytime: "1 days 06:00:00",
    demurrageAmount: "1000.00",
    despatchAmount: "0.00",
    currency: "USD",
    status: "Final",
    calculatedAt: completionTime,
    inputSnapshot: {
      operationSelection: { voyageLaytimeOperation: "Discharge" },
    },
    warnings: [],
    decisionSnapshot: baseSnapshot(),
    ...overrides,
  } as unknown as LaytimeCalculation;
}

function buildAudit(overrides: Record<string, unknown> = {}) {
  return {
    auditAvailable: true,
    engineVersion: "test-engine",
    warnings: [],
    inputs: {},
    decisions: baseSnapshot(),
    calculation: {},
    ...overrides,
  } as unknown as LaytimeCalculationAudit;
}

function buildReferenceSnapshot(status?: string): Record<string, any> {
  const base = baseSnapshot();
  return {
    ...base,
    commencement: null,
    cargoCompletion: null,
    periods: [],
    referencePrimaryOperation: {
      commencement: base.commencement,
      cargoCompletion: base.cargoCompletion,
      periods: base.periods,
    },
    reversibleSettlement: status ? { settlementStatus: status } : {},
  };
}

function openExplanation() {
  fireEvent.click(screen.getByText("Calculation explanation"));
}

describe("CalculationExplanation", () => {
  it("renders commencement, NOR, and readiness explanations from persisted data", () => {
    render(<CalculationExplanation calculation={buildCalculation()} />);
    openExplanation();

    expect(screen.getByText("Commencement")).toBeInTheDocument();
    expect(screen.getByText("Accepted NOR")).toBeInTheDocument();
    expect(screen.getByText("Selected commencedAt")).toBeInTheDocument();
    expect(screen.getByText("NOR / readiness")).toBeInTheDocument();
    expect(screen.getByText("readiness-selected")).toBeInTheDocument();
  });

  it("explains rejected NOR candidates without inventing rejection reasons", () => {
    render(<CalculationExplanation calculation={buildCalculation()} />);
    openExplanation();

    expect(screen.getByText("Rejected NOR candidates")).toBeInTheDocument();
    expect(screen.getByText(/nor-rejected-event/)).toBeInTheDocument();
    expect(screen.getAllByText("Candidate was not ready.").length).toBeGreaterThan(0);
  });

  it("keeps free-pratique separate and explains WIFPON from persisted evidence", () => {
    render(<CalculationExplanation calculation={buildCalculation()} />);
    openExplanation();

    expect(screen.getByText("Free pratique")).toBeInTheDocument();
    expect(screen.getByText("Free pratique granted before NOR")).toBeInTheDocument();
    expect(screen.getByText(/WIFPON enabled/)).toBeInTheDocument();
  });

  it("explains selected and excluded cargo completion evidence", () => {
    render(<CalculationExplanation calculation={buildCalculation()} />);
    openExplanation();

    expect(screen.getByText("Cargo completion")).toBeInTheDocument();
    expect(screen.getByText("Dry-bulk hatches closed")).toBeInTheDocument();
    expect(screen.getByText("completion-excluded")).toBeInTheDocument();
  });

  it("explains a reversible result that is not authoritative", () => {
    const snapshot = buildReferenceSnapshot("NONAUTHORITATIVE");
    snapshot.reversibleSettlement.reason = "The reversible settlement contract is invalid.";
    render(
      <CalculationExplanation
        calculation={buildCalculation({
          decisionSnapshot: snapshot,
          settlementAuthorityStatus: "NONAUTHORITATIVE",
        })}
      />,
    );
    openExplanation();

    expect(screen.getAllByText("NON-AUTHORITATIVE").length).toBeGreaterThan(0);
    expect(screen.getByText(/The reversible settlement contract is invalid\./)).toBeInTheDocument();
    expect(screen.getByText(/pooled reversible settlement is non-authoritative for this calculation/i)).toBeInTheDocument();
    expect(screen.getByText("Commercial result")).toBeInTheDocument();
  });

  it("describes an authoritative pooled reversible settlement as the commercial authority", () => {
    render(
      <CalculationExplanation
        calculation={buildCalculation({
          decisionSnapshot: buildReferenceSnapshot("FINAL_AUTHORITATIVE"),
          settlementAuthorityStatus: "FINAL_AUTHORITATIVE",
        })}
      />,
    );
    openExplanation();

    expect(screen.getByText(/pooled reversible settlement is the commercial authority/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading and Discharge results are supporting evidence/i)).toBeInTheDocument();
  });

  it("uses neutral wording when pooled reversible authority is missing or legacy", () => {
    render(
      <CalculationExplanation
        calculation={buildCalculation({
          decisionSnapshot: buildReferenceSnapshot(),
        })}
      />,
    );
    openExplanation();

    expect(screen.getByText(/pooled reversible settlement authority is not available in this calculation version/i)).toBeInTheDocument();
  });

  it("keeps provisional authority visible and safely handles missing legacy audit data", () => {
    render(
      <CalculationExplanation
        calculation={buildCalculation({
          status: "Draft",
          settlementAuthorityStatus: "PROVISIONAL",
          decisionSnapshot: null,
        })}
      />,
    );

    expect(screen.getAllByText("PROVISIONAL").length).toBeGreaterThan(0);
    openExplanation();
    expect(screen.getByText("Detailed audit decisions are not available for this calculation version.")).toBeInTheDocument();
  });

  it("renders unknown legacy period classifications safely", () => {
    render(
      <CalculationExplanation
        calculation={buildCalculation({
          decisionSnapshot: {
            periods: [
              {
                startTime: "2026-09-15T00:00:00.000Z",
                endTime: "2026-09-15T01:00:00.000Z",
                periodType: "legacy_pause",
              },
            ],
          },
        })}
      />,
    );
    openExplanation();

    expect(screen.getAllByText("Legacy Pause").length).toBeGreaterThan(0);
  });

  it("labels selected NOR location status separately from candidate-evaluation warnings", () => {
    const snapshot = baseSnapshot();
    snapshot.commencement.validityWarnings = [
      "NOR location qualification is unavailable because no eligible candidate-associated location evidence exists.",
    ];
    render(<CalculationExplanation calculation={buildCalculation({ decisionSnapshot: snapshot })} />);
    openExplanation();

    expect(screen.getByText("Selected NOR candidate location qualification")).toBeInTheDocument();
    expect(screen.getByText(/The status above belongs to the selected NOR candidate/i)).toBeInTheDocument();
    expect(screen.getAllByText(/NOR location qualification is unavailable/i).length).toBeGreaterThan(0);
  });

  it("deduplicates repeated persisted warnings while retaining their grouped presentation", () => {
    render(
      <CalculationExplanation
        calculation={buildCalculation({ warnings: ["Repeated persisted warning"] })}
        audit={buildAudit({ warnings: ["Repeated persisted warning"] })}
      />,
    );
    openExplanation();

    expect(screen.getAllByText("Repeated persisted warning")).toHaveLength(1);
    expect(screen.getByText("Other persisted note")).toBeInTheDocument();
  });
});
