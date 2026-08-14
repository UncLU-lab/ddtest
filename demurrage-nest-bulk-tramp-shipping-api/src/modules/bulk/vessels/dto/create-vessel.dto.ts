import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateVesselDto {
  @Matches(/^\d{7}$/, { message: 'imo must be a 7-digit IMO number' })
  imo!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  flag!: string;

  @IsString()
  @MaxLength(50)
  type!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  dwt!: number;
}
