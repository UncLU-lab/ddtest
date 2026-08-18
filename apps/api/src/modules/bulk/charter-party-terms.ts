import { EngineClause } from './laytime/laytime.types';

export const COMMERCIAL_CLAUSE_OPERATIONS = ['Loading', 'Discharge'] as const;
export type CommercialClauseOperation =
  (typeof COMMERCIAL_CLAUSE_OPERATIONS)[number];

export const SUPPORTED_COMMERCIAL_CLAUSE_TYPES = [
  'laytime_rate',
  'demurrage_rate',
  'despatch',
  'shex_shinc',
  'weather_working',
  'wibon',
  'wipon',
  'reversible_laytime',
  'atutc',
] as const;

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

function isCommercialClauseOperation(
  value: unknown,
): value is CommercialClauseOperation {
  return (
    typeof value === 'string' &&
    (COMMERCIAL_CLAUSE_OPERATIONS as readonly string[]).includes(value)
  );
}

function getClauseOperation(
  clause: EngineClause,
): CommercialClauseOperation | undefined {
  const operation = clause.parameters.operation;

  return isCommercialClauseOperation(operation) ? operation : undefined;
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

export function resolveClausesForOperation(
  clauses: EngineClause[],
  operation: CommercialClauseOperation,
  warnings: string[] = [],
): EngineClause[] {
  const clauseTypes: string[] = [];
  const seenTypes = new Set<string>();

  for (const clause of clauses) {
    if (seenTypes.has(clause.clauseType)) {
      continue;
    }

    seenTypes.add(clause.clauseType);
    clauseTypes.push(clause.clauseType);
  }

  return clauseTypes.flatMap((clauseType) => {
    const sameTypeClauses = clauses.filter(
      (clause) => clause.clauseType === clauseType,
    );
    const matchingOperationClauses = sameTypeClauses.filter(
      (clause) => getClauseOperation(clause) === operation,
    );
    const globalClauses = sameTypeClauses.filter(
      (clause) => getClauseOperation(clause) === undefined,
    );

    if (matchingOperationClauses.length > 1) {
      warnings.push(
        `Multiple "${clauseType}" clauses found for operation "${operation}"; the first one was used.`,
      );
    }

    if (matchingOperationClauses.length > 0) {
      return [matchingOperationClauses[0]];
    }

    if (globalClauses.length > 1) {
      warnings.push(
        `Multiple "${clauseType}" clauses found; the first one was used.`,
      );
    }

    return globalClauses.length > 0 ? [globalClauses[0]] : [];
  });
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
