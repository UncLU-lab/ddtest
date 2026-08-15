import { CharterParty } from '../entities/charter-party.entity';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { VoyageCounterparty } from '../entities/voyage-counterparty.entity';
import { Voyage } from '../entities/voyage.entity';

export interface VoyageSummaryInput {
  voyage: Voyage;
  charterParty: CharterParty | null;
  counterpartyLinks: VoyageCounterparty[];
  sofDocuments: SofDocument[];
  norDocuments: NorDocument[];
  latestCalculation: LaytimeCalculation | null;
  disputes: DisputeCaseBulk[];
}

export interface VoyageParties {
  supplier: string | null;
  receiver: string | null;
}

export interface VoyageCommercialTerms {
  laytimeAllowed: number | null;
  demurrageRate: string | null;
  dispatchRate: string | null;
  timeCountingBasis: string | null;
  norNoticePeriod: string | null;
}

export interface VoyageRisk {
  /** True once every input the laytime engine needs is present. */
  readyToCalculate: boolean;
  /** Why the voyage is not ready, if it is not. */
  blockers: string[];
  /** Demurrage exposure from the latest calculation, less any settled disputes. */
  demurrageExposure: string;
  despatchCredit: string;
  openDisputeCount: number;
  amountUnderDispute: string;
  /** True when the voyage is still Planned but the cancelling date has passed. */
  laycanExpired: boolean;
  /** True when the latest calculation predates the newest SOF document. */
  calculationStale: boolean;
}

export interface VoyageSummary {
  voyage: Voyage;
  charterParty: CharterParty | null;
  parties: VoyageParties;
  commercialTerms: VoyageCommercialTerms;
  sofDocuments: SofDocument[];
  norDocuments: NorDocument[];
  latestCalculation: LaytimeCalculation | null;
  disputes: DisputeCaseBulk[];
  risk: VoyageRisk;
}

export function buildVoyageSummary(input: VoyageSummaryInput): VoyageSummary {
  return {
    ...input,
    parties: buildParties(input.counterpartyLinks),
    commercialTerms: buildCommercialTerms(input.charterParty),
    risk: buildRisk(input),
  };
}

function buildRisk({
  voyage,
  charterParty,
  sofDocuments,
  norDocuments,
  latestCalculation,
  disputes,
}: VoyageSummaryInput): VoyageRisk {
  const blockers: string[] = [];

  if (!charterParty) {
    blockers.push('No charter party attached.');
  } else if (!charterParty.clauses?.length) {
    blockers.push('The charter party has no extracted clauses.');
  }
  if (sofDocuments.length === 0) {
    blockers.push('No Statement of Facts uploaded.');
  }
  if (norDocuments.length === 0) {
    blockers.push('No Notice of Readiness attached.');
  }

  const openDisputes = disputes.filter(
    (dispute) => dispute.status !== 'Resolved',
  );

  const newestSofUpload = sofDocuments
    .map((document) => document.uploadDate.getTime())
    .reduce<number | null>((max, time) => Math.max(max ?? time, time), null);

  return {
    readyToCalculate: blockers.length === 0,
    blockers,
    demurrageExposure: latestCalculation?.demurrageAmount ?? '0.00',
    despatchCredit: latestCalculation?.despatchAmount ?? '0.00',
    openDisputeCount: openDisputes.length,
    amountUnderDispute: sumDecimals(
      openDisputes.map((dispute) => dispute.amountDisputed),
    ),
    laycanExpired:
      voyage.status === 'Planned' && new Date(voyage.laycanEnd) < new Date(),
    calculationStale:
      latestCalculation !== null &&
      newestSofUpload !== null &&
      latestCalculation.calculatedAt.getTime() < newestSofUpload,
  };
}

function buildParties(
  links: VoyageCounterparty[],
): VoyageParties {
  return {
    supplier:
      links.find((link) => link.role === 'Supplier')
        ?.counterparty?.name ?? null,
    receiver:
      links.find((link) => link.role === 'Receiver')
        ?.counterparty?.name ?? null,
  };
}

function buildCommercialTerms(
  charterParty: CharterParty | null,
): VoyageCommercialTerms {
  return {
    laytimeAllowed:
      charterParty?.laytimeAllowed ?? null,
    demurrageRate:
      charterParty?.demurrageRate ?? null,
    dispatchRate:
      charterParty?.dispatchRate ?? null,
    timeCountingBasis:
      charterParty?.timeCountingBasis ?? null,
    norNoticePeriod:
      charterParty?.norNoticePeriod ?? null,
  };
}

/** Sums DECIMAL columns, which TypeORM surfaces as strings, without losing cents. */
function sumDecimals(values: string[]): string {
  const totalCents = values.reduce(
    (total, value) => total + Math.round(Number(value) * 100),
    0,
  );

  return (totalCents / 100).toFixed(2);
}
