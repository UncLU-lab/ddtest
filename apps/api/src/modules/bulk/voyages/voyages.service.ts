import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { CpClause } from '../entities/cp-clause.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { Counterparty } from '../entities/counterparty.entity';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { Vessel } from '../entities/vessel.entity';
import {
  VOYAGE_COUNTERPARTY_ROLES,
  VoyageCounterparty,
} from '../entities/voyage-counterparty.entity';
import { Voyage } from '../entities/voyage.entity';
import {
  normalizeCommercialTermsToClauses,
  parseNoticeHours,
} from '../charter-party-terms';
import {
  resolveShexCalendarContract,
  ShexCalendarError,
} from '../laytime/shex-calendar';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import {
  CreateVoyageCommercialTermsDto,
  CreateVoyageDto,
} from './dto/create-voyage.dto';
import { ListVoyagesQueryDto } from './dto/list-voyages-query.dto';
import { UpdateVoyageDto } from './dto/update-voyage.dto';
import { VoyageSummary, buildVoyageSummary } from './voyage-summary';

export type VoyageRiskLevel = 'critical' | 'elevated' | 'optimal';

export interface VoyageListItem extends Omit<Voyage, 'vessel'> {
  vessel?: Pick<Vessel, 'id' | 'name'> | null;
  supplier: string | null;
  receiver: string | null;
  risk: VoyageRiskLevel;
  exposure: number;
  openDisputeCount: number;
  amountUnderDispute: number;
  calculationStale: boolean;
  laycanExpired: boolean;
}

function parseNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeListRisk(input: {
  status?: Voyage['status'];
  laycanEnd?: string | null;
  exposure: number;
  openDisputeCount: number;
  calculationStale: boolean;
}): {
  risk: VoyageRiskLevel;
  laycanExpired: boolean;
} {
  const laycanExpired =
    input.status === 'Planned' &&
    Boolean(input.laycanEnd) &&
    new Date(String(input.laycanEnd)) < new Date();

  let risk: VoyageRiskLevel = 'optimal';

  if (laycanExpired) {
    risk = 'critical';
  } else if (
    input.openDisputeCount > 0 ||
    input.calculationStale ||
    input.exposure > 0
  ) {
    risk = 'elevated';
  }

  return {
    risk,
    laycanExpired,
  };
}

function mapVoyageListItem(
  voyage: Voyage,
  raw: Record<string, unknown>,
): VoyageListItem {
  const exposure = parseNumber(raw.latestDemurrageAmount);
  const openDisputeCount = parseNumber(raw.openDisputeCount);
  const amountUnderDispute = parseNumber(raw.amountUnderDispute);
  const latestCalculationAt = toNullableDate(raw.latestCalculationAt);
  const newestSofUploadAt = toNullableDate(raw.newestSofUploadAt);
  const calculationStale =
    latestCalculationAt !== null &&
    newestSofUploadAt !== null &&
    latestCalculationAt.getTime() < newestSofUploadAt.getTime();
  const { risk, laycanExpired } = computeListRisk({
    status: voyage.status,
    laycanEnd: voyage.laycanEnd,
    exposure,
    openDisputeCount,
    calculationStale,
  });

  return {
    ...voyage,
    vessel: voyage.vessel
      ? { id: voyage.vessel.id, name: voyage.vessel.name }
      : null,
    supplier: (raw.supplier as string | null | undefined) ?? null,
    receiver: (raw.receiver as string | null | undefined) ?? null,
    risk,
    exposure,
    openDisputeCount,
    amountUnderDispute,
    calculationStale,
    laycanExpired,
  };
}

