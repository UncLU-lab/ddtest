import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { CharterParty } from '../entities/charter-party.entity';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { Vessel } from '../entities/vessel.entity';
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
    @InjectRepository(CharterParty)
    private readonly charterParties: Repository<CharterParty>,
    @InjectRepository(SofDocument)
    private readonly sofDocuments: Repository<SofDocument>,
    @InjectRepository(NorDocument)
    private readonly norDocuments: Repository<NorDocument>,
    @InjectRepository(LaytimeCalculation)
    private readonly laytimeCalculations: Repository<LaytimeCalculation>,
    @InjectRepository(DisputeCaseBulk)
    private readonly disputes: Repository<DisputeCaseBulk>,
  ) {}

  async findAll(query: ListVoyagesQueryDto): Promise<Paginated<Voyage>> {
    const builder = this.voyages
      .createQueryBuilder('voyage')
      .leftJoinAndSelect('voyage.vessel', 'vessel')
      .orderBy('voyage.laycanStart', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) {
      builder.andWhere('voyage.status = :status', { status: query.status });
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
      relations: { vessel: true },
    });

    if (!voyage) {
      throw new NotFoundException(`Voyage ${id} not found`);
    }

    return voyage;
  }

  /** Loads a voyage without relations; used by sub-resource services to validate the parent. */
  async ensureExists(id: string): Promise<Voyage> {
    const voyage = await this.voyages.findOne({ where: { id } });

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
      throw new NotFoundException(`Vessel ${dto.vesselId} not found`);
    }

    this.assertLaycanOrder(dto.laycanStart, dto.laycanEnd);

    const voyage = this.voyages.create({
      ...dto,
      cargoQuantity: dto.cargoQuantity.toFixed(2),
    });

    return this.voyages.save(voyage);
  }

  async update(id: string, dto: UpdateVoyageDto): Promise<Voyage> {
    const voyage = await this.findOne(id);

    if (dto.vesselId && dto.vesselId !== voyage.vesselId) {
      const vessel = await this.vessels.findOne({
        where: { id: dto.vesselId },
        select: { id: true },
      });
      if (!vessel) {
        throw new NotFoundException(`Vessel ${dto.vesselId} not found`);
      }
    }

    this.assertLaycanOrder(
      dto.laycanStart ?? voyage.laycanStart,
      dto.laycanEnd ?? voyage.laycanEnd,
    );

    const { cargoQuantity, ...rest } = dto;
    this.voyages.merge(voyage, rest);
    if (cargoQuantity !== undefined) {
      voyage.cargoQuantity = cargoQuantity.toFixed(2);
    }

    return this.voyages.save(voyage);
  }

  /**
   * The voyage plus everything a case handler needs at a glance: documents,
   * the latest laytime result, open disputes, and derived risk indicators.
   */
  async findSummary(id: string): Promise<VoyageSummary> {
    const voyage = await this.findOne(id);

    const [
      charterParty,
      sofDocuments,
      norDocuments,
      latestCalculation,
      disputes,
    ] = await Promise.all([
      this.charterParties.findOne({
        where: { voyageId: id },
        relations: { clauses: true },
      }),
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
      charterParty,
      sofDocuments,
      norDocuments,
      latestCalculation,
      disputes,
    });
  }

  private assertLaycanOrder(start: string, end: string): void {
    if (new Date(end) < new Date(start)) {
      throw new BadRequestException('laycanEnd must not precede laycanStart');
    }
  }
}
