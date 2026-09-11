import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LaytimeCalculation, LaytimeCalculationAudit } from "../lib/api";
import { WhatIfAnalysisPanel } from "./WhatIfAnalysisPanel";

function buildCalculation(overrides: Record<string, unknown> = {}) {
  return {
    id: "calculation-1",
    voyageId: "voyage-1",
    version: 7,
    allowedLaytime: "3 days 00:00:00",
    usedLaytime: "3 days 06:00:00",
    demurrageAmount: "1000.00",
    despatchAmount: "0.00",
    currency: "USD",
    status: "Draft",
    settlementAuthorityStatus: "PROVISIONAL",
    calculatedAt: "2026-09-18T00:00:00.000Z",
    inputSnapshot: {
      operationSelection: { voyageLaytimeOperation: "Discharge" },
    },
    decisionSnapshot: {
      commencement: { commencedAt: "2026-09-15T00:00:00.000Z" },
      cargoCompletion: { selectedTime: "2026-09-18T00:00:00.000Z" },
    },
    ...overrides,
  } as unknown as LaytimeCalculation;
}

function buildAudit() {
  return {
    auditAvailable: true,
    engineVersion: "test-engine",
    warnings: [],
    inputs: {},
    decisions: {},
    calculation: {
      excessLaytime: "06:00:00",
      savedLaytime: "00:00:00",
    },
  } as unknown as LaytimeCalculationAudit;
}

function openPanel() {
  fireEvent.click(screen.getByText("What-if analysis"));
}

describe("WhatIfAnalysisPanel", () => {
  it("shows the persisted baseline and a safe unsupported scenario state", () => {
    const calculation = buildCalculation();
    render(<WhatIfAnalysisPanel calculation={calculation} audit={buildAudit()} />);
    openPanel();

    expect(screen.getByLabelText("Current persisted baseline")).toBeInTheDocument();
    expect(screen.getByText("Version 7")).toBeInTheDocument();
    expect(screen.getByText("Discharge")).toBeInTheDocument();
    expect(screen.getByText("3 days 00:00:00")).toBeInTheDocument();
    expect(screen.getByText("3 days 06:00:00")).toBeInTheDocument();
    expect(screen.getByText("No scenario result was created")).toBeInTheDocument();
    expect(screen.getByText(/no calculation is performed in the client/i)).toBeInTheDocument();
    expect(screen.queryByText("Reset scenario")).not.toBeInTheDocument();
    expect(screen.queryByText("Apply scenario")).not.toBeInTheDocument();
  });

  it("does not call the persistent calculation endpoint or alter a reversible baseline", () => {
    const calculation = buildCalculation({
      settlementAuthorityStatus: null,
      decisionSnapshot: {
        reversibleSettlement: {
          settlementStatus: "NONAUTHORITATIVE",
          combinedAllowedSeconds: 86400,
          combinedUsedSeconds: 90000,
        },
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<WhatIfAnalysisPanel calculation={calculation} />);
    openPanel();

    expect(screen.getByText("NON-AUTHORITATIVE")).toBeInTheDocument();
    expect(screen.getByText(/calculation-creation endpoint/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(calculation.version).toBe(7);
    expect(calculation.demurrageAmount).toBe("1000.00");

    fetchSpy.mockRestore();
  });

  it("handles a legacy calculation with missing baseline fields without crashing", () => {
    render(
      <WhatIfAnalysisPanel
        calculation={buildCalculation({
          allowedLaytime: null,
          usedLaytime: null,
          demurrageAmount: null,
          despatchAmount: null,
          decisionSnapshot: null,
        })}
      />,
    );
    openPanel();

    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
    expect(screen.getByText("No scenario result was created")).toBeInTheDocument();
  });
});
