import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  LAYTIME_OPERATION_SCOPES,
  type LaytimeOperationScope,
} from '../../entities/charter-party.entity';
import {
  SUPPORTED_SETTLEMENT_CURRENCIES,
  type SettlementCurrency,
} from '../../currency/settlement-currency';

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

  @IsOptional()
  @IsIn(LAYTIME_OPERATION_SCOPES)
  laytimeOperationScope?: LaytimeOperationScope;

  @IsOptional()
  @IsIn(SUPPORTED_SETTLEMENT_CURRENCIES)
  settlementCurrency?: SettlementCurrency;
}
