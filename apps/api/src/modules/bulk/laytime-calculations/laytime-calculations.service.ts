import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { NorTenderLocationEvidence } from '../entities/nor-tender-location-evidence.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import {
  normalizeCommercialTermsToClauses,
  resolveClausesForOperation,
} from '../charter-party-terms';
import {
  LAYTIME_ENGINE_VERSION,
  runLaytimeEngine,
} from '../laytime/laytime.engine';
import {
  EngineClause,
  LaytimeEngineError,
  type LaytimeEngineResult,
} from '../laytime/laytime.types';
import type { NorLocationQualificationResult } from '../laytime/nor-location-qualification';
import { secondsToInterval } from '../laytime/interval.util';
import {
  type BulkOperationType,
  type LaytimeOperation,
} from '../entities/voyage.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import {
  analyzeReversibleLaytime,
  resolveReversibleLaytimeRule,
  type ReversibleLaytimeAnalysis,
  type ReversibleLaytimeRuleEvidence,
} from './reversible-laytime-analysis';
import { randomUUID } from 'node:crypto';
import {
  resolveReversibleLaytimeSettlement,
  type ReversibleAllowanceInput,
  type ReversibleSettlementResult,
  type ReversibleSettlementRuleInput,
} from './reversible-laytime-settlement';
import {
  resolveNonReversibleSettlement,
  type NonReversibleSettlementResult,
} from './non-reversible-laytime-settlement';
import type { SettlementCurrency } from '../currency/settlement-currency';

/** A calculation plus the engine notes that produced it. */
export interface CalculationResult {
  calculation: LaytimeCalculation;
  warnings: string[];
}

type ResolvedClause = EngineClause & {
  rawText?: string;
};

type SofEventOperationClassification =
  | 'global'
  | 'legacy-null'
  | 'matching-operation'
  | 'mismatched-operation';

type CalculationEventSelection = {
  rule: 'exclude-explicit-mismatched-operation-completion-events';
  includedEventIds: string[];
  excludedEventIds: string[];
};

type SofDocumentSelection = {
  voyageLaytimeOperation: LaytimeOperation;
  candidateDocumentIds: string[];
  includedDocumentIds: string[];
  excludedDocumentIds: string[];
  matchingDocumentIds: string[];
  legacyNullDocumentIds: string[];
  oppositeOperationDocumentIds: string[];
  rule: 'matching-operation-plus-legacy-null';
};

const DRAFT_SOF_AUTHORITY_WARNING =
  'No finalised Statement of Facts was available; the calculation used draft SOF events.';

type OperationSelectionAudit = {
  voyageLaytimeOperation: LaytimeOperation;
  hasLoadingCompletion: boolean;
  hasDischargeCompletion: boolean;
  mixedOperationEvidence: boolean;
  includedCompletionEventIds: string[];
  excludedCompletionEventIds: string[];
};

type OperationSpecificSelectionAudit = {
  operation: LaytimeOperation;
  source: 'operation-specific-child-calculation';
  clauseSelection: {
    selectedClauseIds: string[];
    selectedClauseTypes: string[];
    selectedClauses: Array<{
      id: string;
      clauseType: string;
      source: 'operation-specific' | 'global-fallback';
    }>;
    duplicateWarnings: string[];
  };
  documentSelection: {
    candidateDocumentIds: string[];
    includedDocumentIds: string[];
    excludedDocumentIds: string[];
    matchingDocumentIds: string[];
    legacyNullDocumentIds: string[];
    oppositeOperationDocumentIds: string[];
    usedLegacyFallback: boolean;
  };
  eventSelection: {
    candidateEventIds: string[];
    includedEventIds: string[];
    excludedEventIds: string[];
    matchingEventIds: string[];
    legacyNullEventIds: string[];
    oppositeOperationEventIds: string[];
    usedLegacyFallback: boolean;
    matchingCompletionEventId: string | null;
    selectedCompletionEventId: string | null;
  };
};

type OperationChildAudit = {
  requestedOperations: LaytimeOperation[];
  createdOperations: LaytimeOperation[];
  skippedOperations: Array<{
    operation: LaytimeOperation;
    reason: string;
  }>;
};

type PreparedOperationChildCalculation = {
  childCalculationId: string;
  operation: LaytimeOperation;
  childClauses: ResolvedClause[];
  childClauseWarnings: string[];
  childDocumentSelection: OperationSpecificSelectionAudit['documentSelection'];
  childEventSelection: OperationSpecificSelectionAudit['eventSelection'];
  childSofEvents: SofEvent[];
  childResult: ReturnType<typeof runLaytimeEngine>;
  childWarnings: string[];
};

type CreateOperationChildResultInput = {
  id?: string;
  parentCalculation: Pick<
    LaytimeCalculation,
    'id' | 'voyageId' | 'version' | 'status'
  >;
  operation: Exclude<LaytimeOperation, null>;
  allowedLaytime: string;
  usedLaytime: string;
  demurrageAmount: string;
  despatchAmount: string;
  inputSnapshot: Record<string, unknown>;
  decisionSnapshot: Record<string, unknown>;
  warnings: string[];
  engineVersion: string | null;
  settlementAuthorityStatus?: LaytimeCalculation['settlementAuthorityStatus'];
  currency: SettlementCurrency | null;
  periods: Array<{
    startTime: Date;
    endTime: Date;
    periodType: string;
    appliedClauseId: string | null;
  }>;
  calculatedAt?: Date;
};

const GLOBAL_SOF_EVENT_TYPES = new Set([
  'NOR_TENDERED',
  'VESSEL_READY_IN_ALL_RESPECTS',
  'FREE_PRATIQUE_GRANTED',
  'RAIN_STOPPAGE',
  'RAIN_COMMENCED',
  'WEATHER_STOPPAGE',
  'RAIN_STOPPED',
  'WEATHER_CLEARED',
  'BREAKDOWN',
  'STOPPAGE_START',
  'WORK_STOPPED',
  'BREAKDOWN_REPAIRED',
  'STOPPAGE_END',
  'WORK_RESUMED',
  'CARGO_STARTED',
  'CARGO_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
]);

const COMPLETION_EVENT_TYPES = new Set([
  'CARGO_COMPLETED',
  'LOADING_COMPLETED',
  'DISCHARGE_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
]);

/** Read-only explanation assembled solely from a calculation's stored evidence. */
export interface CalculationAuditResponse {
  calculation: {
    id: string;
    voyageId: string;
    version: number;
    status: LaytimeCalculation['status'];
    calculatedAt: Date;
    allowedLaytime: string | null;
    usedLaytime: string | null;
    excessLaytime: string | null;
    savedLaytime: string | null;
    demurrageAmount: string | null;
    despatchAmount: string | null;
    settlementAuthorityStatus: LaytimeCalculation['settlementAuthorityStatus'];
    currency: SettlementCurrency | null;
  };
  auditAvailable: boolean;
  engineVersion: string | null;
  warnings: string[];
  inputs: Record<string, unknown> | null;
  decisions: Record<string, unknown> | null;
}

