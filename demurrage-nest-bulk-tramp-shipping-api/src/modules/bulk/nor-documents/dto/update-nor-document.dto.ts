import { PartialType } from '@nestjs/mapped-types';
import { CreateNorDocumentDto } from './create-nor-document.dto';

export class UpdateNorDocumentDto extends PartialType(CreateNorDocumentDto) {}
