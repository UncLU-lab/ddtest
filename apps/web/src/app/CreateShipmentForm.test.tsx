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
  it("applies only valid reviewed terms to the draft without creating a voyage", async () => {
    api.parseContractText.mockResolvedValue({
      warnings: [],
      fields: {
        vessel: { rawValue: "MV Staging Explorer", normalizedValue: "MV Staging Explorer", vesselId: "vessel-1", status: "FOUND", sourceSnippet: "VESSEL: MV Staging Explorer" },
        voyageRef: { rawValue: "STAGE-BASIC-001", normalizedValue: "STAGE-BASIC-001", status: "FOUND", sourceSnippet: "VOYAGE REFERENCE: STAGE-BASIC-001" },
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
    expect(screen.queryByDisplayValue("Port Hedland")).not.toBeInTheDocument();
    expect(api.parseContractText).toHaveBeenCalledTimes(1);
  });
});
