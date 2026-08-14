import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CreateSofEventDto } from './create-sof-event.dto';

export class UpdateSofEventDto extends PartialType(CreateSofEventDto) {
  /**
   * Why the extracted value was corrected. Required whenever the event time or
   * type changes, since the correction is recorded as a manual override.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  overrideReason?: string;
}