@Injectable()
export class LaytimeCalculationsService {
  constructor(
    @InjectRepository(LaytimeCalculation)
    private readonly calculations: Repository<LaytimeCalculation>,
    @InjectRepository(CalculationPeriod)
    private readonly periods: Repository<CalculationPeriod>,
    @InjectRepository(CharterParty)
    private readonly charterParties: Repository<CharterParty>,
    @InjectRepository(NorDocument)
    private readonly norDocuments: Repository<NorDocument>,
    @InjectRepository(SofDocument)
    private readonly sofDocuments: Repository<SofDocument>,
    @InjectRepository(SofEvent)
    private readonly sofEvents: Repository<SofEvent>,
    @InjectRepository(NorTenderLocationEvidence)
    private readonly norTenderLocationEvidence: Repository<NorTenderLocationEvidence>,
    private readonly voyagesService: VoyagesService,
    private readonly databaseContext: TenantDatabaseContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findForVoyage(
    voyageId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<LaytimeCalculation>> {
    await this.voyagesService.ensureExists(voyageId);

    const result = await this.calculations.findAndCount({
      where: { voyageId, parentCalculationId: IsNull() },
      order: { version: 'DESC', calculatedAt: 'DESC', id: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async findOne(id: string): Promise<LaytimeCalculation> {
    const calculation = await this.calculations.findOne({
      where: { id },
    });

    if (!calculation) {
      throw new NotFoundException(`Laytime calculation ${id} not found`);
    }

    await this.voyagesService.ensureExists(calculation.voyageId);

    return calculation;
  }

  async findPeriods(
    calculationId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<CalculationPeriod>> {
    await this.findOne(calculationId);

    const result = await this.periods.findAndCount({
      where: { calculationId },
      relations: { appliedClause: true },
      order: { startTime: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async findOperationChildren(
    parentCalculationId: string,
  ): Promise<LaytimeCalculation[]> {
    const parentCalculation = await this.findOne(parentCalculationId);

    if (
      parentCalculation.parentCalculationId !== null &&
      parentCalculation.parentCalculationId !== undefined
    ) {
      throw new BadRequestException(
        `Laytime calculation ${parentCalculationId} is a child result and cannot be used as a parent`,
      );
    }

    const children = await this.calculations.find({
      where: { parentCalculationId },
    });

    return children.sort((left, right) => {
      const rank = (operation: LaytimeCalculation['operation']) =>
        operation === 'Loading' ? 0 : operation === 'Discharge' ? 1 : 2;
      const operationDifference = rank(left.operation) - rank(right.operation);
      if (operationDifference !== 0) {
        return operationDifference;
      }

      const calculatedAtDifference =
        left.calculatedAt.getTime() - right.calculatedAt.getTime();
      if (calculatedAtDifference !== 0) {
        return calculatedAtDifference;
      }

      return left.id.localeCompare(right.id);
    });
  }

  /**
   * Returns persisted calculation evidence only. It deliberately does not load
   * current voyage, charter-party, NOR, SOF, or clause rows.
   */
  async getAudit(id: string): Promise<CalculationAuditResponse> {
    const calculation = await this.findOne(id);
    const decisionSnapshot = calculation.decisionSnapshot as
      | Record<string, unknown>
      | null
      | undefined;
    const reversibleSettlement =
      decisionSnapshot &&
      typeof decisionSnapshot === 'object' &&
      !Array.isArray(decisionSnapshot)
        ? (decisionSnapshot.reversibleSettlement as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const useReversibleSettlementTotals =
      reversibleSettlement?.settlementStatus !== 'LEGACY' &&
      typeof reversibleSettlement?.combinedAllowedSeconds === 'number';
    const nonReversibleSettlement =
      decisionSnapshot?.nonReversibleSettlement as
        | Record<string, unknown>
        | undefined;
    const useNonReversibleSummary = nonReversibleSettlement?.version === 1;
    const allowedSeconds = useNonReversibleSummary
      ? undefined
      : useReversibleSettlementTotals
        ? this.readSnapshotNumber(
            reversibleSettlement,
            'combinedAllowedSeconds',
          )
        : this.readSnapshotNumber(
            calculation.decisionSnapshot,
            'allowedLaytime',
            'allowedSeconds',
          );
    const usedSeconds = useNonReversibleSummary
      ? undefined
      : useReversibleSettlementTotals
        ? this.readSnapshotNumber(reversibleSettlement, 'combinedUsedSeconds')
        : this.readSnapshotNumber(
            calculation.decisionSnapshot,
            'netUsedSeconds',
          );

    return {
      calculation: {
        id: calculation.id,
        voyageId: calculation.voyageId,
        version: calculation.version,
        status: calculation.status,
        settlementAuthorityStatus:
          calculation.settlementAuthorityStatus ?? null,
        currency: calculation.currency ?? null,
        calculatedAt: calculation.calculatedAt,
        allowedLaytime: calculation.allowedLaytime,
        usedLaytime: calculation.usedLaytime,
        excessLaytime:
          allowedSeconds !== undefined && usedSeconds !== undefined
            ? secondsToInterval(Math.max(0, usedSeconds - allowedSeconds))
            : null,
        savedLaytime:
          allowedSeconds !== undefined && usedSeconds !== undefined
            ? secondsToInterval(Math.max(0, allowedSeconds - usedSeconds))
            : null,
        demurrageAmount: calculation.demurrageAmount,
        despatchAmount: calculation.despatchAmount,
      },
      auditAvailable:
        calculation.inputSnapshot !== null &&
        calculation.inputSnapshot !== undefined &&
        calculation.decisionSnapshot !== null &&
        calculation.decisionSnapshot !== undefined,
      engineVersion: calculation.engineVersion ?? null,
      warnings: calculation.warnings ?? [],
      inputs: calculation.inputSnapshot ?? null,
      decisions: calculation.decisionSnapshot ?? null,
    };
  }

  /**
   * Runs the laytime engine over the voyage's NOR, SOF events and charter-party
   * clauses, then persists the result as the next version.
   */
  async calculate(voyageId: string): Promise<CalculationResult> {
    const voyage = await this.voyagesService.ensureExists(voyageId);
    const warnings: string[] = [];

    const charterParty = await this.charterParties.findOne({
      where: { voyageId },
      relations: { clauses: true },
    });

    if (!charterParty) {
      throw new UnprocessableEntityException(
        `Voyage ${voyageId} has no charter party; attach one before calculating laytime`,
      );
    }
    const settlementCurrency = charterParty.settlementCurrency ?? null;

    const [norDocuments, sofSource, locationEvidence] = await Promise.all([
      this.norDocuments.find({ where: { voyageId } }),
      this.loadSofEvents(voyageId, warnings),
      this.norTenderLocationEvidence.find({
        where: { voyageId },
        order: { evidenceTime: 'ASC', createdAt: 'ASC', id: 'ASC' },
      }),
    ]);
    const documentSelection = this.selectSofDocumentsForEngine(
      voyage.laytimeOperation,
      sofSource.documents,
      warnings,
    );
    const loadedSofEvents = sofSource.events.filter((event) =>
      documentSelection.includedDocumentIds.includes(event.sofId),
    );
    const clauses = this.resolveClauses(charterParty);
    const reversibleLaytimeRule = resolveReversibleLaytimeRule(clauses);
    if (reversibleLaytimeRule.warnings.length > 0) {
      warnings.push(...reversibleLaytimeRule.warnings);
    }
    const engineClauses = this.filterEngineClauses(clauses);
    const eventSelection = this.selectSofEventsForEngine(
      voyage.laytimeOperation,
      loadedSofEvents,
    );
    const sofEvents = eventSelection.events;
    const operationSelection = this.buildOperationSelectionAudit(
      voyage.laytimeOperation,
      loadedSofEvents,
      eventSelection.selection,
    );

    if (operationSelection.mixedOperationEvidence) {
      warnings.push(
        'SOF contains both Loading and Discharge operation-specific completion events. Calculation used the voyage laytimeOperation to select the applicable completion evidence.',
      );
    }

    let result;
    try {
      result = runLaytimeEngine({
        voyageId: voyage.id,
        cargoQuantity: Number(voyage.cargoQuantity),
        clauses: engineClauses,
        norDocuments,
        sofEvents,
        norTenderLocationEvidence: locationEvidence,
        operation: voyage.laytimeOperation,
        bulkOperationType: voyage.bulkOperationType ?? null,
      });
    } catch (error) {
      if (error instanceof LaytimeEngineError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    const calculationWarnings = [...warnings, ...result.warnings];
    const childPlans = await this.buildOperationChildCalculations(
      voyage,
      charterParty,
      engineClauses,
      norDocuments,
      sofSource.documents,
      sofSource.events,
      locationEvidence,
      reversibleLaytimeRule.contractStatus === 'v1',
    );
    const operationChildren: OperationChildAudit = {
      requestedOperations: this.sortOperations(childPlans.requestedOperations),
      createdOperations: this.sortOperations(
        childPlans.created.map((plan) => plan.operation),
      ),
      skippedOperations: childPlans.skippedOperations,
    };
    const loadingChild = childPlans.created.find(
      (plan) => plan.operation === 'Loading',
    );
    const dischargeChild = childPlans.created.find(
      (plan) => plan.operation === 'Discharge',
    );
    const reversibleLaytimeAnalysis = analyzeReversibleLaytime(
      loadingChild
        ? {
            operation: 'Loading',
            allowedSeconds: loadingChild.childResult.allowedSeconds,
            usedSeconds: loadingChild.childResult.usedSeconds,
          }
        : null,
      dischargeChild
        ? {
            operation: 'Discharge',
            allowedSeconds: dischargeChild.childResult.allowedSeconds,
            usedSeconds: dischargeChild.childResult.usedSeconds,
          }
        : null,
      reversibleLaytimeRule.enabled === true,
    );
    const reversibleSettlement = this.applyReversibleEvidenceAuthority(
      this.applyReversibleCurrencyAuthority(
        this.resolveReversibleSettlement(
          reversibleLaytimeRule,
          clauses,
          Number(voyage.cargoQuantity),
          loadingChild,
          dischargeChild,
        ),
        settlementCurrency,
      ),
      sofSource.hasFinalisedDocument,
    );
    const nonReversibleSettlement =
      reversibleLaytimeRule.enabled === true ||
      !charterParty.laytimeOperationScope
        ? null
        : resolveNonReversibleSettlement({
            expectedOperationScope: charterParty.laytimeOperationScope ?? null,
            settlementCurrency,
            children: childPlans.created.map((plan) => ({
              operation: plan.operation,
              childCalculationId: plan.childCalculationId,
              allowedSeconds: plan.childResult.allowedSeconds,
              usedSeconds: plan.childResult.usedSeconds,
              demurrageAmount: plan.childResult.demurrageAmount,
              despatchAmount: plan.childResult.despatchAmount,
              despatchBasis:
                plan.childResult.despatchTimeBasis.requestedTimeBasis,
              clauseIds: plan.childClauses.map((clause) => clause.id),
              currency: settlementCurrency,
            })),
          });
    const inputSnapshot = this.buildInputSnapshot(
      voyage,
      charterParty,
      clauses,
      norDocuments,
      locationEvidence,
      sofSource.documents,
      loadedSofEvents,
      documentSelection,
      eventSelection.selection,
      operationSelection,
      operationChildren,
    );
    const decisionSnapshot = this.buildDecisionSnapshot(
      charterParty,
      engineClauses,
      norDocuments,
      sofEvents,
      result,
      reversibleLaytimeRule,
      reversibleLaytimeAnalysis,
      reversibleSettlement,
    );
    if (nonReversibleSettlement) {
      decisionSnapshot.nonReversibleSettlement = nonReversibleSettlement;
    } else if (
      reversibleLaytimeRule.enabled !== true &&
      !charterParty.laytimeOperationScope
    ) {
      decisionSnapshot.nonReversibleSettlement = {
        version: null,
        settlementMode: 'legacy_primary_operation',
        expectedOperationScope: null,
        expectedOperations: [],
        settlementStatus: 'LEGACY',
        reasonCode: 'NON_REVERSIBLE_EXPECTED_OPERATION_SCOPE_REQUIRED',
        finalizationEligible: false,
        finalizationBlockers: [
          'Expected laytime operation scope is not configured.',
        ],
        monetaryAggregation: {
          status: 'CURRENCY_AUTHORITY_REQUIRED',
          authoritativeCurrency: null,
          grossDemurrage: null,
          grossDespatch: null,
          netExposure: null,
        },
      };
    }
    const parentResult = nonReversibleSettlement
      ? {
          allowedLaytime: null,
          usedLaytime: null,
          demurrageAmount: null,
          despatchAmount: null,
        }
      : reversibleSettlement?.settlementStatus === 'FINAL_AUTHORITATIVE' ||
          reversibleSettlement?.settlementStatus === 'PROVISIONAL' ||
          reversibleSettlement?.settlementStatus === 'NONAUTHORITATIVE'
        ? {
            allowedLaytime: secondsToInterval(
              reversibleSettlement.combinedAllowedSeconds ?? 0,
            ),
            usedLaytime: secondsToInterval(
              reversibleSettlement.combinedAllowedSeconds === null
                ? 0
                : reversibleSettlement.combinedUsedSeconds,
            ),
            demurrageAmount:
              reversibleSettlement.settlementStatus === 'FINAL_AUTHORITATIVE'
                ? reversibleSettlement.demurrageAmount.toFixed(2)
                : '0.00',
            despatchAmount:
              reversibleSettlement.settlementStatus === 'FINAL_AUTHORITATIVE'
                ? reversibleSettlement.despatchAmount.toFixed(2)
                : '0.00',
          }
        : {
            allowedLaytime: secondsToInterval(result.allowedSeconds),
            usedLaytime: secondsToInterval(result.usedSeconds),
            demurrageAmount: result.demurrageAmount.toFixed(2),
            despatchAmount: result.despatchAmount.toFixed(2),
          };
    if (reversibleSettlement?.warnings.length) {
      calculationWarnings.push(...reversibleSettlement.warnings);
    }
    if (nonReversibleSettlement?.warnings.length) {
      calculationWarnings.push(...nonReversibleSettlement.warnings);
    }
    const preparedChildCalculations = childPlans.created.map((plan) => {
      const childCalculationWarnings = [
        ...plan.childWarnings,
        ...plan.childResult.warnings,
      ];
      const childInputSnapshot = this.buildChildInputSnapshot(
        voyage,
        inputSnapshot,
        plan.operation,
        plan.childClauses,
        plan.childClauseWarnings,
        plan.childDocumentSelection,
        plan.childEventSelection,
      );
      const childDecisionSnapshot = {
        ...this.buildDecisionSnapshot(
          charterParty,
          plan.childClauses,
          norDocuments,
          plan.childSofEvents,
          plan.childResult,
          reversibleLaytimeRule,
        ),
        operationResult: {
          operation: plan.operation,
          source: 'operation-specific-child-calculation',
          clauseSelection: this.buildClauseSelectionAudit(
            plan.childClauses,
            plan.childClauseWarnings,
          ),
          warnings: [...plan.childWarnings],
        },
      };

      return {
        id: plan.childCalculationId,
        operation: plan.operation,
        allowedLaytime: secondsToInterval(plan.childResult.allowedSeconds),
        usedLaytime: secondsToInterval(plan.childResult.usedSeconds),
        demurrageAmount: plan.childResult.demurrageAmount.toFixed(2),
        despatchAmount: plan.childResult.despatchAmount.toFixed(2),
        inputSnapshot: childInputSnapshot,
        decisionSnapshot: childDecisionSnapshot,
        warnings: childCalculationWarnings,
        engineVersion: LAYTIME_ENGINE_VERSION,
        currency: settlementCurrency,
        settlementAuthorityStatus:
          nonReversibleSettlement?.expectedOperations.includes(plan.operation)
            ? ('PROVISIONAL' as const)
            : reversibleSettlement?.version === 1
              ? reversibleSettlement.settlementStatus
              : null,
        periods: plan.childResult.periods,
        calculatedAt: new Date(),
      };
    });

    const calculation = await this.databaseContext.transaction(
      async (manager) => {
        const { maximum } = (await manager
          .createQueryBuilder(LaytimeCalculation, 'calculation')
          .select('MAX(calculation.version)', 'maximum')
          .where('calculation.voyageId = :voyageId', { voyageId })
          .andWhere('calculation.parentCalculationId IS NULL')
          .getRawOne<{ maximum: number | null }>()) ?? { maximum: null };

        const nextVersion = (maximum ?? 0) + 1;
        if (nonReversibleSettlement) {
          nonReversibleSettlement.parentVersion = nextVersion;
          for (const operation of nonReversibleSettlement.expectedOperations) {
            const operationSummary =
              nonReversibleSettlement.operations[operation];
            if (operationSummary) operationSummary.childVersion = nextVersion;
          }
        }
        const saved = await manager.save(
          manager.create(LaytimeCalculation, {
            voyageId,
            parentCalculationId: null,
            operation: null,
            version: nextVersion,
            allowedLaytime: parentResult.allowedLaytime,
            usedLaytime: parentResult.usedLaytime,
            demurrageAmount: parentResult.demurrageAmount,
            despatchAmount: parentResult.despatchAmount,
            status: 'Draft' as const,
            settlementAuthorityStatus:
              nonReversibleSettlement?.settlementStatus ??
              reversibleSettlement?.settlementStatus ??
              (reversibleLaytimeRule.enabled !== true &&
              !charterParty.laytimeOperationScope
                ? 'LEGACY'
                : null),
            currency: settlementCurrency,
            inputSnapshot,
            decisionSnapshot,
            warnings: calculationWarnings,
            engineVersion: LAYTIME_ENGINE_VERSION,
          }),
        );

        const parentPeriods =
          reversibleLaytimeRule.contractStatus === 'v1' ||
          nonReversibleSettlement
            ? []
            : result.periods;
        await manager.save(
          parentPeriods.map((period) =>
            manager.create(CalculationPeriod, {
              calculationId: saved.id,
              startTime: period.startTime,
              endTime: period.endTime,
              periodType: period.periodType as CalculationPeriod['periodType'],
              appliedClauseId: period.appliedClauseId,
            }),
          ),
        );

        for (const childCalculation of preparedChildCalculations) {
          await this.createOperationChildResult(
            {
              parentCalculation: saved,
              ...childCalculation,
            },
            manager,
          );
        }

        return manager.findOneOrFail(LaytimeCalculation, {
          where: { id: saved.id },
          relations: { periods: true },
        });
      },
    );

    return { calculation, warnings: calculationWarnings };
  }

  async finalize(id: string): Promise<LaytimeCalculation> {
    const existing = await this.findOne(id);
    if (existing.status === 'Final') {
      throw new ConflictException(`Laytime calculation ${id} is already final`);
    }
    if (existing.parentCalculationId) {
      throw new ConflictException(
        'An operation child calculation cannot be finalized independently of its parent.',
      );
    }
    const existingSettlement = existing.decisionSnapshot
      ?.nonReversibleSettlement as { version?: unknown } | undefined;
    const reversibleSettlement = existing.decisionSnapshot
      ?.reversibleSettlement as ReversibleSettlementResult | undefined;
    if (existingSettlement?.version !== 1) {
      if (reversibleSettlement?.version === 1) {
        return this.databaseContext.transaction(async (manager) => {
          const calculation = await manager.findOneOrFail(LaytimeCalculation, {
            where: { id },
          });
          if (calculation.parentCalculationId) {
            throw new ConflictException(
              'An operation child calculation cannot be finalized independently of its parent.',
            );
          }
          if (calculation.settlementAuthorityStatus !== 'FINAL_AUTHORITATIVE') {
            throw new ConflictException(
              `Reversible settlement cannot be finalized: ${reversibleSettlement.reasonCode}.`,
            );
          }
          if (!calculation.currency) {
            throw new ConflictException(
              'CURRENCY_AUTHORITY_REQUIRED: A V1 settlement cannot be finalized without captured calculation currency.',
            );
          }
          if (
            calculation.demurrageAmount === null ||
            calculation.demurrageAmount === undefined ||
            calculation.despatchAmount === null ||
            calculation.despatchAmount === undefined
          ) {
            throw new ConflictException(
              'A V1 calculation cannot be finalized without authoritative commercial amounts.',
            );
          }

          const children = await manager.find(LaytimeCalculation, {
            where: { parentCalculationId: calculation.id },
          });
          const expectedChildIds = [
            reversibleSettlement.loadingChildCalculationId,
            reversibleSettlement.dischargeChildCalculationId,
          ];
          if (expectedChildIds.some((childId) => !childId)) {
            throw new ConflictException(
              'A reversible V1 calculation cannot be finalized without both operation child results.',
            );
          }
          const expectedChildren = expectedChildIds.map((childId) => {
            const child = children.find(
              (candidate) =>
                candidate.id === childId &&
                candidate.parentCalculationId === calculation.id,
            );
            if (
              !child ||
              child.version !== calculation.version ||
              child.currency !== calculation.currency ||
              child.allowedLaytime === null ||
              child.allowedLaytime === undefined ||
              child.usedLaytime === null ||
              child.usedLaytime === undefined
            ) {
              throw new ConflictException(
                'Reversible operation child calculation does not belong to this parent calculation version or is incomplete.',
              );
            }
            return child;
          });

          calculation.status = 'Final';
          for (const child of expectedChildren) child.status = 'Final';
          await manager.save(expectedChildren);
          return manager.save(calculation);
        });
      }
      throw new ConflictException(
        'Only a V1 authoritative calculation settlement can be finalized for downstream commercial use.',
      );
    }

    return this.databaseContext.transaction(async (manager) => {
      const calculation = await manager.findOneOrFail(LaytimeCalculation, {
        where: { id },
      });
      const settlement = calculation.decisionSnapshot
        ?.nonReversibleSettlement as NonReversibleSettlementResult | undefined;

      if (!settlement)
        throw new ConflictException('Settlement evidence is unavailable.');
      if (calculation.parentCalculationId) {
        throw new ConflictException(
          'A non-reversible operation result must be finalized through its voyage settlement parent.',
        );
      }
      if (!settlement.finalizationEligible) {
        throw new ConflictException(
          `Non-reversible settlement cannot be finalized: ${settlement.finalizationBlockers.join(' ')}`,
        );
      }
      if (!calculation.currency) {
        throw new ConflictException(
          'CURRENCY_AUTHORITY_REQUIRED: A V1 settlement cannot be finalized without captured calculation currency.',
        );
      }

      const children = await manager.find(LaytimeCalculation, {
        where: { parentCalculationId: calculation.id },
      });
      const expectedChildren = settlement.expectedOperations.map(
        (operation) => {
          const summary = settlement.operations[operation];
          const child = children.find(
            (candidate) =>
              candidate.operation === operation &&
              candidate.id === summary?.childCalculationId,
          );
          if (
            !child ||
            child.parentCalculationId !== calculation.id ||
            child.version !== calculation.version ||
            child.currency !== calculation.currency
          ) {
            throw new ConflictException(
              `${operation} child calculation does not belong to this parent calculation version.`,
            );
          }
          return child;
        },
      );

      calculation.status = 'Final';
      calculation.settlementAuthorityStatus = 'FINAL_AUTHORITATIVE';
      for (const child of expectedChildren) {
        child.status = 'Final';
        child.settlementAuthorityStatus = 'FINAL_AUTHORITATIVE';
      }
      await manager.save(expectedChildren);
      return manager.save(calculation);
    });
  }

  /**
   * Prefers events from finalised SOFs; falls back to drafts so a voyage can be
   * calculated provisionally while the paperwork is still being agreed.
   */
  private async loadSofEvents(
    voyageId: string,
    warnings: string[],
  ): Promise<{
    documents: SofDocument[];
    events: SofEvent[];
    hasFinalisedDocument: boolean;
  }> {
    const documents = await this.sofDocuments.find({
      where: { voyageId },
      select: { id: true, status: true, uploadDate: true, operation: true },
    });

    if (documents.length === 0) {
      throw new UnprocessableEntityException(
        `Voyage ${voyageId} has no Statement of Facts; upload one before calculating laytime`,
      );
    }

    const finalDocuments = documents.filter(
      (document) => document.status === 'Final',
    );
    const source = finalDocuments.length > 0 ? finalDocuments : documents;

    if (finalDocuments.length === 0) {
      warnings.push(DRAFT_SOF_AUTHORITY_WARNING);
    }

    const events = await this.sofEvents.find({
      where: { sofId: In(source.map((document) => document.id)) },
      order: { eventTime: 'ASC' },
    });

    return {
      documents: source,
      events,
      hasFinalisedDocument: finalDocuments.length > 0,
    };
  }

  private applyReversibleEvidenceAuthority(
    settlement: ReversibleSettlementResult | null,
    hasFinalisedDocument: boolean,
  ): ReversibleSettlementResult | null {
    if (
      !settlement ||
      settlement.settlementStatus !== 'FINAL_AUTHORITATIVE' ||
      hasFinalisedDocument
    ) {
      return settlement;
    }

    return {
      ...settlement,
      settlementStatus: 'PROVISIONAL',
      reasonCode: 'DRAFT_SOF_EVIDENCE',
      reason: DRAFT_SOF_AUTHORITY_WARNING,
      warnings: settlement.warnings.includes(DRAFT_SOF_AUTHORITY_WARNING)
        ? settlement.warnings
        : [...settlement.warnings, DRAFT_SOF_AUTHORITY_WARNING],
    };
  }

  private buildInputSnapshot(
    voyage: {
      id: string;
      cargoQuantity: string;
      laytimeOperation: LaytimeOperation;
      bulkOperationType?: string | null;
    },
    charterParty: CharterParty,
    clauses: ResolvedClause[],
    norDocuments: NorDocument[],
    locationEvidence: NorTenderLocationEvidence[],
    sofDocuments: SofDocument[],
    sofEvents: SofEvent[],
    sofDocumentSelection: SofDocumentSelection,
    calculationEventSelection: CalculationEventSelection,
    operationSelection: OperationSelectionAudit,
    operationChildren?: OperationChildAudit,
  ): Record<string, unknown> {
    return {
      voyage: {
        id: voyage.id,
        cargoQuantity: voyage.cargoQuantity,
        laytimeOperation: voyage.laytimeOperation,
        bulkOperationType: voyage.bulkOperationType ?? null,
      },
      calculationEventSelection: {
        rule: calculationEventSelection.rule,
        includedEventIds: [...calculationEventSelection.includedEventIds],
        excludedEventIds: [...calculationEventSelection.excludedEventIds],
      },
      sofDocumentSelection: {
        voyageLaytimeOperation: sofDocumentSelection.voyageLaytimeOperation,
        candidateDocumentIds: [...sofDocumentSelection.candidateDocumentIds],
        includedDocumentIds: [...sofDocumentSelection.includedDocumentIds],
        excludedDocumentIds: [...sofDocumentSelection.excludedDocumentIds],
        matchingDocumentIds: [...sofDocumentSelection.matchingDocumentIds],
        legacyNullDocumentIds: [...sofDocumentSelection.legacyNullDocumentIds],
        oppositeOperationDocumentIds: [
          ...sofDocumentSelection.oppositeOperationDocumentIds,
        ],
        rule: sofDocumentSelection.rule,
      },
      operationSelection: {
        voyageLaytimeOperation: operationSelection.voyageLaytimeOperation,
        hasLoadingCompletion: operationSelection.hasLoadingCompletion,
        hasDischargeCompletion: operationSelection.hasDischargeCompletion,
        mixedOperationEvidence: operationSelection.mixedOperationEvidence,
        includedCompletionEventIds: [
          ...operationSelection.includedCompletionEventIds,
        ],
        excludedCompletionEventIds: [
          ...operationSelection.excludedCompletionEventIds,
        ],
      },
      operationChildren: operationChildren
        ? {
            requestedOperations: [...operationChildren.requestedOperations],
            createdOperations: [...operationChildren.createdOperations],
            skippedOperations: operationChildren.skippedOperations.map(
              (operation) => ({
                operation: operation.operation,
                reason: operation.reason,
              }),
            ),
          }
        : null,
      charterParty: {
        id: charterParty.id,
        laytimeOperationScope: charterParty.laytimeOperationScope ?? null,
        settlementCurrency: charterParty.settlementCurrency ?? null,
        clauses: clauses.map((clause) => ({
          id: clause.id,
          clauseType: clause.clauseType,
          rawText: clause.rawText,
          parameters: this.cloneJson(clause.parameters),
        })),
      },
      currencyAuthority: {
        currency: charterParty.settlementCurrency ?? null,
        source: 'charter_party_settlement_currency',
        status: charterParty.settlementCurrency
          ? 'AVAILABLE'
          : 'CURRENCY_AUTHORITY_REQUIRED',
      },
      norDocuments: norDocuments.map((nor) => ({
        id: nor.id,
        tenderTime: nor.tenderTime.toISOString(),
        acceptedTime: nor.acceptedTime?.toISOString() ?? null,
      })),
      norTenderLocationEvidence: {
        availability: locationEvidence.length > 0 ? 'available' : 'unavailable',
        validityEvaluation: 'candidate-associated-v1',
        observations: locationEvidence.map((observation) => ({
          id: observation.id,
          voyageId: observation.voyageId,
          operation: observation.operation,
          evidenceTime: observation.evidenceTime.toISOString(),
          sourceTimeZone: observation.sourceTimeZone ?? null,
          portRelation: observation.portRelation,
          berthRelation: observation.berthRelation,
          waitingPlace: observation.waitingPlace,
          source: observation.source,
          sofDocumentId: observation.sofDocumentId ?? null,
          sourceReference: observation.sourceReference ?? null,
          note: observation.note ?? null,
          norDocumentId: observation.norDocumentId ?? null,
          norTenderedEventId: observation.norTenderedEventId ?? null,
          associationBasis: observation.norDocumentId
            ? 'explicit-nor-document'
            : observation.norTenderedEventId
              ? 'explicit-sof-nor-tendered-event'
              : 'timestamp-operation-observation',
          createdByUserId: observation.createdByUserId,
          createdAt: observation.createdAt.toISOString(),
        })),
      },
      sofDocuments: sofDocuments.map((document) => ({
        id: document.id,
        status: document.status,
        uploadDate: document.uploadDate.toISOString(),
        operation: document.operation ?? null,
      })),
      sofEvents: sofEvents.map((event) => ({
        id: event.id,
        sofId: event.sofId,
        eventTime: event.eventTime.toISOString(),
        sourceTimeZone: event.sourceTimeZone ?? null,
        eventType: event.eventType,
        operation: event.operation ?? null,
        operationClassification: this.classifySofEventOperation(
          event,
          voyage.laytimeOperation,
        ),
        remarks: event.remarks ?? null,
        isManualOverride: event.isManualOverride,
        overrideReason: event.overrideReason ?? null,
      })),
    };
  }

  private buildChildInputSnapshot(
    voyage: { id: string; laytimeOperation: LaytimeOperation },
    parentSnapshot: Record<string, unknown>,
    operation: LaytimeOperation,
    clauses: ResolvedClause[],
    duplicateWarnings: string[],
    documentSelection: OperationSpecificSelectionAudit['documentSelection'],
    eventSelection: OperationSpecificSelectionAudit['eventSelection'],
  ): Record<string, unknown> {
    return {
      ...this.cloneJson(parentSnapshot),
      operationResult: {
        operation,
        source: 'operation-specific-child-calculation',
        clauseSelection: this.buildClauseSelectionAudit(
          clauses,
          duplicateWarnings,
        ),
        documentSelection: {
          candidateDocumentIds: [...documentSelection.candidateDocumentIds],
          includedDocumentIds: [...documentSelection.includedDocumentIds],
          excludedDocumentIds: [...documentSelection.excludedDocumentIds],
          matchingDocumentIds: [...documentSelection.matchingDocumentIds],
          legacyNullDocumentIds: [...documentSelection.legacyNullDocumentIds],
          oppositeOperationDocumentIds: [
            ...documentSelection.oppositeOperationDocumentIds,
          ],
          usedLegacyFallback: documentSelection.usedLegacyFallback,
        },
        eventSelection: {
          candidateEventIds: [...eventSelection.candidateEventIds],
          includedEventIds: [...eventSelection.includedEventIds],
          excludedEventIds: [...eventSelection.excludedEventIds],
          matchingEventIds: [...eventSelection.matchingEventIds],
          legacyNullEventIds: [...eventSelection.legacyNullEventIds],
          oppositeOperationEventIds: [
            ...eventSelection.oppositeOperationEventIds,
          ],
          usedLegacyFallback: eventSelection.usedLegacyFallback,
          matchingCompletionEventId: eventSelection.matchingCompletionEventId,
          selectedCompletionEventId: eventSelection.selectedCompletionEventId,
        },
      },
    };
  }

  private async buildOperationChildCalculations(
    voyage: {
      id: string;
      cargoQuantity: string;
      laytimeOperation: LaytimeOperation;
      bulkOperationType?: BulkOperationType | null;
    },
    charterParty: CharterParty,
    parentClauses: ResolvedClause[],
    norDocuments: NorDocument[],
    sofDocuments: SofDocument[],
    sofEvents: SofEvent[],
    locationEvidence: NorTenderLocationEvidence[],
    allowLegacyOperationDocuments: boolean,
  ): Promise<{
    requestedOperations: LaytimeOperation[];
    created: PreparedOperationChildCalculation[];
    skippedOperations: Array<{ operation: LaytimeOperation; reason: string }>;
  }> {
    const requestedOperations: LaytimeOperation[] = [];
    const created: PreparedOperationChildCalculation[] = [];
    const skippedOperations: Array<{
      operation: LaytimeOperation;
      reason: string;
    }> = [];

    for (const operation of ['Loading', 'Discharge'] as const) {
      requestedOperations.push(operation);
      const plan = this.buildOperationChildCalculation(
        voyage,
        charterParty,
        parentClauses,
        norDocuments,
        sofDocuments,
        sofEvents,
        locationEvidence,
        operation,
        { allowLegacyOperationDocuments },
      );

      if ('skipReason' in plan) {
        skippedOperations.push({
          operation,
          reason: plan.skipReason,
        });
        continue;
      }

      created.push(plan);
    }

    if (created.length === 0) {
      const fallbackOperation = voyage.laytimeOperation;
      if (!requestedOperations.includes(fallbackOperation)) {
        requestedOperations.push(fallbackOperation);
      }

      const fallbackPlan = this.buildOperationChildCalculation(
        voyage,
        charterParty,
        parentClauses,
        norDocuments,
        sofDocuments,
        sofEvents,
        locationEvidence,
        fallbackOperation,
        { allowLegacyFallback: true },
      );

      if ('skipReason' in fallbackPlan) {
        skippedOperations.push({
          operation: fallbackOperation,
          reason: fallbackPlan.skipReason,
        });
      } else {
        created.push(fallbackPlan);
      }
    }

    return {
      requestedOperations,
      created,
      skippedOperations,
    };
  }

  private buildOperationChildCalculation(
    voyage: {
      id: string;
      cargoQuantity: string;
      laytimeOperation: LaytimeOperation;
      bulkOperationType?: BulkOperationType | null;
    },
    charterParty: CharterParty,
    parentClauses: ResolvedClause[],
    norDocuments: NorDocument[],
    sofDocuments: SofDocument[],
    sofEvents: SofEvent[],
    locationEvidence: NorTenderLocationEvidence[],
    operation: LaytimeOperation,
    options?: {
      allowLegacyFallback?: boolean;
      allowLegacyOperationDocuments?: boolean;
    },
  ): PreparedOperationChildCalculation | { skipReason: string } {
    const childWarnings: string[] = [];

    let childDocumentSelection: OperationSpecificSelectionAudit['documentSelection'];
    try {
      childDocumentSelection =
        this.selectOperationSpecificSofDocumentsForEngine(
          operation,
          sofDocuments,
          childWarnings,
        );
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        return {
          skipReason:
            options?.allowLegacyFallback === true
              ? `No applicable SOF document exists for the ${operation} child calculation.`
              : `No explicit ${operation} SOF document exists for a child calculation.`,
        };
      }
      throw error;
    }

    const childLoadedSofEvents = sofEvents.filter((event) =>
      childDocumentSelection.includedDocumentIds.includes(event.sofId),
    );
    if (
      childDocumentSelection.matchingDocumentIds.length === 0 &&
      options?.allowLegacyFallback !== true &&
      (options?.allowLegacyOperationDocuments !== true ||
        !childLoadedSofEvents.some((event) => event.operation === operation))
    ) {
      return {
        skipReason: `No explicit ${operation} SOF document exists for a child calculation.`,
      };
    }
    const childEventSelection = this.selectOperationSpecificSofEventsForEngine(
      operation,
      childLoadedSofEvents,
      childWarnings,
    );

    if (childEventSelection.selection.selectedCompletionEventId === null) {
      return {
        skipReason: `No cargo completion event exists for the ${operation} child calculation.`,
      };
    }

    const sourceClauses = this.filterEngineClauses(
      this.resolveClauses(charterParty),
    );
    const childClauses = resolveClausesForOperation(
      sourceClauses.length > 0 ? sourceClauses : parentClauses,
      operation,
      childWarnings,
    ).map((clause) => ({
      id: clause.id,
      clauseType: clause.clauseType,
      rawText:
        'rawText' in clause ? (clause as ResolvedClause).rawText : undefined,
      parameters: this.cloneJson(clause.parameters),
    })) as ResolvedClause[];

    let childResult: ReturnType<typeof runLaytimeEngine>;
    try {
      childResult = runLaytimeEngine({
        voyageId: voyage.id,
        cargoQuantity: Number(voyage.cargoQuantity),
        clauses: childClauses,
        norDocuments,
        sofEvents: childEventSelection.events,
        norTenderLocationEvidence: locationEvidence,
        operation,
        bulkOperationType: voyage.bulkOperationType ?? null,
      });
    } catch (error) {
      if (error instanceof LaytimeEngineError) {
        return {
          skipReason: error.message,
        };
      }
      throw error;
    }

    return {
      childCalculationId: randomUUID(),
      operation,
      childClauses,
      childClauseWarnings: [...childWarnings],
      childDocumentSelection,
      childEventSelection: childEventSelection.selection,
      childSofEvents: childEventSelection.events,
      childResult,
      childWarnings: [...childWarnings],
    };
  }

  private buildClauseSelectionAudit(
    clauses: ResolvedClause[],
    duplicateWarnings: string[],
  ): OperationSpecificSelectionAudit['clauseSelection'] {
    return {
      selectedClauseIds: clauses.map((clause) => clause.id),
      selectedClauseTypes: clauses.map((clause) => clause.clauseType),
      selectedClauses: clauses.map((clause) => ({
        id: clause.id,
        clauseType: clause.clauseType,
        source:
          clause.parameters.operation === 'Loading' ||
          clause.parameters.operation === 'Discharge'
            ? 'operation-specific'
            : 'global-fallback',
      })),
      duplicateWarnings: [...duplicateWarnings],
    };
  }

  private buildDecisionSnapshot(
    charterParty: CharterParty,
    clauses: ResolvedClause[],
    norDocuments: NorDocument[],
    sofEvents: SofEvent[],
    result: {
      commencedAt: Date;
      commencement: LaytimeEngineResult['commencement'];
      completedAt: Date;
      cargoCompletion: LaytimeEngineResult['cargoCompletion'];
      demurrageStartedAt: Date | null;
      weatherDeductedSeconds: number;
      allowedSeconds: number;
      usedSeconds: number;
      demurrageAmount: number;
      despatchAmount: number;
      atutc: LaytimeEngineResult['atutc'];
      despatchTimeBasis: LaytimeEngineResult['despatchTimeBasis'];
      periods: Array<{
        startTime: Date;
        endTime: Date;
        periodType: string;
        appliedClauseId: string | null;
        exceptionKind?: 'generic' | 'weather' | 'shex';
        exceptionKinds?: Array<'generic' | 'weather' | 'shex'>;
        calendarDates?: Array<{
          localDate: string;
          reasons: string[];
        }>;
      }>;
      ignoredExceptions: Array<{
        startTime: Date;
        endTime: Date;
        appliedClauseId: string | null;
        exceptionKind?: 'generic' | 'weather' | 'shex';
        exceptionKinds?: Array<'generic' | 'weather' | 'shex'>;
        calendarDates?: Array<{
          localDate: string;
          reasons: string[];
        }>;
      }>;
      shexCalendar: LaytimeEngineResult['shexCalendar'];
    },
    reversibleLaytimeRule?: ReversibleLaytimeRuleEvidence,
    reversibleLaytimeAnalysis?: ReversibleLaytimeAnalysis,
    reversibleSettlement?: ReversibleSettlementResult | null,
  ): Record<string, unknown> {
    const firstClause = (type: string) =>
      clauses.find((clause) => clause.clauseType === type);
    const laytimeClause = firstClause('laytime_rate');
    const demurrageClause = firstClause('demurrage_rate');
    const despatchClause = firstClause('despatch');
    const weatherWorkingClause = firstClause('weather_working');
    const wibonClause = result.commencement.location.berth.clauseId
      ? clauses.find(
          (clause) => clause.id === result.commencement.location.berth.clauseId,
        )
      : undefined;
    const wiponClause = result.commencement.location.port.clauseId
      ? clauses.find(
          (clause) => clause.id === result.commencement.location.port.clauseId,
        )
      : undefined;
    const demurrageRate = this.readNumber(demurrageClause?.parameters, [
      'rate',
      'ratePerDay',
      'rate_per_day',
      'amount',
    ]);
    const explicitDespatchRate = this.readNumber(despatchClause?.parameters, [
      'rate',
      'ratePerDay',
      'rate_per_day',
      'amount',
    ]);
    const despatchMultiplier = this.readNumber(despatchClause?.parameters, [
      'multiplier',
    ]);

    const snapshot: Record<string, unknown> = {
      calculationCurrency: {
        currency: charterParty.settlementCurrency ?? null,
        source: 'charter_party_settlement_currency',
        authorityStatus: charterParty.settlementCurrency
          ? 'AVAILABLE'
          : 'CURRENCY_AUTHORITY_REQUIRED',
        finalAuthorityBlocker: charterParty.settlementCurrency
          ? null
          : 'CURRENCY_AUTHORITY_REQUIRED',
      },
      commencement: {
        basis: result.commencement.basis,
        norDocumentId: result.commencement.norDocumentId,
        norTenderedEventId: result.commencement.norTenderedEventId,
        tenderTime: result.commencement.tenderTime.toISOString(),
        acceptedTime: result.commencement.acceptedTime?.toISOString() ?? null,
        baseTime: result.commencement.baseTime.toISOString(),
        commencementRule: result.commencement.commencementRule,
        noticeHours: result.commencement.noticeHours,
        noticeSource: result.commencement.noticeSource,
        scheduleClauseId: result.commencement.scheduleClauseId,
        scheduleBasis: result.commencement.scheduleBasis,
        scheduleCutoffReference: result.commencement.scheduleCutoffReference,
        scheduleGoverningTime:
          result.commencement.scheduleGoverningTime?.toISOString() ?? null,
        scheduleCutoffTime: result.commencement.scheduleCutoffTime,
        scheduleLegacyCompatibilityUsed:
          result.commencement.scheduleLegacyCompatibilityUsed,
        scheduleTimeZone: result.commencement.scheduleTimeZone,
        scheduleWorkingDays: result.commencement.scheduleWorkingDays
          ? [...result.commencement.scheduleWorkingDays]
          : null,
        scheduleLocalNorDate: result.commencement.scheduleLocalNorDate,
        scheduleLocalNorTime: result.commencement.scheduleLocalNorTime,
        scheduleSelectedWorkingDate:
          result.commencement.scheduleSelectedWorkingDate,
        scheduleSelectedLocalCommencementTime:
          result.commencement.scheduleSelectedLocalCommencementTime,
        scheduleSkippedDates: result.commencement.scheduleSkippedDates.map(
          (entry) => ({ ...entry }),
        ),
        commencedAt: result.commencement.commencedAt.toISOString(),
        readinessEventId: result.commencement.readinessEventId,
        readinessTime: result.commencement.readinessTime?.toISOString() ?? null,
        readinessSource: result.commencement.readinessSource,
        validityStatus: result.commencement.validityStatus,
        validityBasis: result.commencement.validityBasis,
        validityWarnings: [...result.commencement.validityWarnings],
        freePratique: {
          ...result.commencement.freePratique,
          grantedTime:
            result.commencement.freePratique.grantedTime?.toISOString() ?? null,
          warnings: [...result.commencement.freePratique.warnings],
        },
        location: this.serializeLocationQualification(
          result.commencement.location,
        ),
        rejectedNorCandidates: result.commencement.rejectedNorCandidates.map(
          (candidate) => ({
            ...candidate,
            tenderTime: candidate.tenderTime.toISOString(),
            warnings: [...candidate.warnings],
            freePratique: {
              ...candidate.freePratique,
              grantedTime:
                candidate.freePratique.grantedTime?.toISOString() ?? null,
              warnings: [...candidate.freePratique.warnings],
            },
          }),
        ),
        freePratiqueRejectedCandidates:
          result.commencement.freePratiqueRejectedCandidates.map(
            (candidate) => ({
              ...candidate,
              tenderTime: candidate.tenderTime.toISOString(),
              freePratique: {
                ...candidate.freePratique,
                grantedTime:
                  candidate.freePratique.grantedTime?.toISOString() ?? null,
                warnings: [...candidate.freePratique.warnings],
              },
            }),
          ),
        locationRejectedCandidates:
          result.commencement.locationRejectedCandidates.map((candidate) => ({
            ...candidate,
            tenderTime: candidate.tenderTime.toISOString(),
            rejectionReasons: [...candidate.rejectionReasons],
            location: this.serializeLocationQualification(candidate.location),
          })),
      },
      cargoCompletion: result.cargoCompletion
        ? {
            eventId: result.cargoCompletion.selectedEventId,
            eventType: result.cargoCompletion.selectedEventType,
            eventTime: result.cargoCompletion.completionTime.toISOString(),
            selectedEventId: result.cargoCompletion.selectedEventId,
            selectedEventType: result.cargoCompletion.selectedEventType,
            selectedTime: result.cargoCompletion.completionTime.toISOString(),
            bulkOperationType: result.cargoCompletion.bulkOperationType,
            selectionBasis: result.cargoCompletion.selectionBasis,
            candidateEventIds: [...result.cargoCompletion.candidateEventIds],
            excludedEventIds: [...result.cargoCompletion.excludedEventIds],
            warnings: [...result.cargoCompletion.warnings],
          }
        : null,
      allowedLaytime: {
        clauseId: laytimeClause?.id ?? null,
        clauseParameters: laytimeClause
          ? this.cloneJson(laytimeClause.parameters)
          : null,
        allowedSeconds: result.allowedSeconds,
        allowedLaytime: secondsToInterval(result.allowedSeconds),
      },
      stoppageEvents: sofEvents
        .filter((event) =>
          [
            'RAIN_STOPPAGE',
            'RAIN_COMMENCED',
            'WEATHER_STOPPAGE',
            'BREAKDOWN',
            'STOPPAGE_START',
            'WORK_STOPPED',
            'RAIN_STOPPED',
            'WEATHER_CLEARED',
            'BREAKDOWN_REPAIRED',
            'STOPPAGE_END',
            'WORK_RESUMED',
          ].includes(event.eventType),
        )
        .map((event) => ({
          eventId: event.id,
          eventType: event.eventType,
          eventTime: event.eventTime.toISOString(),
        })),
      periods: result.periods.map((period) => ({
        startTime: period.startTime.toISOString(),
        endTime: period.endTime.toISOString(),
        periodType: period.periodType,
        appliedClauseId: period.appliedClauseId,
        exceptionKind: period.exceptionKind,
        exceptionKinds: period.exceptionKinds
          ? [...period.exceptionKinds]
          : undefined,
        calendarDates: period.calendarDates
          ? period.calendarDates.map((entry) => ({
              localDate: entry.localDate,
              reasons: [...entry.reasons],
            }))
          : undefined,
      })),
      shexCalendar: {
        clauseId: result.shexCalendar.clauseId,
        calendarVersion: result.shexCalendar.calendarVersion,
        operation: result.shexCalendar.operation,
        shex: result.shexCalendar.shex,
        timeZone: result.shexCalendar.timeZone,
        saturdayExcepted: result.shexCalendar.saturdayExcepted,
        holidayDates: [...result.shexCalendar.holidayDates],
        sourceType: result.shexCalendar.sourceType,
        legacyCompatibilityUsed: result.shexCalendar.legacyCompatibilityUsed,
        generatedIntervals: result.shexCalendar.generatedIntervals.map(
          (interval) => ({
            startTime: interval.startTime.toISOString(),
            endTime: interval.endTime.toISOString(),
            localDate: interval.localDate,
            reasons: [...interval.reasons],
          }),
        ),
      },
      netUsedSeconds: result.usedSeconds,
      demurrage: {
        clauseId: demurrageClause?.id ?? null,
        clauseParameters: demurrageClause
          ? this.cloneJson(demurrageClause.parameters)
          : null,
        ratePerDay: demurrageRate ?? null,
        rateBasis: 'per_day',
        currency: charterParty.settlementCurrency ?? null,
        excessSeconds: Math.max(0, result.usedSeconds - result.allowedSeconds),
        startedAt: result.demurrageStartedAt?.toISOString() ?? null,
        ignoredExceptions: result.ignoredExceptions.map((exception) => ({
          startTime: exception.startTime.toISOString(),
          endTime: exception.endTime.toISOString(),
          appliedClauseId: exception.appliedClauseId,
          exceptionKind: exception.exceptionKind,
          exceptionKinds: exception.exceptionKinds
            ? [...exception.exceptionKinds]
            : undefined,
          calendarDates: exception.calendarDates
            ? exception.calendarDates.map((entry) => ({
                localDate: entry.localDate,
                reasons: [...entry.reasons],
              }))
            : undefined,
          reason: 'already_on_demurrage',
        })),
        amount: result.demurrageAmount,
        amountCurrency: charterParty.settlementCurrency ?? null,
      },
      weatherWorking: weatherWorkingClause
        ? {
            clauseId: weatherWorkingClause.id,
            clauseParameters: this.cloneJson(weatherWorkingClause.parameters),
            enabled:
              this.readBoolean(weatherWorkingClause.parameters, ['enabled']) ??
              null,
            applied:
              this.readBoolean(weatherWorkingClause.parameters, ['enabled']) ===
              true,
            totalWeatherTimeDeductedBeforeDemurrage:
              result.weatherDeductedSeconds,
          }
        : null,
      despatch: {
        clauseId: despatchClause?.id ?? null,
        clauseParameters: despatchClause
          ? this.cloneJson(despatchClause.parameters)
          : null,
        explicitRate: explicitDespatchRate ?? null,
        rateCurrency: charterParty.settlementCurrency ?? null,
        multiplier: despatchMultiplier ?? null,
        pricingBasis:
          explicitDespatchRate !== undefined
            ? 'explicit_rate'
            : despatchMultiplier !== undefined
              ? 'multiplier'
              : 'half_demurrage_fallback',
        fallbackMultiplier:
          explicitDespatchRate === undefined && despatchMultiplier === undefined
            ? 0.5
            : null,
        savedSeconds: Math.max(0, result.allowedSeconds - result.usedSeconds),
        timeBasis: result.despatchTimeBasis,
        amount: result.despatchAmount,
        amountCurrency: charterParty.settlementCurrency ?? null,
      },
      wibon: wibonClause
        ? {
            clauseId: wibonClause.id,
            clauseParameters: this.cloneJson(wibonClause.parameters),
            enabled:
              this.readBoolean(wibonClause.parameters, ['enabled']) ?? null,
            configured: true,
            applied: result.commencement.location.berth.waiverApplied,
            evaluationStatus: result.commencement.location.berth.status,
            reason: result.commencement.location.berth.reason,
          }
        : {
            clauseId: null,
            clauseParameters: null,
            enabled: null,
            configured: false,
            applied: false,
            evaluationStatus: result.commencement.location.berth.status,
            reason: result.commencement.location.berth.reason,
          },
      wipon: wiponClause
        ? {
            clauseId: wiponClause.id,
            clauseParameters: this.cloneJson(wiponClause.parameters),
            enabled:
              this.readBoolean(wiponClause.parameters, ['enabled']) ?? null,
            configured: true,
            applied: result.commencement.location.port.waiverApplied,
            evaluationStatus: result.commencement.location.port.status,
            reason: result.commencement.location.port.reason,
          }
        : {
            clauseId: null,
            clauseParameters: null,
            enabled: null,
            configured: false,
            applied: false,
            evaluationStatus: result.commencement.location.port.status,
            reason: result.commencement.location.port.reason,
          },
      atutc: this.cloneJson(result.atutc),
      reversibleLaytimeRule: reversibleLaytimeRule
        ? {
            clauseId: reversibleLaytimeRule.clauseId,
            clauseType: reversibleLaytimeRule.clauseType,
            enabled: reversibleLaytimeRule.enabled,
            contractStatus: reversibleLaytimeRule.contractStatus,
            settlementVersion: reversibleLaytimeRule.settlementVersion,
            allowanceMode: reversibleLaytimeRule.allowanceMode,
            clauseParameters: this.cloneJson(
              reversibleLaytimeRule.clauseParameters,
            ),
            rawText: reversibleLaytimeRule.rawText,
            conflictingClauseIds: [
              ...reversibleLaytimeRule.conflictingClauseIds,
            ],
            warnings: [...reversibleLaytimeRule.warnings],
          }
        : null,
      reversibleLaytimeAnalysis: reversibleLaytimeAnalysis
        ? this.cloneJson(reversibleLaytimeAnalysis)
        : null,
      reversibleSettlement: reversibleSettlement
        ? this.cloneJson(reversibleSettlement)
        : null,
    };

    if (
      reversibleSettlement &&
      reversibleLaytimeRule?.contractStatus === 'v1'
    ) {
      snapshot.referencePrimaryOperation = {
        commencement: snapshot.commencement,
        cargoCompletion: snapshot.cargoCompletion,
        allowedLaytime: snapshot.allowedLaytime,
        netUsedSeconds: snapshot.netUsedSeconds,
        demurrage: snapshot.demurrage,
        despatch: snapshot.despatch,
        periods: snapshot.periods,
      };
      snapshot.commencement = null;
      snapshot.cargoCompletion = null;
      snapshot.allowedLaytime = {
        source: 'reversible-settlement-v1',
        allowedSeconds: reversibleSettlement.combinedAllowedSeconds,
        allowedLaytime:
          reversibleSettlement.combinedAllowedSeconds === null
            ? null
            : secondsToInterval(reversibleSettlement.combinedAllowedSeconds),
      };
      snapshot.periods = [];
      snapshot.netUsedSeconds = reversibleSettlement.combinedUsedSeconds;
      snapshot.demurrage = {
        source: 'reversible-settlement-v1',
        ratePerDay: reversibleSettlement.demurrageRate,
        rateBasis: 'per_day',
        currency: charterParty.settlementCurrency ?? null,
        excessSeconds: reversibleSettlement.combinedOverrunSeconds,
        startedAt:
          reversibleSettlement.threshold?.timestamp.toISOString() ?? null,
        amount: reversibleSettlement.demurrageAmount,
        amountCurrency: charterParty.settlementCurrency ?? null,
      };
      snapshot.despatch = {
        source: 'reversible-settlement-v1',
        ratePerDay: reversibleSettlement.despatchRate,
        rateCurrency: charterParty.settlementCurrency ?? null,
        timeBasis: reversibleSettlement.despatchTimeBasis,
        savedSeconds: reversibleSettlement.combinedSavedSeconds,
        amount: reversibleSettlement.despatchAmount,
        amountCurrency: charterParty.settlementCurrency ?? null,
      };
    }

    return snapshot;
  }

  private serializeLocationQualification(
    qualification: NorLocationQualificationResult,
  ): Record<string, unknown> {
    return {
      ...qualification,
      selectedEvidence: qualification.selectedEvidence
        ? {
            ...qualification.selectedEvidence,
            evidenceTime:
              qualification.selectedEvidence.evidenceTime.toISOString(),
            createdAt: qualification.selectedEvidence.createdAt.toISOString(),
          }
        : null,
      conflictingEvidenceIds: [...qualification.conflictingEvidenceIds],
      ignoredUnassociatedEvidenceIds: [
        ...qualification.ignoredUnassociatedEvidenceIds,
      ],
      ineligibleAfterTenderEvidenceIds: [
        ...qualification.ineligibleAfterTenderEvidenceIds,
      ],
      berth: { ...qualification.berth },
      port: { ...qualification.port },
      warnings: [...qualification.warnings],
    };
  }

  private resolveReversibleSettlement(
    rule: ReversibleLaytimeRuleEvidence,
    clauses: ResolvedClause[],
    cargoQuantity: number,
    loadingChild: PreparedOperationChildCalculation | undefined,
    dischargeChild: PreparedOperationChildCalculation | undefined,
  ): ReversibleSettlementResult | null {
    if (
      rule.contractStatus === 'absent' ||
      rule.contractStatus === 'disabled'
    ) {
      return null;
    }

    const contractStatus: ReversibleSettlementRuleInput['contractStatus'] =
      rule.contractStatus === 'v1' ||
      rule.contractStatus === 'legacy' ||
      rule.contractStatus === 'ambiguous'
        ? rule.contractStatus
        : 'invalid';
    const settlementRule: ReversibleSettlementRuleInput = {
      clauseId: rule.clauseId,
      contractStatus,
      settlementVersion: rule.settlementVersion,
      allowanceMode: rule.allowanceMode,
    };

    return resolveReversibleLaytimeSettlement({
      rule: settlementRule,
      cargoQuantity,
      allowances: {
        Loading: this.resolveReversibleAllowance(
          clauses,
          'Loading',
          cargoQuantity,
        ),
        Discharge: this.resolveReversibleAllowance(
          clauses,
          'Discharge',
          cargoQuantity,
        ),
      },
      operations: {
        Loading: this.toReversibleOperationInput(loadingChild),
        Discharge: this.toReversibleOperationInput(dischargeChild),
      },
    });
  }

  private applyReversibleCurrencyAuthority(
    settlement: ReversibleSettlementResult | null,
    currency: SettlementCurrency | null,
  ): ReversibleSettlementResult | null {
    if (!settlement) return null;

    settlement.currency = currency;
    settlement.currencySource = 'charter_party_settlement_currency';
    settlement.currencyAuthorityStatus = currency
      ? 'AVAILABLE'
      : 'CURRENCY_AUTHORITY_REQUIRED';
    settlement.claimEligibilityImpact = currency
      ? 'AUTHORITATIVE_CURRENCY_AVAILABLE'
      : 'LAYTIME_CALCULATION_CURRENCY_REQUIRED';
    for (const rate of [
      settlement.loadingDemurrage,
      settlement.dischargeDemurrage,
      settlement.loadingDespatch,
      settlement.dischargeDespatch,
    ]) {
      if (rate) {
        rate.rateBasis = 'per_day';
        rate.currency = currency;
      }
    }

    if (
      !currency &&
      settlement.version === 1 &&
      settlement.settlementStatus === 'FINAL_AUTHORITATIVE'
    ) {
      settlement.settlementStatus = 'NONAUTHORITATIVE';
      settlement.reasonCode = 'CURRENCY_AUTHORITY_REQUIRED';
      settlement.reason =
        'The Charter Party settlement currency was not configured for this calculation version.';
      settlement.warnings.push(
        'CURRENCY_AUTHORITY_REQUIRED: Time results remain available, but the commercial settlement is not authoritative.',
      );
    }

    return settlement;
  }

  private resolveReversibleAllowance(
    clauses: ResolvedClause[],
    operation: 'Loading' | 'Discharge',
    cargoQuantity: number,
  ): ReversibleAllowanceInput | null {
    const operationClauses = clauses.filter(
      (clause) =>
        clause.clauseType === 'laytime_rate' &&
        clause.parameters.operation === operation,
    );
    const globalClauses = clauses.filter(
      (clause) =>
        clause.clauseType === 'laytime_rate' &&
        clause.parameters.operation !== 'Loading' &&
        clause.parameters.operation !== 'Discharge',
    );
    const clause =
      operationClauses.length === 1
        ? operationClauses[0]
        : operationClauses.length === 0 && globalClauses.length === 1
          ? globalClauses[0]
          : undefined;
    if (!clause) return null;

    const hours = this.readStrictNumber(clause.parameters, 'hours');
    const days = this.readStrictNumber(clause.parameters, 'days');
    const rateEntries = ['rate', 'ratePerDay', 'rate_per_day']
      .map((key) => ({
        key,
        value: this.readStrictNumber(clause.parameters, key),
      }))
      .filter(
        (entry): entry is { key: string; value: number } =>
          entry.value !== null,
      );
    const mechanisms = [
      hours !== null ? 'hours' : null,
      days !== null ? 'days' : null,
      rateEntries.length > 0 ? 'rate' : null,
    ].filter((value): value is 'hours' | 'days' | 'rate' => value !== null);
    if (mechanisms.length !== 1 || rateEntries.length > 1) return null;

    const mechanism = mechanisms[0];
    const allowedSeconds =
      mechanism === 'hours'
        ? (hours as number) * 3600
        : mechanism === 'days'
          ? (days as number) * 86400
          : (cargoQuantity / rateEntries[0].value) * 86400;
    if (!Number.isFinite(allowedSeconds) || allowedSeconds <= 0) return null;

    return {
      clauseId: clause.id,
      source:
        clause.parameters.operation === operation
          ? 'operation-specific'
          : 'global-fallback',
      mechanism,
      parameters: this.cloneJson(clause.parameters),
      allowedSeconds,
    };
  }

  private toReversibleOperationInput(
    child: PreparedOperationChildCalculation | undefined,
  ) {
    if (!child) return null;
    const demurrage = this.resolveChildDemurragePricing(child);
    const despatch = this.resolveChildDespatchPricing(child);

    return {
      operation: child.operation as 'Loading' | 'Discharge',
      childCalculationId: child.childCalculationId,
      timeline: child.childResult.preDemurragePeriods,
      demurrage,
      despatch: despatch
        ? {
            clauseId: despatch.clauseId ?? '',
            rate: despatch.rate,
            timeBasis: despatch.timeBasis,
          }
        : null,
    };
  }

  private readStrictNumber(
    parameters: Record<string, unknown>,
    key: string,
  ): number | null {
    const value = parameters[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? value
      : null;
  }

  private resolveChildDemurragePricing(
    child: PreparedOperationChildCalculation | undefined,
  ): { clauseId: string | null; rate: number | null } | null {
    if (!child) {
      return null;
    }

    const clause = child.childClauses.find(
      (candidate) => candidate.clauseType === 'demurrage_rate',
    );

    if (!clause) {
      return {
        clauseId: null,
        rate: null,
      };
    }

    return {
      clauseId: clause.id,
      rate:
        this.readNumber(clause.parameters, [
          'rate',
          'ratePerDay',
          'rate_per_day',
          'amount',
        ]) ?? null,
    };
  }

  private resolveChildDespatchPricing(
    child: PreparedOperationChildCalculation | undefined,
  ): {
    clauseId: string | null;
    rate: number | null;
    source: 'explicit_rate' | 'multiplier' | 'half_demurrage_fallback';
    timeBasis: 'all_time_saved' | 'working_time_saved';
  } | null {
    if (!child) {
      return null;
    }

    const clause = child.childClauses.find(
      (candidate) => candidate.clauseType === 'despatch',
    );

    if (!clause) {
      return null;
    }

    const explicitRate = this.readNumber(clause.parameters, [
      'rate',
      'ratePerDay',
      'rate_per_day',
      'amount',
    ]);
    const multiplier = this.readNumber(clause.parameters, ['multiplier']);
    const demurrageRate = this.resolveChildDemurragePricing(child)?.rate;
    const timeBasis = child.childResult.despatchTimeBasis.effectiveTimeBasis;

    if (explicitRate !== undefined) {
      return {
        clauseId: clause.id,
        rate: explicitRate,
        source: 'explicit_rate',
        timeBasis,
      };
    }

    if (multiplier !== undefined) {
      if (demurrageRate === null || demurrageRate === undefined) {
        return null;
      }

      return {
        clauseId: clause.id,
        rate: demurrageRate * multiplier,
        source: 'multiplier',
        timeBasis,
      };
    }

    if (demurrageRate === null || demurrageRate === undefined) {
      return null;
    }

    return {
      clauseId: clause.id,
      rate: demurrageRate / 2,
      source: 'half_demurrage_fallback',
      timeBasis,
    };
  }

  private readNumber(
    parameters: Record<string, unknown> | undefined,
    keys: string[],
  ): number | undefined {
    if (!parameters) return undefined;

    for (const key of keys) {
      const value = parameters[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }

    return undefined;
  }

  private readBoolean(
    parameters: Record<string, unknown> | undefined,
    keys: string[],
  ): boolean | undefined {
    if (!parameters) return undefined;

    for (const key of keys) {
      const value = parameters[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
      }
    }

    return undefined;
  }

  private resolveClauses(charterParty: CharterParty): ResolvedClause[] {
    const persistedClauses = (charterParty.clauses ?? []).map((clause) => ({
      id: clause.id,
      clauseType: clause.clauseType,
      rawText: clause.rawText,
      parameters: this.cloneJson(clause.parameters),
    }));

    if (persistedClauses.length > 0) {
      return persistedClauses;
    }

    return normalizeCommercialTermsToClauses(charterParty);
  }

  private filterEngineClauses(clauses: ResolvedClause[]): ResolvedClause[] {
    return clauses.filter(
      (clause) => clause.clauseType !== 'reversible_laytime',
    );
  }

  private classifySofEventOperation(
    event: SofEvent,
    voyageOperation: LaytimeOperation,
  ): SofEventOperationClassification {
    if (GLOBAL_SOF_EVENT_TYPES.has(event.eventType)) {
      return 'global';
    }

    if (event.operation === null || event.operation === undefined) {
      return 'legacy-null';
    }

    return event.operation === voyageOperation
      ? 'matching-operation'
      : 'mismatched-operation';
  }

  private selectSofEventsForEngine(
    voyageOperation: LaytimeOperation,
    sofEvents: SofEvent[],
  ): {
    events: SofEvent[];
    selection: CalculationEventSelection;
  } {
    const includedEvents: SofEvent[] = [];
    const includedEventIds: string[] = [];
    const excludedEventIds: string[] = [];

    for (const event of sofEvents) {
      // Completion evidence is operation-specific whenever it declares an
      // operation.  This remains true for tanker HOSES_DISCONNECTED and the
      // generic completion markers, even though some of those event types can
      // otherwise be shared as global timeline evidence.  Passing another
      // operation's terminal marker to the engine lets tanker selection choose
      // the earliest hose-disconnect across the voyage.
      if (
        COMPLETION_EVENT_TYPES.has(event.eventType) &&
        event.operation !== null &&
        event.operation !== undefined &&
        event.operation !== voyageOperation
      ) {
        excludedEventIds.push(event.id);
        continue;
      }

      includedEvents.push(event);
      includedEventIds.push(event.id);
    }

    return {
      events: includedEvents,
      selection: {
        rule: 'exclude-explicit-mismatched-operation-completion-events',
        includedEventIds,
        excludedEventIds,
      },
    };
  }

  private selectSofDocumentsForEngine(
    voyageOperation: LaytimeOperation,
    sofDocuments: SofDocument[],
    warnings: string[],
  ): SofDocumentSelection {
    const candidateDocumentIds = sofDocuments.map((document) => document.id);
    const matchingDocuments = sofDocuments.filter(
      (document) => document.operation === voyageOperation,
    );
    const legacyNullDocuments = sofDocuments.filter(
      (document) =>
        document.operation === null || document.operation === undefined,
    );
    const oppositeOperationDocuments = sofDocuments.filter(
      (document) =>
        document.operation !== null &&
        document.operation !== undefined &&
        document.operation !== voyageOperation,
    );

    if (matchingDocuments.length === 0 && legacyNullDocuments.length === 0) {
      throw new UnprocessableEntityException(
        `No applicable SOF document exists for voyage laytime operation ${voyageOperation}`,
      );
    }

    const includedDocuments =
      matchingDocuments.length > 0
        ? [...matchingDocuments, ...legacyNullDocuments]
        : [...legacyNullDocuments];

    if (matchingDocuments.length === 0 && legacyNullDocuments.length > 0) {
      warnings.push(
        'Legacy unscoped SOF evidence was used because no operation-matching SOF document existed for the voyage laytime operation.',
      );
    }

    return {
      voyageLaytimeOperation: voyageOperation,
      candidateDocumentIds,
      includedDocumentIds: includedDocuments.map((document) => document.id),
      excludedDocumentIds: oppositeOperationDocuments.map(
        (document) => document.id,
      ),
      matchingDocumentIds: matchingDocuments.map((document) => document.id),
      legacyNullDocumentIds: legacyNullDocuments.map((document) => document.id),
      oppositeOperationDocumentIds: oppositeOperationDocuments.map(
        (document) => document.id,
      ),
      rule: 'matching-operation-plus-legacy-null',
    };
  }

  private selectOperationSpecificSofDocumentsForEngine(
    voyageOperation: LaytimeOperation,
    sofDocuments: SofDocument[],
    warnings: string[],
  ): OperationSpecificSelectionAudit['documentSelection'] {
    const candidateDocumentIds = sofDocuments.map((document) => document.id);
    const matchingDocuments = sofDocuments.filter(
      (document) => document.operation === voyageOperation,
    );
    const legacyNullDocuments = sofDocuments.filter(
      (document) =>
        document.operation === null || document.operation === undefined,
    );
    const oppositeOperationDocuments = sofDocuments.filter(
      (document) =>
        document.operation !== null &&
        document.operation !== undefined &&
        document.operation !== voyageOperation,
    );

    if (matchingDocuments.length === 0 && legacyNullDocuments.length === 0) {
      throw new UnprocessableEntityException(
        `No applicable SOF document exists for voyage laytime operation ${voyageOperation}`,
      );
    }

    const includedDocuments =
      matchingDocuments.length > 0
        ? [...matchingDocuments, ...legacyNullDocuments]
        : [...legacyNullDocuments];

    const usedLegacyFallback =
      matchingDocuments.length === 0 && legacyNullDocuments.length > 0;

    if (usedLegacyFallback) {
      warnings.push(
        'Legacy unscoped SOF evidence was used because no operation-matching child SOF document existed for the voyage laytime operation.',
      );
    }

    return {
      candidateDocumentIds,
      includedDocumentIds: includedDocuments.map((document) => document.id),
      excludedDocumentIds: oppositeOperationDocuments.map(
        (document) => document.id,
      ),
      matchingDocumentIds: matchingDocuments.map((document) => document.id),
      legacyNullDocumentIds: legacyNullDocuments.map((document) => document.id),
      oppositeOperationDocumentIds: oppositeOperationDocuments.map(
        (document) => document.id,
      ),
      usedLegacyFallback,
    };
  }

  private selectOperationSpecificSofEventsForEngine(
    voyageOperation: LaytimeOperation,
    sofEvents: SofEvent[],
    warnings: string[],
  ): {
    events: SofEvent[];
    selection: OperationSpecificSelectionAudit['eventSelection'];
  } {
    const candidateEventIds = sofEvents.map((event) => event.id);
    const matchingEvents = sofEvents.filter(
      (event) =>
        event.operation === voyageOperation &&
        event.operation !== null &&
        event.operation !== undefined,
    );
    const legacyNullEvents = sofEvents.filter(
      (event) => event.operation === null || event.operation === undefined,
    );
    const oppositeOperationEvents = sofEvents.filter(
      (event) =>
        event.operation !== null &&
        event.operation !== undefined &&
        event.operation !== voyageOperation,
    );

    const matchingCompletionEvents = matchingEvents.filter((event) =>
      COMPLETION_EVENT_TYPES.has(event.eventType),
    );
    const explicitMatchingCompletionExists =
      matchingCompletionEvents.length > 0;
    const usedLegacyFallback =
      !explicitMatchingCompletionExists && legacyNullEvents.length > 0;

    if (usedLegacyFallback) {
      warnings.push(
        'Legacy unscoped SOF evidence was used because no operation-matching child completion event existed for the voyage laytime operation.',
      );
    }

    const excludedEventIds = new Set<string>([
      ...oppositeOperationEvents.map((event) => event.id),
    ]);
    if (explicitMatchingCompletionExists) {
      for (const event of sofEvents) {
        if (
          COMPLETION_EVENT_TYPES.has(event.eventType) &&
          !matchingCompletionEvents.some((matching) => matching.id === event.id)
        ) {
          excludedEventIds.add(event.id);
        }
      }
    }

    const includedEvents = sofEvents.filter(
      (event) => !excludedEventIds.has(event.id),
    );

    const selectedCompletionEventId =
      [
        ...includedEvents
          .filter((event) => COMPLETION_EVENT_TYPES.has(event.eventType))
          .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime()),
      ].at(-1)?.id ?? null;

    const matchingCompletionEventId =
      matchingCompletionEvents
        .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())
        .at(-1)?.id ?? null;

    return {
      events: includedEvents,
      selection: {
        candidateEventIds,
        includedEventIds: includedEvents.map((event) => event.id),
        excludedEventIds: [...excludedEventIds],
        matchingEventIds: matchingEvents.map((event) => event.id),
        legacyNullEventIds: legacyNullEvents.map((event) => event.id),
        oppositeOperationEventIds: oppositeOperationEvents.map(
          (event) => event.id,
        ),
        usedLegacyFallback,
        matchingCompletionEventId,
        selectedCompletionEventId,
      },
    };
  }

  private async createOperationChildResult(
    input: CreateOperationChildResultInput,
    manager?: EntityManager,
  ): Promise<LaytimeCalculation> {
    const persist = async (entityManager: EntityManager) => {
      const existingChild = await entityManager.findOne(LaytimeCalculation, {
        where: {
          parentCalculationId: input.parentCalculation.id,
          operation: input.operation,
        },
      });

      if (existingChild) {
        throw new ConflictException(
          `Laytime calculation ${input.parentCalculation.id} already has a ${input.operation} child result`,
        );
      }

      const saved = await entityManager.save(
        entityManager.create(LaytimeCalculation, {
          id: input.id ?? randomUUID(),
          voyageId: input.parentCalculation.voyageId,
          parentCalculationId: input.parentCalculation.id,
          operation: input.operation,
          version: input.parentCalculation.version,
          status: input.parentCalculation.status,
          allowedLaytime: input.allowedLaytime,
          usedLaytime: input.usedLaytime,
          demurrageAmount: input.demurrageAmount,
          despatchAmount: input.despatchAmount,
          inputSnapshot: input.inputSnapshot,
          decisionSnapshot: input.decisionSnapshot,
          warnings: input.warnings,
          engineVersion: input.engineVersion,
          settlementAuthorityStatus: input.settlementAuthorityStatus ?? null,
          currency: input.currency,
          calculatedAt: input.calculatedAt ?? new Date(),
        }),
      );

      const savedPeriods = await entityManager.save(
        input.periods.map((period) =>
          entityManager.create(CalculationPeriod, {
            calculationId: saved.id,
            startTime: period.startTime,
            endTime: period.endTime,
            periodType: period.periodType,
            appliedClauseId: period.appliedClauseId,
          } as any),
        ),
      );

      return {
        ...saved,
        periods: Array.isArray(savedPeriods)
          ? savedPeriods
          : savedPeriods
            ? [savedPeriods]
            : [],
      };
    };

    if (manager) {
      return persist(manager);
    }

    return this.databaseContext.transaction(persist);
  }

  private buildOperationSelectionAudit(
    voyageOperation: LaytimeOperation,
    loadedSofEvents: SofEvent[],
    calculationEventSelection: CalculationEventSelection,
  ): OperationSelectionAudit {
    const isExplicitOperationCompletion = (event: SofEvent) =>
      COMPLETION_EVENT_TYPES.has(event.eventType) &&
      event.operation !== null &&
      event.operation !== undefined;

    const hasLoadingCompletion = loadedSofEvents.some(
      (event) =>
        COMPLETION_EVENT_TYPES.has(event.eventType) &&
        event.operation === 'Loading',
    );
    const hasDischargeCompletion = loadedSofEvents.some(
      (event) =>
        COMPLETION_EVENT_TYPES.has(event.eventType) &&
        event.operation === 'Discharge',
    );
    const completionEvents = loadedSofEvents.filter(
      isExplicitOperationCompletion,
    );

    return {
      voyageLaytimeOperation: voyageOperation,
      hasLoadingCompletion,
      hasDischargeCompletion,
      mixedOperationEvidence: hasLoadingCompletion && hasDischargeCompletion,
      includedCompletionEventIds: completionEvents
        .filter((event) =>
          calculationEventSelection.includedEventIds.includes(event.id),
        )
        .map((event) => event.id),
      excludedCompletionEventIds: completionEvents
        .filter((event) =>
          calculationEventSelection.excludedEventIds.includes(event.id),
        )
        .map((event) => event.id),
    };
  }

  private sortOperations(operations: LaytimeOperation[]): LaytimeOperation[] {
    const rank = (operation: LaytimeOperation) =>
      operation === 'Loading' ? 0 : operation === 'Discharge' ? 1 : 2;

    return [...new Set(operations)].sort(
      (left, right) => rank(left) - rank(right),
    );
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private readSnapshotNumber(
    snapshot: Record<string, unknown> | null | undefined,
    ...path: string[]
  ): number | undefined {
    let value: unknown = snapshot;
    for (const key of path) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }

    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }
}
