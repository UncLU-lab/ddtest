import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LaytimeCalculation } from "../lib/api";
import { PersistedLaytimeTimeline } from "./LaytimeTimeline";

function buildCalculation(
  overrides: Partial<LaytimeCalculation> = {},
): LaytimeCalculation {
  return {
    id: "calc-1",
    voyageId: "voyage-1",
    version: 1,
    allowedLaytime: "1 days 00:00:00",
    usedLaytime: "1 days 06:00:00",
    demurrageAmount: "1000.00",
    despatchAmount: "0.00",
    status: "Final",
    calculatedAt: "2026-09-18T00:00:00.000Z",
    inputSnapshot: {
      operationSelection: { voyageLaytimeOperation: "Discharge" },
    },
    decisionSnapshot: {
      commencement: { commencedAt: "2026-09-15T00:00:00.000Z" },
      cargoCompletion: { selectedTime: "2026-09-18T00:00:00.000Z" },
      demurrage: { startedAt: "2026-09-17T00:00:00.000Z" },
      periods: [
        {
          startTime: "2026-09-15T00:00:00.000Z",
          endTime: "2026-09-16T00:00:00.000Z",
          periodType: "laytime",
        },
        {
          startTime: "2026-09-16T00:00:00.000Z",
          endTime: "2026-09-16T12:00:00.000Z",
          periodType: "exception",
          exceptionKinds: ["weather"],
        },
        {
          startTime: "2026-09-16T12:00:00.000Z",
          endTime: "2026-09-17T00:00:00.000Z",
          periodType: "demurrage",
        },
      ],
    },
    ...overrides,
  };
}

describe("PersistedLaytimeTimeline", () => {
  it("renders counted, excluded, and demurrage periods with persisted markers", () => {
    render(<PersistedLaytimeTimeline calculation={buildCalculation()} />);

    const periods = screen.getByRole("list", {
      name: "Persisted laytime periods",
    });
    expect(
      within(periods).getByRole("listitem", { name: /Countable laytime/ }),
    ).toBeInTheDocument();
    expect(
      within(periods).getByRole("listitem", { name: /Weather exclusion/ }),
    ).toBeInTheDocument();
    expect(
      within(periods).getByRole("listitem", { name: /Demurrage time/ }),
    ).toBeInTheDocument();

    const markers = screen.getByRole("list", { name: "Timeline markers" });
    expect(within(markers).getByText("Commencement:")).toBeInTheDocument();
    expect(
      within(markers).getByText("Laytime allowance exhausted:"),
    ).toBeInTheDocument();
    expect(within(markers).getByText("Cargo completion:")).toBeInTheDocument();
  });

  it("renders persisted ATUTC restoration as a separate overlay", () => {
    const calculation = buildCalculation({
      decisionSnapshot: {
        ...buildCalculation().decisionSnapshot,
        atutc: {
          enabled: true,
          applied: true,
          restoredIntervals: [
            {
              startTime: "2026-09-16T02:00:00.000Z",
              endTime: "2026-09-16T04:00:00.000Z",
            },
          ],
        },
      },
    });

    render(<PersistedLaytimeTimeline calculation={calculation} />);

    expect(
      screen.getByText("ATUTC restored working time (persisted)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", {
        name: "Persisted ATUTC restoration intervals",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Restored working time")).toBeInTheDocument();
  });

  it("uses the persisted reversible settlement timeline and separates operations", () => {
    const calculation = buildCalculation({
      decisionSnapshot: {
        reversibleSettlement: {
          settlementStatus: "FINAL_AUTHORITATIVE",
          threshold: { operation: "Discharge", timestamp: "2026-09-17T00:00:00.000Z" },
          timeline: [
            {
              operation: "Loading",
              startTime: "2026-09-15T00:00:00.000Z",
              endTime: "2026-09-16T00:00:00.000Z",
              classification: "laytime",
            },
            {
              operation: "Discharge",
              startTime: "2026-09-16T00:00:00.000Z",
              endTime: "2026-09-17T00:00:00.000Z",
              classification: "demurrage",
            },
          ],
        },
      },
    });

    render(<PersistedLaytimeTimeline calculation={calculation} />);

    expect(screen.getByText(/Loading \+ Discharge/)).toBeInTheDocument();
    expect(screen.getByText("FINAL - AUTHORITATIVE")).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: /operation: Loading/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: /operation: Discharge/ }),
    ).toBeInTheDocument();
  });

  it("keeps an empty persisted-period state explicit", () => {
    const calculation = buildCalculation({
      decisionSnapshot: {
        commencement: { commencedAt: "2026-09-15T00:00:00.000Z" },
        periods: [],
      },
    });

    render(<PersistedLaytimeTimeline calculation={calculation} />);

    expect(
      screen.getByText(
        /No persisted period detail is available for a visual timeline/,
      ),
    ).toBeInTheDocument();
  });

  it("does not present a draft non-authoritative result as authoritative", () => {
    const calculation = buildCalculation({
      status: "Draft",
      settlementAuthorityStatus: "NONAUTHORITATIVE",
    });

    render(<PersistedLaytimeTimeline calculation={calculation} />);

    expect(screen.getByText("NON-AUTHORITATIVE")).toBeInTheDocument();
    expect(screen.queryByText("FINAL - AUTHORITATIVE")).not.toBeInTheDocument();
  });

  it("shows unknown legacy period classifications safely", () => {
    const calculation = buildCalculation({
      decisionSnapshot: {
        periods: [
          {
            startTime: "2026-09-15T00:00:00.000Z",
            endTime: "2026-09-15T01:00:00.000Z",
            periodType: "legacy_pause",
          },
        ],
      },
    });

    render(<PersistedLaytimeTimeline calculation={calculation} />);

    expect(
      screen.getByRole("listitem", { name: /Legacy Pause/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Legacy Pause")).toBeInTheDocument();
  });
});
