import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import {
  BULK_DISPUTE_TYPES,
  DISPUTE_STATUSES,
} from '../../entities/dispute-case-bulk.entity';
import type {
  BulkDisputeType,
  DisputeStatus,
} from '../../entities/dispute-case-bulk.entity';

export class ListBulkDisputesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  voyageId?: string;

  @IsOptional()
  @IsIn(DISPUTE_STATUSES)
  status?: DisputeStatus;

  @IsOptional()
  @IsIn(BULK_DISPUTE_TYPES)
  type?: BulkDisputeType;
}
