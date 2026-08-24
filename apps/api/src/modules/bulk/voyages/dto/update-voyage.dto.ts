import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateVoyageDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cargoQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargoType?: string;

  @IsOptional()
  @IsString()
  @Length(5, 10)
  dischargePort?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  eta?: string;
}
