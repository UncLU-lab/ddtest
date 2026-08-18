import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import {
  BULK_DISPUTE_TYPES,
  DISPUTE_STATUSES,
} from '../../entities/dispute-case-bulk.entity';
import type {
  BulkDisputeType,
  DisputeStatus,
} from '../../entities/dispute-case-bulk.entity';

export class CreateBulkDisputeDto {
  @IsUUID()
  voyageId!: string;

  @IsIn(BULK_DISPUTE_TYPES)
  type!: BulkDisputeType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountDisputed!: number;

  @IsOptional()
  @IsIn(DISPUTE_STATUSES)
  status?: DisputeStatus;
}
