import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { Counterparty } from '../entities/counterparty.entity';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { ListCounterpartiesQueryDto } from './dto/list-counterparties-query.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@Injectable()
export class CounterpartiesService {
  constructor(
    @InjectRepository(Counterparty)
    private readonly counterparties: Repository<Counterparty>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(
    query: ListCounterpartiesQueryDto,
  ): Promise<Paginated<Counterparty>> {
    const organizationId = this.tenantContext.getOrganizationId();
    const builder = this.counterparties
      .createQueryBuilder('counterparty')
      .andWhere('counterparty.organizationId = :organizationId', {
        organizationId,
      })
      .orderBy('counterparty.name', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    if (query.search) {
      builder.andWhere('counterparty.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.type) {
      builder.andWhere('counterparty.type = :type', { type: query.type });
    }

    return paginate(await builder.getManyAndCount(), query);
  }

  async findOne(id: string): Promise<Counterparty> {
    const organizationId = this.tenantContext.getOrganizationId();
    const counterparty = await this.counterparties.findOne({
      where: {
        id,
        organizationId,
      },
    });

    if (!counterparty || counterparty.organizationId !== organizationId) {
      throw new NotFoundException(`Counterparty ${id} not found`);
    }

    return counterparty;
  }

  create(dto: CreateCounterpartyDto): Promise<Counterparty> {
    return this.counterparties.save(
      this.counterparties.create({
        ...dto,
        organizationId: this.tenantContext.getOrganizationId(),
      }),
    );
  }

  async update(id: string, dto: UpdateCounterpartyDto): Promise<Counterparty> {
    const counterparty = await this.findOne(id);

    return this.counterparties.save(
      this.counterparties.merge(counterparty, dto),
    );
  }
}
