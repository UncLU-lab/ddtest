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
import { Voyage } from '../entities/voyage.entity';
import { CreateVoyageDto } from './dto/create-voyage.dto';
import { ListVoyagesQueryDto } from './dto/list-voyages-query.dto';
import { UpdateVoyageDto } from './dto/update-voyage.dto';
import { VoyageSummary } from './voyage-summary';
import { VoyagesService } from './voyages.service';

@Controller('voyages')
export class VoyagesController {
  constructor(private readonly voyagesService: VoyagesService) {}

  @Get()
  findAll(@Query() query: ListVoyagesQueryDto): Promise<Paginated<Voyage>> {
    return this.voyagesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateVoyageDto): Promise<Voyage> {
    return this.voyagesService.create(dto);
  }

  @Get(':voyageId')
  findOne(@Param('voyageId', ParseUUIDPipe) voyageId: string): Promise<Voyage> {
    return this.voyagesService.findOne(voyageId);
  }

  @Patch(':voyageId')
  update(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Body() dto: UpdateVoyageDto,
  ): Promise<Voyage> {
    return this.voyagesService.update(voyageId, dto);
  }

  @Get(':voyageId/summary')
  findSummary(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
  ): Promise<VoyageSummary> {
    return this.voyagesService.findSummary(voyageId);
  }
}
