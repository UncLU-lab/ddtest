import { IsIn, IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_COMMERCIAL_CLAUSE_TYPES } from '../../charter-party-terms';
import { IsCpClauseParameters } from './cp-clause-parameters.validator';

export class CreateCpClauseDto {
  /** e.g. `laytime_rate`, `shex_shinc`, `wibon`, `demurrage_rate`, `despatch`. */
  @IsString()
  @IsIn(SUPPORTED_COMMERCIAL_CLAUSE_TYPES)
  @MaxLength(50)
  clauseType!: string;

  @IsString()
  @MinLength(1)
  rawText!: string;

  /** Structured representation, e.g. `{ "rate": 10000, "unit": "MT", "shex": true }`. */
  @IsObject()
  @IsCpClauseParameters()
  parameters!: Record<string, unknown>;
}
