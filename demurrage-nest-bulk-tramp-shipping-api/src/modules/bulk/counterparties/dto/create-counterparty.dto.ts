import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { COUNTERPARTY_TYPES } from '../../entities/counterparty.entity';
import type { CounterpartyType } from '../../entities/counterparty.entity';

export class CreateCounterpartyDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(COUNTERPARTY_TYPES)
  type!: CounterpartyType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  imoCompanyId?: string;
}
