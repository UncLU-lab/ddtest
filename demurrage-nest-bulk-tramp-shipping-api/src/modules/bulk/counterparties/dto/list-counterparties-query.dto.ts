import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { COUNTERPARTY_TYPES } from '../../entities/counterparty.entity';
import type { CounterpartyType } from '../../entities/counterparty.entity';

export class ListCounterpartiesQueryDto extends PaginationQueryDto {
  /** Partial match on company name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(COUNTERPARTY_TYPES)
  type?: CounterpartyType;
}
