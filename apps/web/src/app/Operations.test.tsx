import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Operations, { formatCreatedAt, sortShipmentsByCreatedAt } from "./Operations";
import type { Shipment } from "./data/shipments";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  shipments: [] as Shipment[],
}));

vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("./data/ShipmentsContext", () => ({
  useShipments: () => ({ shipments: mocks.shipments }),
}));

const basicVoyage: Shipment = {
  id: "voyage-basic-uuid",
  vessel: "MV Staging Explorer",
  voyageRef: "STAGE-BASIC-001",
  port: "AUPHE",
  supplier: "Vitol Asia",
  receiver: "PetroChina",
  eta: "2026-10-01T00:00:00.000Z",
  risk: "optimal",
  exposure: 0,
  cargo: "Products",
  quantity: "50,000 MT",
  createdAt: "2026-08-29T03:02:00.000Z",
};

const reversibleVoyage: Shipment = {
  ...basicVoyage,
  id: "voyage-reversible-uuid",
  voyageRef: "STAGE-REV-001",
  port: "CNQDG",
  risk: "elevated",
  exposure: 20_000,
  createdAt: "2026-08-29T04:02:00.000Z",
};

describe("Operations voyage identification", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.shipments = [basicVoyage, reversibleVoyage];
  });

  it("shows distinct references and localized created labels, newest first, without exposing the UUID", () => {
    render(<Operations />);

    const references = screen.getAllByText(/STAGE-(?:BASIC|REV)-001/);
    expect(references.map((reference) => reference.textContent)).toEqual(["STAGE-REV-001", "STAGE-BASIC-001"]);
    expect(screen.getAllByText("MV Staging Explorer")).toHaveLength(2);
    expect(screen.getAllByText(/^Created /)).toHaveLength(2);
    expect(screen.queryByText("2026-08-29T04:02:00.000Z")).not.toBeInTheDocument();
    expect(screen.queryByText("voyage-reversible-uuid")).not.toBeInTheDocument();

    expect(screen.getByText("CNQDG")).toBeInTheDocument();
    expect(screen.getAllByText("Vitol Asia")).toHaveLength(2);
    expect(screen.getAllByText("PetroChina")).toHaveLength(2);
    expect(screen.getByText("Elevated")).toBeInTheDocument();
    expect(screen.getAllByText("$20,000")).toHaveLength(2);
  });

  it("continues to route with the voyage UUID", () => {
    render(<Operations />);

    fireEvent.click(screen.getByText("STAGE-REV-001"));

    expect(mocks.navigate).toHaveBeenCalledWith("/shipments/voyage-reversible-uuid");
  });

  it("sorts creation timestamps deterministically and formats valid timestamps for display", () => {
    expect(sortShipmentsByCreatedAt([basicVoyage, reversibleVoyage]).map((shipment) => shipment.id)).toEqual([
      "voyage-reversible-uuid",
      "voyage-basic-uuid",
    ]);
    expect(formatCreatedAt(reversibleVoyage.createdAt)).toMatch(/^Created /);
    expect(formatCreatedAt("not-a-timestamp")).toBeNull();
  });
});
