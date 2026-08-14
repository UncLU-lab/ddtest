import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { Counterparty } from '../entities/counterparty.entity';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { ListCounterpartiesQueryDto } from './dto/list-counterparties-query.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@Injectable()
export class CounterpartiesService {
  constructor(
    @InjectRepository(Counterparty)
    private readonly counterparties: Repository<Counterparty>,
  ) {}

  async findAll(
    query: ListCounterpartiesQueryDto,
  ): Promise<Paginated<Counterparty>> {
    const builder = this.counterparties
      .createQueryBuilder('counterparty')
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
    const counterparty = await this.counterparties.findOne({ where: { id } });

    if (!counterparty) {
      throw new NotFoundException(`Counterparty ${id} not found`);
    }

    return counterparty;
  }

  create(dto: CreateCounterpartyDto): Promise<Counterparty> {
    return this.counterparties.save(this.counterparties.create(dto));
  }

  async update(id: string, dto: UpdateCounterpartyDto): Promise<Counterparty> {
    const counterparty = await this.findOne(id);

    return this.counterparties.save(
      this.counterparties.merge(counterparty, dto),
    );
  }
}
