import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../../common/dto/paginated';
import { Counterparty } from '../entities/counterparty.entity';
import { CounterpartiesService } from './counterparties.service';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { ListCounterpartiesQueryDto } from './dto/list-counterparties-query.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@Controller('counterparties')
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Get()
  findAll(
    @Query() query: ListCounterpartiesQueryDto,
  ): Promise<Paginated<Counterparty>> {
    return this.counterpartiesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateCounterpartyDto): Promise<Counterparty> {
    return this.counterpartiesService.create(dto);
  }

  @Get(':counterpartyId')
  findOne(
    @Param('counterpartyId', ParseUUIDPipe) counterpartyId: string,
  ): Promise<Counterparty> {
    return this.counterpartiesService.findOne(counterpartyId);
  }

  @Patch(':counterpartyId')
  update(
    @Param('counterpartyId', ParseUUIDPipe) counterpartyId: string,
    @Body() dto: UpdateCounterpartyDto,
  ): Promise<Counterparty> {
    return this.counterpartiesService.update(counterpartyId, dto);
  }
}
