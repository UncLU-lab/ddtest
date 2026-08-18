import { PartialType } from '@nestjs/mapped-types';
import { CreateCharterPartyDto } from './create-charter-party.dto';

export class UpdateCharterPartyDto extends PartialType(CreateCharterPartyDto) {}
