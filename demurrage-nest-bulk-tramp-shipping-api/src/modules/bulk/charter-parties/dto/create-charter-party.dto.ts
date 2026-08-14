import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCharterPartyDto {
  /** e.g. `GENCON 94`, `NORGRAIN`. */
  @IsString()
  @MaxLength(50)
  formType!: string;

  @IsString()
  @MinLength(1)
  fullText!: string;

  @IsDateString({ strict: true })
  effectiveDate!: string;
}
