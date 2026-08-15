import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Vessel } from '../entities/vessel.entity';
import { Voyage } from '../entities/voyage.entity';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { ListVesselsQueryDto } from './dto/list-vessels-query.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import { VesselsService } from './vessels.service';

@Controller('vessels')
export class VesselsController {
  constructor(private readonly vesselsService: VesselsService) {}

  @Get()
  findAll(@Query() query: ListVesselsQueryDto): Promise<Paginated<Vessel>> {
    return this.vesselsService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateVesselDto): Promise<Vessel> {
    return this.vesselsService.create(dto);
  }

  @Get(':vesselId')
  findOne(@Param('vesselId', ParseUUIDPipe) vesselId: string): Promise<Vessel> {
    return this.vesselsService.findOne(vesselId);
  }

  @Patch(':vesselId')
  update(
    @Param('vesselId', ParseUUIDPipe) vesselId: string,
    @Body() dto: UpdateVesselDto,
  ): Promise<Vessel> {
    return this.vesselsService.update(vesselId, dto);
  }

  @Delete(':vesselId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('vesselId', ParseUUIDPipe) vesselId: string): Promise<void> {
    return this.vesselsService.remove(vesselId);
  }

  @Get(':vesselId/voyages')
  findVoyages(
    @Param('vesselId', ParseUUIDPipe) vesselId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<Voyage>> {
    return this.vesselsService.findVoyages(vesselId, query);
  }
}
