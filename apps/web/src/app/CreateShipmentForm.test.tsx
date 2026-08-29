import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import CreateShipmentForm from "./CreateShipmentForm";
import { ShipmentsProvider } from "./data/ShipmentsContext";

const api = vi.hoisted(() => ({
  getVessels: vi.fn().mockResolvedValue([{ id: "vessel-1", name: "MV Staging Explorer" }]),
  parseContractText: vi.fn(),
}));

vi.mock("../lib/api", () => api);

describe("CreateShipmentForm contract text autofill", () => {
  function controlFor(label: string) {
    return screen.getByText(label).parentElement?.querySelector("select") as HTMLSelectElement;
  }

  function allowanceInputFor(sectionTitle: string) {
    return screen.getByText(sectionTitle).parentElement?.parentElement?.querySelector("input") as HTMLInputElement;
  }

  it("applies only valid reviewed terms to the draft without creating a voyage", async () => {
    api.parseContractText.mockResolvedValue({
      warnings: [],
      fields: {
        vessel: { rawValue: "MV Staging Explorer", normalizedValue: "MV Staging Explorer", vesselId: "vessel-1", status: "FOUND", sourceSnippet: "VESSEL: MV Staging Explorer" },
        voyageRef: { rawValue: "STAGE-BASIC-001", normalizedValue: "STAGE-BASIC-001", status: "FOUND", sourceSnippet: "VOYAGE REFERENCE: STAGE-BASIC-001" },
        settlementCurrency: { rawValue: "USD", normalizedValue: "USD", status: "FOUND", sourceSnippet: "SETTLEMENT CURRENCY: USD" },
        laytimeOperationScope: { rawValue: "LOADING AND DISCHARGE", normalizedValue: "LoadingAndDischarge", status: "FOUND", sourceSnippet: "LAYTIME APPLIES TO: LOADING AND DISCHARGE" },
        reversibleLaytime: { rawValue: "ENABLED", normalizedValue: "Enabled", status: "FOUND", sourceSnippet: "REVERSIBLE LAYTIME: ENABLED" },
        loadingLaytimeAllowed: { rawValue: "72 HOURS", normalizedValue: 72, status: "FOUND", sourceSnippet: "LOADING LAYTIME ALLOWED: 72 HOURS" },
        dischargeLaytimeAllowed: { rawValue: "72 HOURS", normalizedValue: 72, status: "FOUND", sourceSnippet: "DISCHARGE LAYTIME ALLOWED: 72 HOURS" },
        loadPort: { rawValue: "Port Hedland", normalizedValue: null, status: "INVALID", sourceSnippet: "LOAD PORT: Port Hedland", warning: "Backend requires an accepted 5–10 character port code." },
      },
    });
    const user = userEvent.setup();

    render(<MemoryRouter><ShipmentsProvider><CreateShipmentForm /></ShipmentsProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /upload contract/i }));
    await user.type(screen.getByLabelText("Contract or recap text"), "VESSEL: MV Staging Explorer");
    await user.click(screen.getByRole("button", { name: "Extract terms" }));
    await screen.findByText("Review extracted terms");
    expect(screen.getByText("INVALID")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply extracted terms" }));
    await waitFor(() => expect(screen.getByDisplayValue("STAGE-BASIC-001")).toBeInTheDocument());
    expect(controlFor("Settlement currency")).toHaveValue("USD");
    expect(controlFor("Laytime applies to")).toHaveValue("LoadingAndDischarge");
    expect(controlFor("Reversible laytime")).toHaveValue("Enabled");
    expect(screen.getByText("Settlement version")).toBeInTheDocument();
    expect(screen.getByText("Allowance mode")).toBeInTheDocument();
    expect(allowanceInputFor("Loading-specific terms")).toHaveValue("72");
    expect(allowanceInputFor("Discharge-specific terms")).toHaveValue("72");
    expect(screen.queryByDisplayValue("Port Hedland")).not.toBeInTheDocument();
    expect(api.parseContractText).toHaveBeenCalledTimes(1);
  });

  it("renders the contract creation controls in Laytime terms and supports manual edits", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ShipmentsProvider><CreateShipmentForm /></ShipmentsProvider></MemoryRouter>);

    expect(screen.getByText("Settlement currency")).toBeInTheDocument();
    expect(screen.getByText("Laytime applies to")).toBeInTheDocument();
    expect(screen.getByText("Reversible laytime")).toBeInTheDocument();
    await user.selectOptions(controlFor("Settlement currency"), "EUR");
    await user.selectOptions(controlFor("Laytime applies to"), "Loading");
    await user.selectOptions(controlFor("Reversible laytime"), "Enabled");

    expect(controlFor("Settlement currency")).toHaveValue("EUR");
    expect(controlFor("Laytime applies to")).toHaveValue("Loading");
    expect(controlFor("Reversible laytime")).toHaveValue("Enabled");
    expect(screen.getByText("Sum operation allowances")).toBeInTheDocument();
  });

  it("makes distinct operation allowances visible when reversible V1 applies to Loading and Discharge", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ShipmentsProvider><CreateShipmentForm /></ShipmentsProvider></MemoryRouter>);

    await user.selectOptions(controlFor("Laytime applies to"), "LoadingAndDischarge");
    await user.selectOptions(controlFor("Reversible laytime"), "Enabled");
    const loading = allowanceInputFor("Loading-specific terms");
    const discharge = allowanceInputFor("Discharge-specific terms");
    await user.type(loading, "72");
    await user.type(discharge, "72");
    expect(loading).toHaveValue("72");
    expect(discharge).toHaveValue("72");
    expect(screen.getAllByText(/global allowance is not reused/i)).toHaveLength(2);
  });
});
