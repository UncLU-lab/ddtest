import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import {
  CalculationResult,
  CalculationAuditResponse,
  LaytimeCalculationsService,
} from './laytime-calculations.service';

@Controller()
export class LaytimeCalculationsController {
  constructor(
    private readonly calculationsService: LaytimeCalculationsService,
  ) {}

  @Get('voyages/:voyageId/laytime-calculations')
  findForVoyage(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<LaytimeCalculation>> {
    return this.calculationsService.findForVoyage(voyageId, query);
  }

  @Post('voyages/:voyageId/laytime-calculations')
  calculate(
    @Param('voyageId', ParseUUIDPipe) voyageId: string,
  ): Promise<CalculationResult> {
    return this.calculationsService.calculate(voyageId);
  }

  @Get('laytime-calculations/:calculationId')
  findOne(
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
  ): Promise<LaytimeCalculation> {
    return this.calculationsService.findOne(calculationId);
  }

  @Get('laytime-calculations/:calculationId/audit')
  getAudit(
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
  ): Promise<CalculationAuditResponse> {
    return this.calculationsService.getAudit(calculationId);
  }

  @Get('laytime-calculations/:calculationId/periods')
  findPeriods(
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<CalculationPeriod>> {
    return this.calculationsService.findPeriods(calculationId, query);
  }

  @Post('laytime-calculations/:calculationId/finalize')
  @HttpCode(HttpStatus.OK)
  finalize(
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
  ): Promise<LaytimeCalculation> {
    return this.calculationsService.finalize(calculationId);
  }
}
