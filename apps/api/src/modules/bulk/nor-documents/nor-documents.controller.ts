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
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { NorDocument } from '../entities/nor-document.entity';
import { CreateNorDocumentDto } from './dto/create-nor-document.dto';
import { UpdateNorDocumentDto } from './dto/update-nor-document.dto';
import { NorDocumentsService } from './nor-documents.service';

@Controller()
export class NorDocumentsController {
  constructor(private readonly norDocumentsService: NorDocumentsService) {}

  @Get('voyages/:voyageId/nor-documents')
  findForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<NorDocument>> {
    return this.norDocumentsService.findForVoyage(voyageId, query);
  }

  @Post('voyages/:voyageId/nor-documents')
  createForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Body() dto: CreateNorDocumentDto,
  ): Promise<NorDocument> {
    return this.norDocumentsService.createForVoyage(voyageId, dto);
  }

  @Patch('nor-documents/:norId')
  update(
    @Param('norId', ParseUUIDPipe) norId: string,
    @Body() dto: UpdateNorDocumentDto,
  ): Promise<NorDocument> {
    return this.norDocumentsService.update(norId, dto);
  }
}
