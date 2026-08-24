export const LAYTIME_SETTLEMENT_AUTHORITY_STATUSES = [
  'FINAL_AUTHORITATIVE',
  'PROVISIONAL',
  'NONAUTHORITATIVE',
  'LEGACY',
] as const;

export type LaytimeSettlementAuthorityStatus =
  (typeof LAYTIME_SETTLEMENT_AUTHORITY_STATUSES)[number];
