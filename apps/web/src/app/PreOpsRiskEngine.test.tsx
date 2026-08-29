import { describe, expect, it } from "vitest";
import { emptyDraft } from "./data/ShipmentsContext";
import { toCreateVoyageCharterPartyFields } from "./PreOpsRiskEngine";

describe("PreOpsRiskEngine contract creation handoff", () => {
  it("preserves reviewed Charter Party creation fields in the CreateVoyage DTO", () => {
    expect(toCreateVoyageCharterPartyFields({
      ...emptyDraft,
      settlementCurrency: "USD",
      laytimeOperationScope: "LoadingAndDischarge",
      reversibleLaytime: "Enabled",
    })).toEqual({
      settlementCurrency: "USD",
      laytimeOperationScope: "LoadingAndDischarge",
      reversibleLaytime: { enabled: true, settlementVersion: 1, allowanceMode: "sum_operation_allowances" },
    });
  });

  it("does not infer a reversible rule from scope", () => {
    expect(toCreateVoyageCharterPartyFields({
      ...emptyDraft,
      laytimeOperationScope: "LoadingAndDischarge",
    }).reversibleLaytime).toBeUndefined();
  });
});
