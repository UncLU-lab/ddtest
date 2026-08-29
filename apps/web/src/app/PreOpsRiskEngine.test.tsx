import { describe, expect, it } from "vitest";
import { emptyDraft, missingDraftFields } from "./data/ShipmentsContext";
import { buildCreateVoyageDto, toCreateVoyageCharterPartyFields } from "./PreOpsRiskEngine";

describe("PreOpsRiskEngine contract creation handoff", () => {
  function completeDraft() {
    return {
      ...emptyDraft,
      vessel: "MV Staging Explorer",
      voyageRef: "STAGE-REV-002",
      productType: "Products",
      quantity: "50000",
      eta: "2026-10-01",
      loadPort: "AUPHE",
      dischargePort: "CNQDG",
      supplier: "Vitol Asia",
      receiver: "PetroChina",
      laycanOpen: "2026-09-28",
      laycanClose: "2026-09-30",
      bulkOperationType: "tanker" as const,
      demurrageRate: "20000",
      timeCountingBasis: "SHINC",
      settlementCurrency: "USD",
      laytimeOperationScope: "LoadingAndDischarge" as const,
      reversibleLaytime: "Enabled" as const,
      loadingTerms: {
        ...emptyDraft.loadingTerms!,
        laytimeAllowed: "72",
      },
      dischargeTerms: {
        ...emptyDraft.dischargeTerms!,
        laytimeAllowed: "72",
      },
    };
  }

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

  it("treats reversible Loading and Discharge V1 operation allowances as valid without global laytime", () => {
    const draft = completeDraft();

    expect(draft.laytimeAllowed).toBe("");
    expect(missingDraftFields(draft)).not.toContain("Laytime allowed");
    expect(missingDraftFields(draft)).not.toContain("Loading laytime allowance");
    expect(missingDraftFields(draft)).not.toContain("Discharge laytime allowance");

    const dto = buildCreateVoyageDto(draft, "vessel-1");
    expect(dto.loadingTerms?.laytimeAllowed).toBe(72);
    expect(dto.dischargeTerms?.laytimeAllowed).toBe(72);
    expect(dto.laytimeAllowed).toBeUndefined();
  });

  it("requires the missing operation allowance by name for reversible Loading and Discharge V1", () => {
    expect(missingDraftFields({
      ...completeDraft(),
      loadingTerms: {
        ...emptyDraft.loadingTerms!,
        laytimeAllowed: "",
      },
    })).toContain("Loading laytime allowance");

    expect(missingDraftFields({
      ...completeDraft(),
      dischargeTerms: {
        ...emptyDraft.dischargeTerms!,
        laytimeAllowed: "",
      },
    })).toContain("Discharge laytime allowance");
  });

  it("still requires global laytime for ordinary and single-operation creation", () => {
    expect(missingDraftFields({
      ...completeDraft(),
      laytimeOperationScope: "",
      reversibleLaytime: "",
      loadingTerms: { ...emptyDraft.loadingTerms! },
      dischargeTerms: { ...emptyDraft.dischargeTerms! },
    })).toContain("Laytime allowed");

    expect(missingDraftFields({
      ...completeDraft(),
      laytimeOperationScope: "Loading",
      reversibleLaytime: "Enabled",
    })).toContain("Laytime allowed");
  });
});
