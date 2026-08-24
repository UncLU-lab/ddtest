import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import {
  NOR_LOCATION_OPERATIONS,
  type NorLocationOperation,
} from '../../entities/nor-tender-location-evidence.entity';

export class FindNorTenderLocationEvidenceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(NOR_LOCATION_OPERATIONS)
  operation?: NorLocationOperation;
}
