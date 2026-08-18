import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNorDocumentDto {
  @IsString()
  @MaxLength(500)
  filePath!: string;

  @IsDateString({ strict: true })
  tenderTime!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  acceptedTime?: string;
}
