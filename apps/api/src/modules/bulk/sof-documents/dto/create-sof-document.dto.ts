import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  SOF_DOCUMENT_OPERATIONS,
  SOF_DOCUMENT_STATUSES,
  type SofDocumentOperation,
  type SofDocumentStatus,
} from '../../entities/sof-document.entity';

export class CreateSofDocumentDto {
  /** S3 object key for the uploaded Statement of Facts. */
  @IsString()
  @MaxLength(500)
  filePath!: string;

  @IsOptional()
  @IsIn(SOF_DOCUMENT_STATUSES)
  status?: SofDocumentStatus;

  @IsOptional()
  @IsIn(SOF_DOCUMENT_OPERATIONS)
  operation?: SofDocumentOperation;
}
