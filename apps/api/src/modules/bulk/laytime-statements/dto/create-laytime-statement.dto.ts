import { IsUUID } from 'class-validator';

export class CreateLaytimeStatementDto {
  @IsUUID()
  calculationId!: string;
}
