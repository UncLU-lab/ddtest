import { CalculationPeriodType } from '../entities/calculation-period.entity';

/** A charter-party clause reduced to what the engine needs. */
export interface EngineClause {
  id: string;
  clauseType: string;
  parameters: Record<string, unknown>;
}

/** A Notice of Readiness reduced to what the engine needs. */
export interface EngineNor {
  tenderTime: Date;
  acceptedTime?: Date | null;
}

/** A Statement of Facts event reduced to what the engine needs. */
export interface EngineSofEvent {
  eventTime: Date;
  eventType: string;
}

export interface LaytimeEngineInput {
  /** Metric tons, from `voyages.cargo_quantity`. */
  cargoQuantity: number;
  clauses: EngineClause[];
  norDocuments: EngineNor[];
  sofEvents: EngineSofEvent[];
}

export interface EnginePeriod {
  startTime: Date;
  endTime: Date;
  periodType: CalculationPeriodType;
  appliedClauseId: string | null;
}

export interface LaytimeEngineResult {
  /** When the laytime clock started counting. */
  commencedAt: Date;
  /** When cargo operations completed. */
  completedAt: Date;
  allowedSeconds: number;
  usedSeconds: number;
  demurrageAmount: number;
  despatchAmount: number;
  periods: EnginePeriod[];
  /** Non-fatal notes: unsupported clauses, missing rates, applied defaults. */
  warnings: string[];
}

/** Raised when the voyage lacks the inputs needed to compute laytime at all. */
export class LaytimeEngineError extends Error {}
