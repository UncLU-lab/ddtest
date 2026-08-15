import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCpClauseDto {
  /** e.g. `laytime_rate`, `shex_shinc`, `wibon`, `demurrage_rate`, `despatch`. */
  @IsString()
  @MaxLength(50)
  clauseType!: string;

  @IsString()
  @MinLength(1)
  rawText!: string;

  /** Structured representation, e.g. `{ "rate": 10000, "unit": "MT", "shex": true }`. */
  @IsObject()
  parameters!: Record<string, unknown>;
}
