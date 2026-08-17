import { EngineClause } from './laytime/laytime.types';

export interface CommercialTermsSource {
  id: string;
  laytimeAllowed?: number | string | null;
  demurrageRate?: number | string | null;
  dispatchRate?: number | string | null;
  timeCountingBasis?: string | null;
  norNoticePeriod?: string | null;
}

export interface NormalizedCommercialClause extends EngineClause {
  rawText: string;
}

export function normalizeCommercialTermsToClauses(
  source: CommercialTermsSource,
): NormalizedCommercialClause[] {
  const clauses: NormalizedCommercialClause[] = [];
  const noticeHours = parseNoticeHours(source.norNoticePeriod);

  const laytimeAllowed = readFiniteNumber(source.laytimeAllowed);
  if (laytimeAllowed !== undefined) {
    const parameters: Record<string, unknown> = {
      hours: laytimeAllowed,
    };

    if (noticeHours !== undefined) {
      parameters.noticeHours = noticeHours;
    }

    clauses.push({
      id: `${source.id}:laytime_rate`,
      clauseType: 'laytime_rate',
      rawText: [
        `Laytime allowed: ${laytimeAllowed}h`,
        noticeHours !== undefined ? `NOR notice: ${source.norNoticePeriod}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      parameters,
    });
  }

  const demurrageRate = readFiniteNumber(source.demurrageRate);
  if (demurrageRate !== undefined) {
    clauses.push({
      id: `${source.id}:demurrage_rate`,
      clauseType: 'demurrage_rate',
      rawText: `Demurrage: $${demurrageRate.toLocaleString()}/day`,
      parameters: { rate: demurrageRate },
    });
  }

  const dispatchRate = readFiniteNumber(source.dispatchRate);
  if (dispatchRate !== undefined) {
    clauses.push({
      id: `${source.id}:despatch`,
      clauseType: 'despatch',
      rawText: `Dispatch: $${dispatchRate.toLocaleString()}/day`,
      parameters: { rate: dispatchRate },
    });
  }

  const basis = source.timeCountingBasis?.trim().toUpperCase();
  if (basis === 'SHEX' || basis === 'SHINC') {
    clauses.push({
      id: `${source.id}:shex_shinc`,
      clauseType: 'shex_shinc',
      rawText: `Time counting basis: ${basis}`,
      parameters: { shex: basis === 'SHEX' },
    });
  }

  return clauses;
}

export function parseNoticeHours(value?: string | null): number | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.toLowerCase() === 'immediate') {
    return 0;
  }

  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  return Number.isFinite(hours) ? hours : undefined;
}

function readFiniteNumber(value?: number | string | null): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
