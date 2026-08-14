import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { VOYAGE_STATUSES } from '../../entities/voyage.entity';
import type { VoyageStatus } from '../../entities/voyage.entity';

export class ListVoyagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(VOYAGE_STATUSES)
  status?: VoyageStatus;

  @IsOptional()
  @IsUUID()
  vesselId?: string;

  @IsOptional()
  @IsString()
  @Length(5, 10)
  loadPort?: string;

  @IsOptional()
  @IsString()
  @Length(5, 10)
  dischargePort?: string;

  /** Voyages whose laycan window ends on or after this date. */
  @IsOptional()
  @IsDateString({ strict: true })
  laycanFrom?: string;

  /** Voyages whose laycan window starts on or before this date. */
  @IsOptional()
  @IsDateString({ strict: true })
  laycanTo?: string;
}
