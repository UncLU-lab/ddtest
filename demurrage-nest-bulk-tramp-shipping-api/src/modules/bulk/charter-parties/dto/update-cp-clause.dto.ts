import { PartialType } from '@nestjs/mapped-types';
import { CreateCpClauseDto } from './create-cp-clause.dto';

export class UpdateCpClauseDto extends PartialType(CreateCpClauseDto) {}
