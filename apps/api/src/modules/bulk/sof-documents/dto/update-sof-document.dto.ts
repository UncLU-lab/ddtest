import { PartialType } from '@nestjs/mapped-types';
import { CreateSofDocumentDto } from './create-sof-document.dto';

export class UpdateSofDocumentDto extends PartialType(CreateSofDocumentDto) {}
