import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SOF_EVENT_OPERATIONS, type SofEventOperation } from '../../entities/sof-event.entity';

export class CreateSofEventDto {
  @IsDateString({ strict: true })
  eventTime!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceTimeZone!: string;

  /** e.g. `NOR_TENDERED`, `RAIN_STOPPAGE`, `CARGO_COMPLETED`. */
  @IsString()
  @MaxLength(50)
  eventType!: string;

  @IsOptional()
  @IsIn(SOF_EVENT_OPERATIONS)
  operation?: SofEventOperation;

  @IsOptional()
  @IsString()
  remarks?: string;

  /** OCR confidence, 0.00–1.00. Omitted for manually entered events. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  confidenceScore?: number;
}