@Injectable()
export class VoyagesService {
  constructor(
    @InjectRepository(Voyage)
    private readonly voyages: Repository<Voyage>,

    @InjectRepository(Vessel)
    private readonly vessels: Repository<Vessel>,

    @InjectRepository(SofDocument)
    private readonly sofDocuments: Repository<SofDocument>,

    @InjectRepository(NorDocument)
    private readonly norDocuments: Repository<NorDocument>,

    @InjectRepository(LaytimeCalculation)
    private readonly laytimeCalculations: Repository<LaytimeCalculation>,

    @InjectRepository(DisputeCaseBulk)
    private readonly disputes: Repository<DisputeCaseBulk>,

    private readonly databaseContext: TenantDatabaseContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(
    query: ListVoyagesQueryDto,
  ): Promise<Paginated<VoyageListItem>> {
    const organizationId = this.tenantContext.getOrganizationId();
    const builder = this.voyages
      .createQueryBuilder('voyage')
      .leftJoinAndSelect(
        'voyage.vessel',
        'vessel',
        'vessel.organizationId = :organizationId',
      )
      .andWhere('voyage.organizationId = :organizationId')
      .addSelect(
        (subQuery) =>
          subQuery
            .select('counterparty.name')
            .from(VoyageCounterparty, 'link')
            .innerJoin('link.counterparty', 'counterparty')
            .where('link.voyageId = voyage.id')
            .andWhere('counterparty.organizationId = :organizationId')
            .andWhere('link.role = :supplierRole')
            .limit(1),
        'supplier',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('counterparty.name')
            .from(VoyageCounterparty, 'link')
            .innerJoin('link.counterparty', 'counterparty')
            .where('link.voyageId = voyage.id')
            .andWhere('counterparty.organizationId = :organizationId')
            .andWhere('link.role = :receiverRole')
            .limit(1),
        'receiver',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('calculation.demurrageAmount')
            .from(LaytimeCalculation, 'calculation')
            .where('calculation.voyageId = voyage.id')
            .andWhere('calculation.parentCalculationId IS NULL')
            .orderBy('calculation.version', 'DESC')
            .addOrderBy('calculation.calculatedAt', 'DESC')
            .limit(1),
        'latestDemurrageAmount',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('calculation.calculatedAt')
            .from(LaytimeCalculation, 'calculation')
            .where('calculation.voyageId = voyage.id')
            .andWhere('calculation.parentCalculationId IS NULL')
            .orderBy('calculation.version', 'DESC')
            .addOrderBy('calculation.calculatedAt', 'DESC')
            .limit(1),
        'latestCalculationAt',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('sof.uploadDate')
            .from(SofDocument, 'sof')
            .where('sof.voyageId = voyage.id')
            .orderBy('sof.uploadDate', 'DESC')
            .limit(1),
        'newestSofUploadAt',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(1)')
            .from(DisputeCaseBulk, 'dispute')
            .where('dispute.voyageId = voyage.id')
            .andWhere('dispute.status <> :resolvedStatus'),
        'openDisputeCount',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COALESCE(SUM(dispute.amountDisputed), 0)')
            .from(DisputeCaseBulk, 'dispute')
            .where('dispute.voyageId = voyage.id')
            .andWhere('dispute.status <> :resolvedStatus'),
        'amountUnderDispute',
      )
      .orderBy('voyage.laycanStart', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) {
      builder.andWhere('voyage.status = :status', {
        status: query.status,
      });
    }

    if (query.vesselId) {
      builder.andWhere('voyage.vesselId = :vesselId', {
        vesselId: query.vesselId,
      });
    }

    if (query.loadPort) {
      builder.andWhere('voyage.loadPort = :loadPort', {
        loadPort: query.loadPort,
      });
    }

    if (query.dischargePort) {
      builder.andWhere('voyage.dischargePort = :dischargePort', {
        dischargePort: query.dischargePort,
      });
    }

    if (query.laycanFrom) {
      builder.andWhere('voyage.laycanEnd >= :laycanFrom', {
        laycanFrom: query.laycanFrom,
      });
    }

    if (query.laycanTo) {
      builder.andWhere('voyage.laycanStart <= :laycanTo', {
        laycanTo: query.laycanTo,
      });
    }

    builder.setParameters({
      organizationId,
      supplierRole: 'Supplier',
      receiverRole: 'Receiver',
      resolvedStatus: 'Resolved',
    });

    const total = await builder.clone().getCount();
    const { entities, raw } = await builder.getRawAndEntities();

    const data = entities.map((voyage, index) =>
      mapVoyageListItem(voyage, raw[index] ?? {}),
    );

    return paginate([data, total], query);
  }

  async findOne(id: string): Promise<Voyage> {
    const organizationId = this.tenantContext.getOrganizationId();
    const voyage = await this.voyages.findOne({
      where: {
        id,
        organizationId,
      },
      relations: {
        vessel: true,
        charterParty: {
          clauses: true,
        },
        counterpartyLinks: {
          counterparty: true,
        },
      },
    });

    if (!voyage || voyage.organizationId !== organizationId) {
      throw new NotFoundException(`Voyage ${id} not found`);
    }

    return voyage;
  }

  /**
   * Loads a voyage without relations.
   * Used by sub-resource services to validate the parent voyage.
   */
  async ensureExists(id: string): Promise<Voyage> {
    const organizationId = this.tenantContext.getOrganizationId();
    const voyage = await this.voyages.findOne({
      where: {
        id,
        organizationId,
      },
    });

    if (!voyage || voyage.organizationId !== organizationId) {
      throw new NotFoundException(`Voyage ${id} not found`);
    }

    return voyage;
  }

  async create(dto: CreateVoyageDto): Promise<Voyage> {
    this.assertReversibleLaytimeInitialization(dto.reversibleLaytime);
    const organizationId = this.tenantContext.getOrganizationId();
    const vessel = await this.vessels.findOne({
      where: {
        id: dto.vesselId,
        organizationId,
      },
      select: { id: true },
    });

    if (!vessel) {
      throw new NotFoundException(`Vessel ${dto.vesselId} not found`);
    }

    this.assertLaycanOrder(dto.laycanStart, dto.laycanEnd);
    this.assertShexCalendarInitialization(
      dto.timeCountingBasis,
      dto.shexCalendar,
      'Global terms',
    );
    this.assertShexCalendarInitialization(
      dto.loadingTerms?.timeCountingBasis,
      dto.loadingTerms?.shexCalendar,
      'Loading terms',
    );
    this.assertShexCalendarInitialization(
      dto.dischargeTerms?.timeCountingBasis,
      dto.dischargeTerms?.shexCalendar,
      'Discharge terms',
    );

    /*
     * The database requires a non-null voyage reference.
     * Prefer the user-entered value when present; otherwise generate one.
     */
    const reference =
      dto.reference?.trim() || (await this.generateVoyageReference());
    const {
      supplier,
      receiver,
      laytimeAllowed,
      demurrageRate,
      dispatchRate,
      timeCountingBasis,
      shexCalendar,
      norNoticePeriod,
      loadingTerms,
      dischargeTerms,
      laytimeOperation,
      bulkOperationType,
      settlementCurrency,
      laytimeOperationScope,
      reversibleLaytime,
      ...voyageDto
    } = dto;

    const createDto = {
      ...dto,
      shexCalendar,
      loadingTerms,
      dischargeTerms,
    };

    const voyage = await this.databaseContext.transaction(async (manager) => {
      const savedVoyage = await manager.save(
        manager.create(Voyage, {
          ...voyageDto,
          organizationId,
          eta: voyageDto.eta ? new Date(voyageDto.eta) : null,
          reference,
          ...(laytimeOperation !== undefined ? { laytimeOperation } : {}),
          ...(bulkOperationType !== undefined ? { bulkOperationType } : {}),
          cargoQuantity: voyageDto.cargoQuantity.toFixed(2),
        }),
      );

      await this.attachVoyageCounterparty(
        manager,
        savedVoyage.id,
        supplier,
        'Supplier',
      );
      await this.attachVoyageCounterparty(
        manager,
        savedVoyage.id,
        receiver,
        'Receiver',
      );

      if (this.hasCommercialTerms(dto)) {
        const charterParty = await manager.save(
          manager.create(CharterParty, {
            voyageId: savedVoyage.id,
            formType: 'Pre-ops draft',
            fullText: this.buildCharterPartySummary(createDto),
            effectiveDate: voyageDto.laycanStart.slice(0, 10),
            laytimeAllowed: laytimeAllowed ?? null,
            demurrageRate:
              demurrageRate !== undefined ? demurrageRate.toFixed(2) : null,
            dispatchRate:
              dispatchRate !== undefined ? dispatchRate.toFixed(2) : null,
            timeCountingBasis: timeCountingBasis ?? null,
            norNoticePeriod: norNoticePeriod ?? null,
            settlementCurrency: settlementCurrency ?? null,
            laytimeOperationScope: laytimeOperationScope ?? null,
          }),
        );

        for (const clause of this.buildCommercialClauses(
          createDto,
          charterParty.id,
        )) {
          await manager.save(manager.create(CpClause, clause));
        }

        await manager.update(Voyage, savedVoyage.id, {
          charterPartyId: charterParty.id,
        });
      }

      return savedVoyage;
    });

    return this.findOne(voyage.id);
  }

  async update(id: string, dto: UpdateVoyageDto): Promise<Voyage> {
    const voyage = await this.findOne(id);

    if (dto.cargoQuantity !== undefined) {
      voyage.cargoQuantity = dto.cargoQuantity.toFixed(2);
    }

    if (dto.cargoType !== undefined) {
      voyage.cargoType = dto.cargoType;
    }

    if (dto.dischargePort !== undefined) {
      voyage.dischargePort = dto.dischargePort;
    }

    if (dto.eta !== undefined) {
      voyage.eta = new Date(dto.eta);
    }

    const legacyDto = dto as UpdateVoyageDto & {
      laytimeOperation?: Voyage['laytimeOperation'];
      bulkOperationType?: Voyage['bulkOperationType'];
    };

    if (legacyDto.laytimeOperation !== undefined) {
      voyage.laytimeOperation = legacyDto.laytimeOperation;
    }

    if (legacyDto.bulkOperationType !== undefined) {
      voyage.bulkOperationType = legacyDto.bulkOperationType;
    }

    return this.voyages.save(voyage);
  }

  /**
   * The voyage plus everything a case handler needs at a glance:
   * documents, latest laytime result, disputes and derived risk indicators.
   */
  async findSummary(id: string): Promise<VoyageSummary> {
    const voyage = await this.findOne(id);

    const [sofDocuments, norDocuments, latestCalculation, disputes] =
      await Promise.all([
        this.sofDocuments.find({
          where: { voyageId: id },
          order: { uploadDate: 'DESC' },
        }),

        this.norDocuments.find({
          where: { voyageId: id },
          order: { tenderTime: 'ASC' },
        }),

        this.laytimeCalculations.findOne({
          where: { voyageId: id, parentCalculationId: IsNull() },
          order: { version: 'DESC' },
        }),

        this.disputes.find({
          where: { voyageId: id },
          order: { createdDate: 'DESC' },
        }),
      ]);

    return buildVoyageSummary({
      voyage,
      charterParty: voyage.charterParty ?? null,
      counterpartyLinks: voyage.counterpartyLinks ?? [],
      sofDocuments,
      norDocuments,
      latestCalculation,
      disputes,
    });
  }

  /**
   * Generates a unique voyage reference such as:
   *
   * VOY-20260815-001
   * VOY-20260815-002
   * VOY-20260815-003
   */
  private async generateVoyageReference(): Promise<string> {
    const organizationId = this.tenantContext.getOrganizationId();
    const date = new Date();

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    const prefix = `VOY-${year}${month}${day}`;

    const latestVoyage = await this.voyages
      .createQueryBuilder('voyage')
      .where('voyage.organizationId = :organizationId', {
        organizationId,
      })
      .andWhere('voyage.reference LIKE :prefix', {
        prefix: `${prefix}-%`,
      })
      .orderBy('voyage.reference', 'DESC')
      .getOne();

    let sequence = 1;

    if (latestVoyage?.reference) {
      const match = latestVoyage.reference.match(/-(\d+)$/);

      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
  }

  private assertLaycanOrder(start: string, end: string): void {
    if (new Date(end) < new Date(start)) {
      throw new BadRequestException('laycanEnd must not precede laycanStart');
    }
  }

  private hasCommercialTerms(dto: CreateVoyageDto): boolean {
    return Boolean(
      dto.laytimeAllowed !== undefined ||
        dto.demurrageRate !== undefined ||
        dto.dispatchRate !== undefined ||
        dto.timeCountingBasis?.trim() ||
        dto.shexCalendar !== undefined ||
        dto.norNoticePeriod?.trim() ||
        dto.settlementCurrency !== undefined ||
        dto.laytimeOperationScope !== undefined ||
        dto.reversibleLaytime?.enabled === true ||
        this.hasOperationCommercialTerms(dto.loadingTerms) ||
        this.hasOperationCommercialTerms(dto.dischargeTerms),
    );
  }

  private assertReversibleLaytimeInitialization(
    reversibleLaytime: CreateVoyageDto['reversibleLaytime'],
  ): void {
    if (reversibleLaytime?.enabled !== true) {
      return;
    }

    if (
      reversibleLaytime.settlementVersion !== 1 ||
      reversibleLaytime.allowanceMode !== 'sum_operation_allowances'
    ) {
      throw new BadRequestException(
        'Enabled reversible laytime requires settlementVersion 1 and allowanceMode sum_operation_allowances.',
      );
    }
  }

  private buildCharterPartySummary(dto: CreateVoyageDto): string {
    return [
      dto.supplier ? `Supplier: ${dto.supplier}` : null,
      dto.receiver ? `Receiver: ${dto.receiver}` : null,
      dto.laytimeAllowed !== undefined
        ? `Laytime allowed: ${dto.laytimeAllowed}h`
        : null,
      dto.demurrageRate !== undefined
        ? `Demurrage: $${dto.demurrageRate.toLocaleString()}/day`
        : null,
      dto.dispatchRate !== undefined
        ? `Dispatch: $${dto.dispatchRate.toLocaleString()}/day`
        : null,
      dto.timeCountingBasis ? `Basis: ${dto.timeCountingBasis}` : null,
      dto.norNoticePeriod ? `NOR notice: ${dto.norNoticePeriod}` : null,
      dto.settlementCurrency ? `Settlement currency: ${dto.settlementCurrency}` : null,
      dto.laytimeOperationScope ? `Laytime applies to: ${dto.laytimeOperationScope}` : null,
      dto.reversibleLaytime?.enabled ? 'Reversible laytime: enabled (V1)' : null,
      this.buildOperationTermsSummary('Loading terms', dto.loadingTerms),
      this.buildOperationTermsSummary('Discharge terms', dto.dischargeTerms),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildCommercialClauses(
    dto: CreateVoyageDto,
    charterPartyId: string,
  ): Array<
    Pick<CpClause, 'charterPartyId' | 'clauseType' | 'rawText' | 'parameters'>
  > {
    this.assertShexCalendarInitialization(
      dto.timeCountingBasis,
      dto.shexCalendar,
      'Global terms',
    );

    return [
      ...normalizeCommercialTermsToClauses({
        id: charterPartyId,
        laytimeAllowed: dto.laytimeAllowed ?? null,
        demurrageRate: dto.demurrageRate ?? null,
        dispatchRate: dto.dispatchRate ?? null,
        timeCountingBasis: dto.timeCountingBasis ?? null,
        shexCalendar: dto.shexCalendar ?? null,
        norNoticePeriod: dto.norNoticePeriod ?? null,
      }).map((clause) => ({
        charterPartyId,
        clauseType: clause.clauseType,
        rawText: clause.rawText,
        parameters: clause.parameters,
      })),
      ...this.buildOperationSpecificClauses(
        dto.loadingTerms,
        charterPartyId,
        'Loading',
      ),
      ...this.buildOperationSpecificClauses(
        dto.dischargeTerms,
        charterPartyId,
        'Discharge',
      ),
      ...(dto.reversibleLaytime?.enabled === true
        ? [
            {
              charterPartyId,
              clauseType: 'reversible_laytime',
              rawText: 'Reversible laytime: enabled (V1 sum operation allowances)',
              parameters: {
                enabled: true,
                settlementVersion: 1,
                allowanceMode: 'sum_operation_allowances',
              },
            },
          ]
        : []),
    ];
  }

  private buildOperationSpecificClauses(
    terms: CreateVoyageCommercialTermsDto | undefined,
    charterPartyId: string,
    operation: 'Loading' | 'Discharge',
  ): Array<
    Pick<CpClause, 'charterPartyId' | 'clauseType' | 'rawText' | 'parameters'>
  > {
    const clauses: Array<
      Pick<CpClause, 'charterPartyId' | 'clauseType' | 'rawText' | 'parameters'>
    > = [];

    if (!terms) {
      return clauses;
    }

    const noticeHours = parseNoticeHours(terms.norNoticePeriod);

    if (terms.laytimeAllowed !== undefined) {
      const parameters: Record<string, unknown> = {
        hours: terms.laytimeAllowed,
        operation,
      };

      if (noticeHours !== undefined) {
        parameters.noticeHours = noticeHours;
      }

      clauses.push({
        charterPartyId,
        clauseType: 'laytime_rate',
        rawText: [
          `${operation} laytime allowed: ${terms.laytimeAllowed}h`,
          noticeHours !== undefined
            ? `NOR notice: ${terms.norNoticePeriod}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        parameters,
      });
    }

    if (terms.demurrageRate !== undefined) {
      clauses.push({
        charterPartyId,
        clauseType: 'demurrage_rate',
        rawText: `${operation} demurrage: $${terms.demurrageRate.toLocaleString()}/day`,
        parameters: {
          rate: terms.demurrageRate,
          operation,
        },
      });
    }

    if (terms.dispatchRate !== undefined) {
      clauses.push({
        charterPartyId,
        clauseType: 'despatch',
        rawText: `${operation} despatch: $${terms.dispatchRate.toLocaleString()}/day`,
        parameters: {
          rate: terms.dispatchRate,
          operation,
        },
      });
    }

    const basis = terms.timeCountingBasis?.trim().toUpperCase();
    this.assertShexCalendarInitialization(
      terms.timeCountingBasis,
      terms.shexCalendar,
      `${operation} terms`,
    );

    if (basis === 'SHEX' || basis === 'SHINC') {
      clauses.push({
        charterPartyId,
        clauseType: 'shex_shinc',
        rawText: `${operation} time counting basis: ${basis}`,
        parameters: {
          shex: basis === 'SHEX',
          ...(basis === 'SHEX' && terms.shexCalendar
            ? {
                calendarVersion: terms.shexCalendar.calendarVersion,
                timeZone: terms.shexCalendar.timeZone,
                holidayDates: [...terms.shexCalendar.holidayDates],
                saturdayExcepted: terms.shexCalendar.saturdayExcepted,
              }
            : {}),
          operation,
        },
      });
    }

    for (const [clauseType, enabled] of [
      ['weather_working', terms.weatherWorking],
      ['wibon', terms.wibon],
      ['wipon', terms.wipon],
    ] as const) {
      if (enabled === undefined) {
        continue;
      }

      clauses.push({
        charterPartyId,
        clauseType,
        rawText: `${operation} ${clauseType.replace(/_/g, ' ')}: ${enabled ? 'enabled' : 'disabled'}`,
        parameters: {
          enabled,
          operation,
        },
      });
    }

    return clauses;
  }

  private hasOperationCommercialTerms(
    terms?: CreateVoyageCommercialTermsDto | null,
  ): boolean {
    if (!terms) {
      return false;
    }

    return (
      terms.laytimeAllowed !== undefined ||
      terms.demurrageRate !== undefined ||
      terms.dispatchRate !== undefined ||
      (terms.timeCountingBasis !== undefined &&
        terms.timeCountingBasis.trim() !== '') ||
      terms.shexCalendar !== undefined ||
      (terms.norNoticePeriod !== undefined &&
        terms.norNoticePeriod.trim() !== '') ||
      terms.weatherWorking !== undefined ||
      terms.wibon !== undefined ||
      terms.wipon !== undefined
    );
  }

  private assertShexCalendarInitialization(
    timeCountingBasis: string | undefined,
    shexCalendar: CreateVoyageCommercialTermsDto['shexCalendar'],
    label: string,
  ): void {
    const basis = timeCountingBasis?.trim().toUpperCase();

    if (basis !== 'SHEX') {
      if (shexCalendar !== undefined) {
        throw new BadRequestException(
          `${label}: SHEX calendar fields require a SHEX time counting basis`,
        );
      }
      return;
    }

    if (!shexCalendar) {
      throw new BadRequestException(
        `${label}: new SHEX terms require calendarVersion, timeZone, holidayDates, and saturdayExcepted`,
      );
    }

    try {
      resolveShexCalendarContract({
        shex: true,
        calendarVersion: shexCalendar.calendarVersion,
        timeZone: shexCalendar.timeZone,
        holidayDates: shexCalendar.holidayDates,
        saturdayExcepted: shexCalendar.saturdayExcepted,
      });
    } catch (error) {
      if (error instanceof ShexCalendarError) {
        throw new BadRequestException(`${label}: ${error.message}`);
      }
      throw error;
    }
  }

  private buildOperationTermsSummary(
    label: string,
    terms?: CreateVoyageCommercialTermsDto,
  ): string | null {
    if (!terms || !this.hasOperationCommercialTerms(terms)) {
      return null;
    }

    const lines = [
      `${label}:`,
      terms.laytimeAllowed !== undefined
        ? `  Laytime allowed: ${terms.laytimeAllowed}h`
        : null,
      terms.demurrageRate !== undefined
        ? `  Demurrage: $${terms.demurrageRate.toLocaleString()}/day`
        : null,
      terms.dispatchRate !== undefined
        ? `  Despatch: $${terms.dispatchRate.toLocaleString()}/day`
        : null,
      terms.timeCountingBasis?.trim()
        ? `  Basis: ${terms.timeCountingBasis}`
        : null,
      terms.norNoticePeriod?.trim()
        ? `  NOR notice: ${terms.norNoticePeriod}`
        : null,
      terms.weatherWorking !== undefined
        ? `  Weather working: ${terms.weatherWorking ? 'Enabled' : 'Disabled'}`
        : null,
      terms.wibon !== undefined
        ? `  WIBON: ${terms.wibon ? 'Enabled' : 'Disabled'}`
        : null,
      terms.wipon !== undefined
        ? `  WIPON: ${terms.wipon ? 'Enabled' : 'Disabled'}`
        : null,
    ].filter(Boolean);

    return lines.length > 1 ? lines.join('\n') : null;
  }

  private async attachVoyageCounterparty(
    manager: EntityManager,
    voyageId: string,
    name?: string,
    role?: (typeof VOYAGE_COUNTERPARTY_ROLES)[number],
  ): Promise<void> {
    const trimmedName = name?.trim();
    const organizationId = this.tenantContext.getOrganizationId();

    if (!trimmedName || !role) {
      return;
    }

    const existing = await manager.findOne(Counterparty, {
      where: {
        organizationId,
        name: trimmedName,
      },
      select: { id: true },
    });

    const counterparty =
      existing ??
      (await manager.save(
        Counterparty,
        manager.create(Counterparty, {
          organizationId,
          name: trimmedName,
          type: 'charterer',
        }),
      ));

    await manager.save(
      VoyageCounterparty,
      manager.create(VoyageCounterparty, {
        voyageId,
        counterpartyId: counterparty.id,
        role,
      }),
    );
  }
}
