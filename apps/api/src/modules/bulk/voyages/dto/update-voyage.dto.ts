import { PartialType } from '@nestjs/mapped-types';
import { CreateVoyageDto } from './create-voyage.dto';

export class UpdateVoyageDto extends PartialType(CreateVoyageDto) {}
