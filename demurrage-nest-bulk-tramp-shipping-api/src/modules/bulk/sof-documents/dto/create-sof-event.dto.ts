import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSofEventDto {
  @IsDateString({ strict: true })
  eventTime!: string;

  /** e.g. `NOR_TENDERED`, `RAIN_STOPPAGE`, `CARGO_COMPLETED`. */
  @IsString()
  @MaxLength(50)
  eventType!: string;

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
