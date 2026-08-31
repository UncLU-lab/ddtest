import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import type { SettlementCurrency } from '../currency/settlement-currency';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { LaytimeStatement } from '../entities/laytime-statement.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { Voyage } from '../entities/voyage.entity';
import { VoyagesService } from '../voyages/voyages.service';

type JsonRecord = Record<string, any>;

@Injectable()
export class LaytimeStatementsService {
  constructor(
    @InjectRepository(LaytimeStatement)
    private readonly statements: Repository<LaytimeStatement>,
    @InjectRepository(LaytimeCalculation)
    private readonly calculations: Repository<LaytimeCalculation>,
    @InjectRepository(Voyage)
    private readonly voyages: Repository<Voyage>,
    @InjectRepository(CharterParty)
    private readonly charterParties: Repository<CharterParty>,
    @InjectRepository(SofDocument)
    private readonly sofDocuments: Repository<SofDocument>,
    private readonly voyagesService: VoyagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(calculationId: string): Promise<LaytimeStatement> {
    const existing = await this.statements.findOne({
      where: { sourceCalculationId: calculationId },
    });
    if (existing) return existing;

    const calculation = await this.calculations.findOne({
      where: { id: calculationId, parentCalculationId: IsNull() },
    });
    if (!calculation) {
      throw new NotFoundException(
        `Authoritative parent calculation ${calculationId} not found`,
      );
    }

    if (calculation.status !== 'Final') {
      throw new ConflictException(
        'A Laytime Statement requires a final calculation lifecycle status.',
      );
    }
    if (calculation.settlementAuthorityStatus !== 'FINAL_AUTHORITATIVE') {
      throw new ConflictException(
        'A Laytime Statement requires a FINAL_AUTHORITATIVE calculation.',
      );
    }
    if (!calculation.currency) {
      throw new ConflictException(
        'A Laytime Statement requires an authoritative settlement currency.',
      );
    }
    if (!calculation.inputSnapshot || !calculation.decisionSnapshot) {
      throw new UnprocessableEntityException(
        'The source calculation does not contain the immutable audit snapshots required for a Laytime Statement.',
      );
    }
    const reversibleSettlement = this.readReversibleSettlement(calculation);
    const nonReversibleSettlement = (calculation.decisionSnapshot as JsonRecord)
      .nonReversibleSettlement;
    if (
      (!reversibleSettlement && nonReversibleSettlement?.version !== 1) ||
      (reversibleSettlement &&
        reversibleSettlement.settlementStatus !== 'FINAL_AUTHORITATIVE') ||
      calculation.demurrageAmount === null ||
      calculation.demurrageAmount === undefined ||
      calculation.despatchAmount === null ||
      calculation.despatchAmount === undefined
    ) {
      throw new ConflictException(
        'The source calculation does not contain an authoritative V1 settlement.',
      );
    }
    const voyage = await this.voyagesService.findOne(calculation.voyageId);
    const charterParty = voyage.charterPartyId
      ? await this.charterParties.findOne({
          where: { id: voyage.charterPartyId },
          relations: { clauses: true },
        })
      : null;
    const sourceDocumentIds = this.readSourceDocumentIds(calculation);
    if (sourceDocumentIds.length === 0) {
      throw new ConflictException(
        'A Laytime Statement requires the SOF documents used by the source calculation.',
      );
    }
    const sourceDocuments = sourceDocumentIds.length
      ? await this.sofDocuments.findBy({ id: In(sourceDocumentIds) })
      : [];
    if (
      sourceDocuments.length !== sourceDocumentIds.length ||
      sourceDocuments.some((document) => document.status !== 'Final')
    ) {
      throw new ConflictException(
        'A Laytime Statement requires the final SOF documents used by the authoritative calculation.',
      );
    }
    const children = await this.calculations.find({
      where: { parentCalculationId: calculation.id },
      order: { operation: 'ASC', id: 'ASC' },
    });
    const settlement = reversibleSettlement;

    const statementVersion = await this.nextVersion(calculation.voyageId);
    const statement = this.statements.create({
      organizationId: voyage.organizationId,
      voyageId: voyage.id,
      charterPartyId: voyage.charterPartyId ?? null,
      sourceCalculationId: calculation.id,
      sourceCalculationVersion: calculation.version,
      loadingCalculationId: settlement?.loadingChildCalculationId ?? null,
      dischargeCalculationId: settlement?.dischargeChildCalculationId ?? null,
      authoritativeSofDocumentIds: sourceDocumentIds,
      settlementAuthorityStatus: calculation.settlementAuthorityStatus,
      currency: calculation.currency,
      version: statementVersion,
      createdByUserId: this.tenantContext.getUserId(),
      statementSnapshot: this.buildSnapshot(
        voyage,
        charterParty,
        calculation,
        children,
        sourceDocuments,
        settlement,
      ),
    });

    try {
      return await this.statements.save(statement);
    } catch (error: any) {
      if (error?.code === '23505') {
        const duplicate = await this.statements.findOne({
          where: { sourceCalculationId: calculation.id },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async findForVoyage(voyageId: string): Promise<LaytimeStatement[]> {
    await this.voyagesService.ensureExists(voyageId);
    return this.statements.find({
      where: { voyageId },
      order: { version: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async findOne(id: string): Promise<LaytimeStatement> {
    const statement = await this.statements.findOne({ where: { id } });
    if (!statement)
      throw new NotFoundException(`Laytime Statement ${id} not found`);
    await this.voyagesService.ensureExists(statement.voyageId);
    return statement;
  }

  private async nextVersion(voyageId: string): Promise<number> {
    const latest = await this.statements.findOne({
      where: { voyageId },
      order: { version: 'DESC', id: 'DESC' },
    });
    return (latest?.version ?? 0) + 1;
  }

  private readReversibleSettlement(
    calculation: LaytimeCalculation,
  ): JsonRecord | null {
    const settlement = (calculation.decisionSnapshot as JsonRecord)
      ?.reversibleSettlement;
    return settlement?.version === 1 ? settlement : null;
  }

  private readSourceDocumentIds(calculation: LaytimeCalculation): string[] {
    const input = calculation.inputSnapshot as JsonRecord;
    const selection = input.sofDocumentSelection as JsonRecord | undefined;
    const ids = selection?.includedDocumentIds;
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
  }

  private buildSnapshot(
    voyage: Voyage,
    charterParty: CharterParty | null,
    calculation: LaytimeCalculation,
    children: LaytimeCalculation[],
    sourceDocuments: SofDocument[],
    settlement: JsonRecord | null,
  ): JsonRecord {
    const input = calculation.inputSnapshot as JsonRecord;
    const decisions = calculation.decisionSnapshot as JsonRecord;
    return {
      identity: { statementType: 'LAYTIME_STATEMENT_V1' },
      voyage: {
        vessel: voyage.vessel?.name ?? null,
        reference: voyage.reference,
        loadPort: voyage.loadPort,
        dischargePort: voyage.dischargePort,
        cargo: voyage.cargoType,
        cargoQuantity: voyage.cargoQuantity,
        cargoQuantityUnit: voyage.cargoQuantityUnit,
      },
      charterParty: charterParty
        ? {
            id: charterParty.id,
            laytimeOperationScope: charterParty.laytimeOperationScope ?? null,
            laytimeAllowance: charterParty.laytimeAllowed ?? null,
            timeCountingBasis: charterParty.timeCountingBasis ?? null,
            norNoticeRule: charterParty.norNoticePeriod ?? null,
            demurrageRate: charterParty.demurrageRate ?? null,
            despatchRate: charterParty.dispatchRate ?? null,
            settlementCurrency: charterParty.settlementCurrency ?? null,
            clauses: (charterParty.clauses ?? []).map((clause) => ({
              id: clause.id,
              clauseType: clause.clauseType,
              rawText: clause.rawText,
              parameters: clause.parameters,
            })),
          }
        : null,
      sofDocuments: sourceDocuments.map((document) => ({
        id: document.id,
        filePath: document.filePath,
        status: document.status,
        uploadDate: document.uploadDate,
        operation: document.operation ?? null,
      })),
      evidence: {
        sourceNorDocuments: input.norDocuments ?? [],
        locationEvidence: input.norTenderLocationEvidence ?? null,
        commencement: decisions.commencement ?? null,
        cargoCompletion: decisions.cargoCompletion ?? null,
        sofEvents: input.sofEvents ?? [],
      },
      calculation: {
        id: calculation.id,
        version: calculation.version,
        status: calculation.status,
        authority: calculation.settlementAuthorityStatus,
        currency: calculation.currency,
        calculatedAt: calculation.calculatedAt,
        engineVersion: calculation.engineVersion ?? null,
        allowedLaytime: calculation.allowedLaytime,
        usedLaytime: calculation.usedLaytime,
        demurrageAmount: calculation.demurrageAmount,
        despatchAmount: calculation.despatchAmount,
        settlement: settlement ?? decisions.nonReversibleSettlement ?? null,
        reversibleAnalysis: decisions.reversibleLaytimeAnalysis ?? null,
        children: children.map((child) => ({
          id: child.id,
          operation: child.operation,
          parentCalculationId: child.parentCalculationId,
          version: child.version,
          allowedLaytime: child.allowedLaytime,
          usedLaytime: child.usedLaytime,
          demurrageAmount: child.demurrageAmount,
          despatchAmount: child.despatchAmount,
          currency: child.currency,
          inputSnapshot: child.inputSnapshot,
          decisionSnapshot: child.decisionSnapshot,
        })),
      },
    };
  }
}
