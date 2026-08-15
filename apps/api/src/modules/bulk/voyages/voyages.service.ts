import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { CreateVoyageDto } from './dto/create-voyage.dto';
import { ListVoyagesQueryDto } from './dto/list-voyages-query.dto';
import { UpdateVoyageDto } from './dto/update-voyage.dto';
import { VoyageSummary, buildVoyageSummary } from './voyage-summary';

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

    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: ListVoyagesQueryDto): Promise<Paginated<Voyage>> {
    const builder = this.voyages
      .createQueryBuilder('voyage')
      .leftJoinAndSelect('voyage.vessel', 'vessel')
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

    return paginate(await builder.getManyAndCount(), query);
  }

  async findOne(id: string): Promise<Voyage> {
    const voyage = await this.voyages.findOne({
      where: { id },
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

    if (!voyage) {
      throw new NotFoundException(`Voyage ${id} not found`);
    }

    return voyage;
  }

  /**
   * Loads a voyage without relations.
   * Used by sub-resource services to validate the parent voyage.
   */
  async ensureExists(id: string): Promise<Voyage> {
    const voyage = await this.voyages.findOne({
      where: { id },
    });

    if (!voyage) {
      throw new NotFoundException(`Voyage ${id} not found`);
    }

    return voyage;
  }

  async create(dto: CreateVoyageDto): Promise<Voyage> {
    const vessel = await this.vessels.findOne({
      where: { id: dto.vesselId },
      select: { id: true },
    });

    if (!vessel) {
      throw new NotFoundException(
        `Vessel ${dto.vesselId} not found`,
      );
    }

    this.assertLaycanOrder(
      dto.laycanStart,
      dto.laycanEnd,
    );

    /*
     * The database requires a non-null voyage reference.
     * Prefer the user-entered value when present; otherwise generate one.
     */
    const reference =
      dto.reference?.trim() ||
      (await this.generateVoyageReference());
    const {
      supplier,
      receiver,
      laytimeAllowed,
      demurrageRate,
      dispatchRate,
      timeCountingBasis,
      norNoticePeriod,
      ...voyageDto
    } = dto;

    const voyage = await this.dataSource.transaction(async (manager) => {
      const savedVoyage = await manager.save(
        manager.create(Voyage, {
          ...voyageDto,
          eta: voyageDto.eta ? new Date(voyageDto.eta) : null,
          reference,
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
            fullText: this.buildCharterPartySummary(dto),
            effectiveDate: voyageDto.laycanStart.slice(0, 10),
            laytimeAllowed: laytimeAllowed ?? null,
            demurrageRate:
              demurrageRate !== undefined
                ? demurrageRate.toFixed(2)
                : null,
            dispatchRate:
              dispatchRate !== undefined
                ? dispatchRate.toFixed(2)
                : null,
            timeCountingBasis: timeCountingBasis ?? null,
            norNoticePeriod: norNoticePeriod ?? null,
          }),
        );

        for (const clause of this.buildCommercialClauses(
          dto,
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

  async update(
    id: string,
    dto: UpdateVoyageDto,
  ): Promise<Voyage> {
    const voyage = await this.findOne(id);

    if (
      dto.vesselId &&
      dto.vesselId !== voyage.vesselId
    ) {
      const vessel = await this.vessels.findOne({
        where: { id: dto.vesselId },
        select: { id: true },
      });

      if (!vessel) {
        throw new NotFoundException(
          `Vessel ${dto.vesselId} not found`,
        );
      }
    }

    this.assertLaycanOrder(
      dto.laycanStart ?? voyage.laycanStart,
      dto.laycanEnd ?? voyage.laycanEnd,
    );

    const {
      cargoQuantity,
      supplier: _supplier,
      receiver: _receiver,
      laytimeAllowed: _laytimeAllowed,
      demurrageRate: _demurrageRate,
      dispatchRate: _dispatchRate,
      timeCountingBasis: _timeCountingBasis,
      norNoticePeriod: _norNoticePeriod,
      ...rest
    } = dto;

    this.voyages.merge(voyage, rest as Partial<Voyage>);

    if (cargoQuantity !== undefined) {
      voyage.cargoQuantity = cargoQuantity.toFixed(2);
    }

    return this.voyages.save(voyage);
  }

  /**
   * The voyage plus everything a case handler needs at a glance:
   * documents, latest laytime result, disputes and derived risk indicators.
   */
  async findSummary(id: string): Promise<VoyageSummary> {
    const voyage = await this.findOne(id);

    const [
      sofDocuments,
      norDocuments,
      latestCalculation,
      disputes,
    ] = await Promise.all([
      this.sofDocuments.find({
        where: { voyageId: id },
        order: { uploadDate: 'DESC' },
      }),

      this.norDocuments.find({
        where: { voyageId: id },
        order: { tenderTime: 'ASC' },
      }),

      this.laytimeCalculations.findOne({
        where: { voyageId: id },
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
    const date = new Date();

    const year = date.getUTCFullYear();
    const month = String(
      date.getUTCMonth() + 1,
    ).padStart(2, '0');
    const day = String(
      date.getUTCDate(),
    ).padStart(2, '0');

    const prefix = `VOY-${year}${month}${day}`;

    const latestVoyage = await this.voyages
      .createQueryBuilder('voyage')
      .where('voyage.reference LIKE :prefix', {
        prefix: `${prefix}-%`,
      })
      .orderBy('voyage.reference', 'DESC')
      .getOne();

    let sequence = 1;

    if (latestVoyage?.reference) {
      const match = latestVoyage.reference.match(
        /-(\d+)$/,
      );

      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
  }

  private assertLaycanOrder(
    start: string,
    end: string,
  ): void {
    if (new Date(end) < new Date(start)) {
      throw new BadRequestException(
        'laycanEnd must not precede laycanStart',
      );
    }
  }

  private hasCommercialTerms(dto: CreateVoyageDto): boolean {
    return Boolean(
      dto.laytimeAllowed !== undefined ||
        dto.demurrageRate !== undefined ||
        dto.dispatchRate !== undefined ||
        dto.timeCountingBasis?.trim() ||
        dto.norNoticePeriod?.trim(),
    );
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
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildCommercialClauses(
    dto: CreateVoyageDto,
    charterPartyId: string,
  ): Array<Pick<CpClause, 'charterPartyId' | 'clauseType' | 'rawText' | 'parameters'>> {
    const clauses: Array<
      Pick<CpClause, 'charterPartyId' | 'clauseType' | 'rawText' | 'parameters'>
    > = [];

    if (dto.laytimeAllowed !== undefined) {
      const parameters: Record<string, unknown> = {
        hours: dto.laytimeAllowed,
      };
      const noticeHours = this.parseNoticeHours(dto.norNoticePeriod);

      if (noticeHours !== undefined) {
        parameters.noticeHours = noticeHours;
      }

      clauses.push({
        charterPartyId,
        clauseType: 'laytime_rate',
        rawText: [
          `Laytime allowed: ${dto.laytimeAllowed}h`,
          noticeHours !== undefined
            ? `NOR notice: ${dto.norNoticePeriod}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        parameters,
      });
    }

    if (dto.demurrageRate !== undefined) {
      clauses.push({
        charterPartyId,
        clauseType: 'demurrage_rate',
        rawText: `Demurrage: $${dto.demurrageRate.toLocaleString()}/day`,
        parameters: { rate: dto.demurrageRate },
      });
    }

    if (dto.dispatchRate !== undefined) {
      clauses.push({
        charterPartyId,
        clauseType: 'despatch',
        rawText: `Dispatch: $${dto.dispatchRate.toLocaleString()}/day`,
        parameters: { rate: dto.dispatchRate },
      });
    }

    if (dto.timeCountingBasis?.trim().toUpperCase() === 'SHEX') {
      clauses.push({
        charterPartyId,
        clauseType: 'shex_shinc',
        rawText: `Time counting basis: ${dto.timeCountingBasis}`,
        parameters: { shex: true },
      });
    }

    return clauses;
  }

  private parseNoticeHours(value?: string): number | undefined {
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

  private async attachVoyageCounterparty(
    manager: EntityManager,
    voyageId: string,
    name?: string,
    role?: (typeof VOYAGE_COUNTERPARTY_ROLES)[number],
  ): Promise<void> {
    const trimmedName = name?.trim();

    if (!trimmedName || !role) {
      return;
    }

    const existing = await manager.findOne(Counterparty, {
      where: {
        organizationId: '00000000-0000-0000-0000-000000000001',
        name: trimmedName,
      },
      select: { id: true },
    });

    const counterparty =
      existing ??
      (await manager.save(
        Counterparty,
        manager.create(Counterparty, {
          organizationId: '00000000-0000-0000-0000-000000000001',
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
