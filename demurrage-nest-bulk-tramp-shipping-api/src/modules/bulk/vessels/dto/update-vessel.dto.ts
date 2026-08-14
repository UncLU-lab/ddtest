import { PartialType } from '@nestjs/mapped-types';
import { CreateVesselDto } from './create-vessel.dto';

export class UpdateVesselDto extends PartialType(CreateVesselDto) {}
