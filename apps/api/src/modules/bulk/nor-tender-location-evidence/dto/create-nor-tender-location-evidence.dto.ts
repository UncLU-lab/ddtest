import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  NOR_BERTH_RELATIONS,
  NOR_LOCATION_OPERATIONS,
  NOR_PORT_RELATIONS,
  NOR_WAITING_PLACES,
  type NorBerthRelation,
  type NorLocationOperation,
  type NorPortRelation,
  type NorWaitingPlace,
} from '../../entities/nor-tender-location-evidence.entity';

export const WRITABLE_NOR_LOCATION_EVIDENCE_SOURCES = [
  'MANUAL',
  'SOF',
] as const;
export type WritableNorLocationEvidenceSource =
  (typeof WRITABLE_NOR_LOCATION_EVIDENCE_SOURCES)[number];

export class CreateNorTenderLocationEvidenceDto {
  @IsISO8601({ strict: true, strictSeparator: true })
  evidenceTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceTimeZone?: string;

  @IsEnum(NOR_LOCATION_OPERATIONS)
  operation!: NorLocationOperation;

  @IsEnum(NOR_PORT_RELATIONS)
  portRelation!: NorPortRelation;

  @IsEnum(NOR_BERTH_RELATIONS)
  berthRelation!: NorBerthRelation;

  @IsEnum(NOR_WAITING_PLACES)
  waitingPlace!: NorWaitingPlace;

  @IsEnum(WRITABLE_NOR_LOCATION_EVIDENCE_SOURCES)
  source!: WritableNorLocationEvidenceSource;

  @IsOptional()
  @IsUUID()
  sofDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsUUID()
  norDocumentId?: string;

  @IsOptional()
  @IsUUID()
  norTenderedEventId?: string;
}
