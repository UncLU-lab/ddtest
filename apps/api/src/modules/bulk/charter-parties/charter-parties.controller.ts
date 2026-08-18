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
import { CharterParty } from '../entities/charter-party.entity';
import { CpClause } from '../entities/cp-clause.entity';
import { CharterPartiesService } from './charter-parties.service';
import { CreateCharterPartyDto } from './dto/create-charter-party.dto';
import { CreateCpClauseDto } from './dto/create-cp-clause.dto';
import { UpdateCharterPartyDto } from './dto/update-charter-party.dto';
import { UpdateCpClauseDto } from './dto/update-cp-clause.dto';

@Controller()
export class CharterPartiesController {
  constructor(private readonly charterPartiesService: CharterPartiesService) {}

  @Get('voyages/:voyageId/charter-party')
  findForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
  ): Promise<CharterParty> {
    return this.charterPartiesService.findForVoyage(voyageId);
  }

  @Post('voyages/:voyageId/charter-party')
  createForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Body() dto: CreateCharterPartyDto,
  ): Promise<CharterParty> {
    return this.charterPartiesService.createForVoyage(voyageId, dto);
  }

  @Get('charter-parties/:charterPartyId')
  findOne(
    @Param('charterPartyId', ParseUUIDPipe) charterPartyId: string,
  ): Promise<CharterParty> {
    return this.charterPartiesService.findOne(charterPartyId);
  }

  @Patch('charter-parties/:charterPartyId')
  update(
    @Param('charterPartyId', ParseUUIDPipe) charterPartyId: string,
    @Body() dto: UpdateCharterPartyDto,
  ): Promise<CharterParty> {
    return this.charterPartiesService.update(charterPartyId, dto);
  }

  @Get('charter-parties/:charterPartyId/clauses')
  findClauses(
    @Param('charterPartyId', ParseUUIDPipe) charterPartyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<CpClause>> {
    return this.charterPartiesService.findClauses(charterPartyId, query);
  }

  @Post('charter-parties/:charterPartyId/clauses')
  addClause(
    @Param('charterPartyId', ParseUUIDPipe) charterPartyId: string,
    @Body() dto: CreateCpClauseDto,
  ): Promise<CpClause> {
    return this.charterPartiesService.addClause(charterPartyId, dto);
  }

  @Patch('cp-clauses/:clauseId')
  updateClause(
    @Param('clauseId', ParseUUIDPipe) clauseId: string,
    @Body() dto: UpdateCpClauseDto,
  ): Promise<CpClause> {
    return this.charterPartiesService.updateClause(clauseId, dto);
  }

  @Delete('cp-clauses/:clauseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeClause(
    @Param('clauseId', ParseUUIDPipe) clauseId: string,
  ): Promise<void> {
    return this.charterPartiesService.removeClause(clauseId);
  }
}
