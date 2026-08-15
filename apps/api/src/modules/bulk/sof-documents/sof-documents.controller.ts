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
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { CreateSofDocumentDto } from './dto/create-sof-document.dto';
import { CreateSofEventDto } from './dto/create-sof-event.dto';
import { UpdateSofDocumentDto } from './dto/update-sof-document.dto';
import { UpdateSofEventDto } from './dto/update-sof-event.dto';
import { SofDocumentsService } from './sof-documents.service';

@Controller()
export class SofDocumentsController {
  constructor(private readonly sofDocumentsService: SofDocumentsService) {}

  @Get('voyages/:voyageId/sof-documents')
  findForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SofDocument>> {
    return this.sofDocumentsService.findForVoyage(voyageId, query);
  }

  @Post('voyages/:voyageId/sof-documents')
  createForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Body() dto: CreateSofDocumentDto,
  ): Promise<SofDocument> {
    return this.sofDocumentsService.createForVoyage(voyageId, dto);
  }

  @Get('sof-documents/:sofId')
  findOne(@Param('sofId', ParseUUIDPipe) sofId: string): Promise<SofDocument> {
    return this.sofDocumentsService.findOne(sofId);
  }

  @Patch('sof-documents/:sofId')
  update(
    @Param('sofId', ParseUUIDPipe) sofId: string,
    @Body() dto: UpdateSofDocumentDto,
  ): Promise<SofDocument> {
    return this.sofDocumentsService.update(sofId, dto);
  }

  @Get('sof-documents/:sofId/events')
  findEvents(
    @Param('sofId', ParseUUIDPipe) sofId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SofEvent>> {
    return this.sofDocumentsService.findEvents(sofId, query);
  }

  @Post('sof-documents/:sofId/events')
  addEvent(
    @Param('sofId', ParseUUIDPipe) sofId: string,
    @Body() dto: CreateSofEventDto,
  ): Promise<SofEvent> {
    return this.sofDocumentsService.addEvent(sofId, dto);
  }

  @Patch('sof-events/:eventId')
  updateEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateSofEventDto,
  ): Promise<SofEvent> {
    return this.sofDocumentsService.updateEvent(eventId, dto);
  }
}
