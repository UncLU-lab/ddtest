import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { VOYAGE_STATUSES } from '../../entities/voyage.entity';
import type { VoyageStatus } from '../../entities/voyage.entity';

export class CreateVoyageDto {
  @IsUUID()
  vesselId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cargoQuantity!: number;

  @IsString()
  @MaxLength(100)
  cargoType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiver?: string;

  /** UN/LOCODE, e.g. `USNOL`. */
  @IsString()
  @Length(5, 10)
  loadPort!: string;

  @IsString()
  @Length(5, 10)
  dischargePort!: string;

  @IsDateString({ strict: true })
  laycanStart!: string;

  @IsDateString({ strict: true })
  laycanEnd!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  eta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laytimeAllowed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  demurrageRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dispatchRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  timeCountingBasis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  norNoticePeriod?: string;

  @IsOptional()
  @IsIn(['Loading', 'Discharge'])
  laytimeOperation?: 'Loading' | 'Discharge';

  @IsOptional()
  @IsIn(VOYAGE_STATUSES)
  status?: VoyageStatus;
}
