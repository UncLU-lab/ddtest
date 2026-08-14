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
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { BulkDisputesService } from './bulk-disputes.service';
import { CreateBulkDisputeDto } from './dto/create-bulk-dispute.dto';
import { ListBulkDisputesQueryDto } from './dto/list-bulk-disputes-query.dto';
import { UpdateBulkDisputeDto } from './dto/update-bulk-dispute.dto';

@Controller('bulk-disputes')
export class BulkDisputesController {
  constructor(private readonly disputesService: BulkDisputesService) {}

  @Get()
  findAll(
    @Query() query: ListBulkDisputesQueryDto,
  ): Promise<Paginated<DisputeCaseBulk>> {
    return this.disputesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateBulkDisputeDto): Promise<DisputeCaseBulk> {
    return this.disputesService.create(dto);
  }

  @Get(':disputeId')
  findOne(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
  ): Promise<DisputeCaseBulk> {
    return this.disputesService.findOne(disputeId);
  }

  @Patch(':disputeId')
  update(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: UpdateBulkDisputeDto,
  ): Promise<DisputeCaseBulk> {
    return this.disputesService.update(disputeId, dto);
  }
}
