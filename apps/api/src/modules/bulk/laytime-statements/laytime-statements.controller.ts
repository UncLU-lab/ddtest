import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { LaytimeStatement } from '../entities/laytime-statement.entity';
import { CreateLaytimeStatementDto } from './dto/create-laytime-statement.dto';
import { LaytimeStatementsService } from './laytime-statements.service';

@Controller()
export class LaytimeStatementsController {
  constructor(private readonly statements: LaytimeStatementsService) {}

  @Post('laytime-statements')
  create(@Body() dto: CreateLaytimeStatementDto): Promise<LaytimeStatement> {
    return this.statements.create(dto.calculationId);
  }

  @Get('voyages/:voyageId/laytime-statements')
  findForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
  ): Promise<LaytimeStatement[]> {
    return this.statements.findForVoyage(voyageId);
  }

  @Get('laytime-statements/:statementId')
  findOne(
    @Param('statementId', ParseUUIDPipe) statementId: string,
  ): Promise<LaytimeStatement> {
    return this.statements.findOne(statementId);
  }
}
