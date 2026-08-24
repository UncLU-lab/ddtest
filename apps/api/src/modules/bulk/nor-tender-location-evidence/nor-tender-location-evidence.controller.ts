import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../../common/dto/paginated';
import { NorTenderLocationEvidence } from '../entities/nor-tender-location-evidence.entity';
import { CreateNorTenderLocationEvidenceDto } from './dto/create-nor-tender-location-evidence.dto';
import { FindNorTenderLocationEvidenceQueryDto } from './dto/find-nor-tender-location-evidence-query.dto';
import { NorTenderLocationEvidenceService } from './nor-tender-location-evidence.service';

@Controller('voyages/:voyageId/nor-tender-location-evidence')
export class NorTenderLocationEvidenceController {
  constructor(
    private readonly locationEvidenceService: NorTenderLocationEvidenceService,
  ) {}

  @Get()
  findForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Query() query: FindNorTenderLocationEvidenceQueryDto,
  ): Promise<Paginated<NorTenderLocationEvidence>> {
    return this.locationEvidenceService.findForVoyage(voyageId, query);
  }

  @Post()
  createForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Body() dto: CreateNorTenderLocationEvidenceDto,
  ): Promise<NorTenderLocationEvidence> {
    return this.locationEvidenceService.createForVoyage(voyageId, dto);
  }
}
