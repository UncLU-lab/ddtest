import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { normalizeCommercialTermsToClauses } from '../charter-party-terms';
import { LAYTIME_ENGINE_VERSION, runLaytimeEngine } from '../laytime/laytime.engine';
import { EngineClause, LaytimeEngineError } from '../laytime/laytime.types';
import { secondsToInterval } from '../laytime/interval.util';
import { type LaytimeOperation } from '../entities/voyage.entity';
import { VoyagesService } from '../voyages/voyages.service';

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

type OperationSelectionAudit = {
  voyageLaytimeOperation: LaytimeOperation;
  hasLoadingCompletion: boolean;
  hasDischargeCompletion: boolean;
  mixedOperationEvidence: boolean;
  includedCompletionEventIds: string[];
  excludedCompletionEventIds: string[];
};

const GLOBAL_SOF_EVENT_TYPES = new Set([
  'NOR_TENDERED',
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
  'CARGO_COMPLETED',
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
    allowedLaytime: string;
    usedLaytime: string;
    excessLaytime: string | null;
    savedLaytime: string | null;
    demurrageAmount: string;
    despatchAmount: string;
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
    private readonly voyagesService: VoyagesService,
    private readonly dataSource: DataSource,
  ) {}

  async findForVoyage(
    voyageId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<LaytimeCalculation>> {
    await this.voyagesService.ensureExists(voyageId);

    const result = await this.calculations.findAndCount({
      where: { voyageId, parentCalculationId: IsNull() },
      order: { version: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async findOne(id: string): Promise<LaytimeCalculation> {
    const calculation = await this.calculations.findOne({ where: { id } });

    if (!calculation) {
      throw new NotFoundException(`Laytime calculation ${id} not found`);
    }

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

  /**
   * Returns persisted calculation evidence only. It deliberately does not load
   * current voyage, charter-party, NOR, SOF, or clause rows.
   */
  async getAudit(id: string): Promise<CalculationAuditResponse> {
    const calculation = await this.findOne(id);
    const allowedSeconds = this.readSnapshotNumber(
      calculation.decisionSnapshot,
      'allowedLaytime',
      'allowedSeconds',
    );
    const usedSeconds = this.readSnapshotNumber(
      calculation.decisionSnapshot,
      'netUsedSeconds',
    );

    return {
      calculation: {
        id: calculation.id,
        voyageId: calculation.voyageId,
        version: calculation.version,
        status: calculation.status,
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

    const [norDocuments, sofSource] = await Promise.all([
      this.norDocuments.find({ where: { voyageId } }),
      this.loadSofEvents(voyageId, warnings),
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
        cargoQuantity: Number(voyage.cargoQuantity),
        clauses,
        norDocuments,
        sofEvents,
      });
    } catch (error) {
      if (error instanceof LaytimeEngineError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    const calculationWarnings = [...warnings, ...result.warnings];
    const inputSnapshot = this.buildInputSnapshot(
      voyage,
      charterParty,
      clauses,
      norDocuments,
      sofSource.documents,
      loadedSofEvents,
      documentSelection,
      eventSelection.selection,
      operationSelection,
    );
    const decisionSnapshot = this.buildDecisionSnapshot(
      charterParty,
      clauses,
      norDocuments,
      sofEvents,
      result,
    );

    const calculation = await this.dataSource.transaction(async (manager) => {
      const { maximum } = (await manager
        .createQueryBuilder(LaytimeCalculation, 'calculation')
        .select('MAX(calculation.version)', 'maximum')
        .where('calculation.voyageId = :voyageId', { voyageId })
        .andWhere('calculation.parentCalculationId IS NULL')
        .getRawOne<{ maximum: number | null }>()) ?? { maximum: null };

      const saved = await manager.save(
        manager.create(LaytimeCalculation, {
          voyageId,
          parentCalculationId: null,
          operation: null,
          version: (maximum ?? 0) + 1,
          allowedLaytime: secondsToInterval(result.allowedSeconds),
          usedLaytime: secondsToInterval(result.usedSeconds),
          demurrageAmount: result.demurrageAmount.toFixed(2),
          despatchAmount: result.despatchAmount.toFixed(2),
          status: 'Draft' as const,
          inputSnapshot,
          decisionSnapshot,
          warnings: calculationWarnings,
          engineVersion: LAYTIME_ENGINE_VERSION,
        }),
      );

      await manager.save(
        result.periods.map((period) =>
          manager.create(CalculationPeriod, {
            calculationId: saved.id,
            startTime: period.startTime,
            endTime: period.endTime,
            periodType: period.periodType,
            appliedClauseId: period.appliedClauseId,
          }),
        ),
      );

      return manager.findOneOrFail(LaytimeCalculation, {
        where: { id: saved.id },
        relations: { periods: true },
      });
    });

    return { calculation, warnings: calculationWarnings };
  }

  async finalize(id: string): Promise<LaytimeCalculation> {
    const calculation = await this.findOne(id);

    if (calculation.status === 'Final') {
      throw new ConflictException(`Laytime calculation ${id} is already final`);
    }

    calculation.status = 'Final';

    return this.calculations.save(calculation);
  }

  /**
   * Prefers events from finalised SOFs; falls back to drafts so a voyage can be
   * calculated provisionally while the paperwork is still being agreed.
   */
  private async loadSofEvents(
    voyageId: string,
    warnings: string[],
  ): Promise<{ documents: SofDocument[]; events: SofEvent[] }> {
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
      warnings.push(
        'No finalised Statement of Facts was available; the calculation used draft SOF events.',
      );
    }

    const events = await this.sofEvents.find({
      where: { sofId: In(source.map((document) => document.id)) },
      order: { eventTime: 'ASC' },
    });

    return { documents: source, events };
  }

  private buildInputSnapshot(
    voyage: { id: string; cargoQuantity: string; laytimeOperation: LaytimeOperation },
    charterParty: CharterParty,
    clauses: ResolvedClause[],
    norDocuments: NorDocument[],
    sofDocuments: SofDocument[],
    sofEvents: SofEvent[],
    sofDocumentSelection: SofDocumentSelection,
    calculationEventSelection: CalculationEventSelection,
    operationSelection: OperationSelectionAudit,
  ): Record<string, unknown> {
    return {
      voyage: {
        id: voyage.id,
        cargoQuantity: voyage.cargoQuantity,
        laytimeOperation: voyage.laytimeOperation,
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
      charterParty: {
        id: charterParty.id,
        clauses: clauses.map((clause) => ({
          id: clause.id,
          clauseType: clause.clauseType,
          rawText: clause.rawText,
          parameters: this.cloneJson(clause.parameters),
        })),
      },
      norDocuments: norDocuments.map((nor) => ({
        id: nor.id,
        tenderTime: nor.tenderTime.toISOString(),
        acceptedTime: nor.acceptedTime?.toISOString() ?? null,
      })),
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

  private buildDecisionSnapshot(
    charterParty: CharterParty,
    clauses: ResolvedClause[],
    norDocuments: NorDocument[],
    sofEvents: SofEvent[],
    result: {
      commencedAt: Date;
      completedAt: Date;
      demurrageStartedAt: Date | null;
      weatherDeductedSeconds: number;
      allowedSeconds: number;
      usedSeconds: number;
      demurrageAmount: number;
      despatchAmount: number;
      periods: Array<{
        startTime: Date;
        endTime: Date;
        periodType: string;
        appliedClauseId: string | null;
      }>;
      ignoredExceptions: Array<{
        startTime: Date;
        endTime: Date;
        appliedClauseId: string | null;
      }>;
    },
  ): Record<string, unknown> {
    const firstClause = (type: string) =>
      clauses.find((clause) => clause.clauseType === type);
    const laytimeClause = firstClause('laytime_rate');
    const demurrageClause = firstClause('demurrage_rate');
    const despatchClause = firstClause('despatch');
    const weatherWorkingClause = firstClause('weather_working');
    const wibonClause = firstClause('wibon');
    const wiponClause = firstClause('wipon');
    const earliestNor = [...norDocuments].sort(
      (a, b) => a.tenderTime.getTime() - b.tenderTime.getTime(),
    )[0];
    const fallbackNorEvent = [...sofEvents]
      .filter((event) => event.eventType === 'NOR_TENDERED')
      .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())[0];
    const completion = [...sofEvents]
      .filter((event) =>
        [
          'CARGO_COMPLETED',
          'LOADING_COMPLETED',
          'DISCHARGE_COMPLETED',
          'COMPLETION_OF_CARGO',
          'HOSES_DISCONNECTED',
        ].includes(event.eventType),
      )
      .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())
      .at(-1);
    const noticeHours = this.readNumber(laytimeClause?.parameters, [
      'noticeHours',
      'notice_hours',
      'turnTimeHours',
    ]);
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

    return {
      commencement: {
        basis: earliestNor
          ? earliestNor.acceptedTime
            ? 'nor_accepted'
            : 'nor_tendered'
          : 'sof_nor_tendered',
        norDocumentId: earliestNor?.id ?? null,
        norTenderedEventId: earliestNor ? null : (fallbackNorEvent?.id ?? null),
        tenderTime: earliestNor?.tenderTime.toISOString() ?? null,
        acceptedTime: earliestNor?.acceptedTime?.toISOString() ?? null,
        baseTime: earliestNor
          ? (earliestNor.acceptedTime ?? earliestNor.tenderTime).toISOString()
          : (fallbackNorEvent?.eventTime.toISOString() ?? null),
        noticeHours: noticeHours ?? 6,
        noticeSource: noticeHours === undefined ? 'default' : 'charter_party',
        commencedAt: result.commencedAt.toISOString(),
      },
      cargoCompletion: completion
        ? {
            eventId: completion.id,
            eventType: completion.eventType,
            eventTime: completion.eventTime.toISOString(),
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
      })),
      netUsedSeconds: result.usedSeconds,
      demurrage: {
        clauseId: demurrageClause?.id ?? null,
        clauseParameters: demurrageClause
          ? this.cloneJson(demurrageClause.parameters)
          : null,
        ratePerDay: demurrageRate ?? null,
        excessSeconds: Math.max(0, result.usedSeconds - result.allowedSeconds),
        startedAt: result.demurrageStartedAt?.toISOString() ?? null,
        ignoredExceptions: result.ignoredExceptions.map((exception) => ({
          startTime: exception.startTime.toISOString(),
          endTime: exception.endTime.toISOString(),
          appliedClauseId: exception.appliedClauseId,
          reason: 'already_on_demurrage',
        })),
        amount: result.demurrageAmount,
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
            totalWeatherTimeDeductedBeforeDemurrage: result.weatherDeductedSeconds,
          }
        : null,
      despatch: {
        clauseId: despatchClause?.id ?? null,
        clauseParameters: despatchClause
          ? this.cloneJson(despatchClause.parameters)
          : null,
        explicitRate: explicitDespatchRate ?? null,
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
        amount: result.despatchAmount,
      },
      wibon: wibonClause
        ? {
            clauseId: wibonClause.id,
            clauseParameters: this.cloneJson(wibonClause.parameters),
            enabled: this.readBoolean(wibonClause.parameters, ['enabled']) ?? null,
            applied:
              this.readBoolean(wibonClause.parameters, ['enabled']) === true,
          }
        : null,
      wipon: wiponClause
        ? {
            clauseId: wiponClause.id,
            clauseParameters: this.cloneJson(wiponClause.parameters),
            enabled: this.readBoolean(wiponClause.parameters, ['enabled']) ?? null,
            applied:
              this.readBoolean(wiponClause.parameters, ['enabled']) === true,
            limitation:
              'Port-limit status is not currently modeled; timing is unchanged.',
          }
        : null,
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
      const classification = this.classifySofEventOperation(
        event,
        voyageOperation,
      );

      if (
        classification === 'mismatched-operation' &&
        (event.eventType === 'LOADING_COMPLETED' ||
          event.eventType === 'DISCHARGE_COMPLETED')
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
      (document) => document.operation === null || document.operation === undefined,
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
      excludedDocumentIds: oppositeOperationDocuments.map((document) => document.id),
      matchingDocumentIds: matchingDocuments.map((document) => document.id),
      legacyNullDocumentIds: legacyNullDocuments.map((document) => document.id),
      oppositeOperationDocumentIds: oppositeOperationDocuments.map((document) => document.id),
      rule: 'matching-operation-plus-legacy-null',
    };
  }

  private buildOperationSelectionAudit(
    voyageOperation: LaytimeOperation,
    loadedSofEvents: SofEvent[],
    calculationEventSelection: CalculationEventSelection,
  ): OperationSelectionAudit {
    const isExplicitOperationCompletion = (event: SofEvent) =>
      (event.eventType === 'LOADING_COMPLETED' ||
        event.eventType === 'DISCHARGE_COMPLETED') &&
      event.operation !== null &&
      event.operation !== undefined;

    const hasLoadingCompletion = loadedSofEvents.some(
      (event) =>
        event.eventType === 'LOADING_COMPLETED' &&
        event.operation === 'Loading',
    );
    const hasDischargeCompletion = loadedSofEvents.some(
      (event) =>
        event.eventType === 'DISCHARGE_COMPLETED' &&
        event.operation === 'Discharge',
    );
    const completionEvents = loadedSofEvents.filter(isExplicitOperationCompletion);

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
