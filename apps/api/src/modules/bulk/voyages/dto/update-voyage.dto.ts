import { PartialType } from '@nestjs/mapped-types';
import { CreateVoyageDto } from './create-voyage.dto';

// Inherits laytimeOperation and the rest of the create-voyage validation rules.
export class UpdateVoyageDto extends PartialType(CreateVoyageDto) {}
