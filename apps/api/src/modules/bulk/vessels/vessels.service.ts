import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { Vessel } from '../entities/vessel.entity';
import { Voyage } from '../entities/voyage.entity';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { ListVesselsQueryDto } from './dto/list-vessels-query.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';

@Injectable()
export class VesselsService {
  constructor(
    @InjectRepository(Vessel)
    private readonly vessels: Repository<Vessel>,
    @InjectRepository(Voyage)
    private readonly voyages: Repository<Voyage>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: ListVesselsQueryDto): Promise<Paginated<Vessel>> {
    const organizationId = this.tenantContext.getOrganizationId();
    const builder = this.vessels
      .createQueryBuilder('vessel')
      .andWhere('vessel.organizationId = :organizationId', { organizationId })
      .orderBy('vessel.name', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    if (query.search) {
      builder.andWhere(
        '(vessel.name ILIKE :search OR vessel.imo ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.type) {
      builder.andWhere('vessel.type = :type', { type: query.type });
    }

    return paginate(await builder.getManyAndCount(), query);
  }

  async findOne(id: string): Promise<Vessel> {
    const organizationId = this.tenantContext.getOrganizationId();
    const vessel = await this.vessels.findOne({
      where: {
        id,
        organizationId,
      },
    });

    if (!vessel || vessel.organizationId !== organizationId) {
      throw new NotFoundException(`Vessel ${id} not found`);
    }

    return vessel;
  }

  async create(dto: CreateVesselDto): Promise<Vessel> {
    const organizationId = this.tenantContext.getOrganizationId();
    const existing = await this.vessels.findOne({
      where: { imo: dto.imo },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `A vessel with IMO ${dto.imo} already exists`,
      );
    }

    return this.vessels.save(this.vessels.create({ ...dto, organizationId }));
  }

  async update(id: string, dto: UpdateVesselDto): Promise<Vessel> {
    const vessel = await this.findOne(id);

    if (dto.imo && dto.imo !== vessel.imo) {
      const clash = await this.vessels.findOne({
        where: { imo: dto.imo },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          `A vessel with IMO ${dto.imo} already exists`,
        );
      }
    }

    return this.vessels.save(this.vessels.merge(vessel, dto));
  }

  async remove(id: string): Promise<void> {
    const vessel = await this.findOne(id);

    const voyageCount = await this.voyages.count({
      where: {
        vesselId: vessel.id,
        organizationId: this.tenantContext.getOrganizationId(),
      },
    });
    if (voyageCount > 0) {
      throw new ConflictException(
        `Vessel ${id} has ${voyageCount} voyage(s) and cannot be deleted`,
      );
    }

    await this.vessels.remove(vessel);
  }

  async findVoyages(
    id: string,
    query: { page: number; limit: number; skip: number },
  ): Promise<Paginated<Voyage>> {
    await this.findOne(id);

    const result = await this.voyages.findAndCount({
      where: {
        vesselId: id,
        organizationId: this.tenantContext.getOrganizationId(),
      },
      order: { laycanStart: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }
}
