import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BULK_OPERATION_TYPES, VOYAGE_STATUSES } from '../../entities/voyage.entity';
import type { BulkOperationType, VoyageStatus } from '../../entities/voyage.entity';

export class CreateVoyageShexCalendarDto {
  @Type(() => Number)
  @IsIn([1])
  calendarVersion!: 1;

  @IsString()
  @MaxLength(100)
  timeZone!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  holidayDates!: string[];

  @IsBoolean()
  saturdayExcepted!: boolean;
}

export class CreateVoyageCommercialTermsDto {
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
  @ValidateNested()
  @Type(() => CreateVoyageShexCalendarDto)
  shexCalendar?: CreateVoyageShexCalendarDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  norNoticePeriod?: string;

  @IsOptional()
  @IsBoolean()
  weatherWorking?: boolean;

  @IsOptional()
  @IsBoolean()
  wibon?: boolean;

  @IsOptional()
  @IsBoolean()
  wipon?: boolean;
}

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
  @ValidateNested()
  @Type(() => CreateVoyageShexCalendarDto)
  shexCalendar?: CreateVoyageShexCalendarDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  norNoticePeriod?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateVoyageCommercialTermsDto)
  loadingTerms?: CreateVoyageCommercialTermsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateVoyageCommercialTermsDto)
  dischargeTerms?: CreateVoyageCommercialTermsDto;

  @IsOptional()
  @IsIn(['Loading', 'Discharge'])
  laytimeOperation?: 'Loading' | 'Discharge';

  @IsOptional()
  @IsIn(BULK_OPERATION_TYPES)
  bulkOperationType?: BulkOperationType;

  @IsOptional()
  @IsIn(VOYAGE_STATUSES)
  status?: VoyageStatus;
}
