import { IsString, MaxLength, MinLength } from 'class-validator';

/** Source is deliberately request-only: contract text is never persisted by V1. */
export class ParseContractTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200_000)
  sourceText!: string;
}
