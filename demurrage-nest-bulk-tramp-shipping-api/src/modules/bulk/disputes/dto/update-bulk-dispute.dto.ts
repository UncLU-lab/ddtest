import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { DISPUTE_STATUSES } from '../../entities/dispute-case-bulk.entity';
import type { DisputeStatus } from '../../entities/dispute-case-bulk.entity';

/** The voyage and dispute type are fixed once a claim is opened. */
export class UpdateBulkDisputeDto {
  @IsOptional()
  @IsIn(DISPUTE_STATUSES)
  status?: DisputeStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountDisputed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  finalSettlementAmount?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  resolvedDate?: string;
}
