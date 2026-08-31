import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SOF_DOCUMENT_OPERATIONS,
  type SofDocumentOperation,
} from '../../entities/sof-document.entity';
import {
  SOF_EVENT_OPERATIONS,
  type SofEventOperation,
} from '../../entities/sof-event.entity';

const LOCAL_WALL_CLOCK_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export class SofFixtureEventDto {
  @IsString()
  @Matches(LOCAL_WALL_CLOCK_PATTERN, {
    message: 'eventTime must be a local wall-clock value in YYYY-MM-DDTHH:mm format',
  })
  eventTime!: string;

  @IsString()
  @MaxLength(50)
  eventType!: string;

  @IsOptional()
  @IsIn(SOF_EVENT_OPERATIONS)
  operation?: SofEventOperation;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cause?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  durationHours?: number | null;

  @IsBoolean()
  exceptionCandidate!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ImportSofFixtureDto {
  @Equals(1)
  version!: 1;

  @IsIn(SOF_DOCUMENT_OPERATIONS)
  operation!: SofDocumentOperation;

  @IsString()
  @MaxLength(100)
  sourceTimeZone!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SofFixtureEventDto)
  events!: SofFixtureEventDto[];
}
