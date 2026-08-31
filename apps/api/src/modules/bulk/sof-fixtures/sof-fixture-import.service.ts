import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { isValidIanaTimeZone } from '../laytime/shex-calendar';
import { SofDocumentsService } from '../sof-documents/sof-documents.service';
import { VoyagesService } from '../voyages/voyages.service';
import {
  SUPPORTED_SOF_EVENT_TYPES,
} from '../sof-documents/sof-event-types';
import { ImportSofFixtureDto } from './dto/import-sof-fixture.dto';

const LOCAL_WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface SofFixtureImportResult {
  sofDocumentId: string;
  operation: 'Loading' | 'Discharge';
  eventCount: number;
  createdDocument: boolean;
}

function localParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(value)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

function resolveLocalWallClock(value: string, timeZone: string): Date {
  const match = value.match(LOCAL_WALL_CLOCK_PATTERN);
  if (!match) {
    throw new BadRequestException(
      'eventTime must be a local wall-clock value in YYYY-MM-DDTHH:mm format',
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const nominalDate = new Date(nominal);
  if (
    nominalDate.getUTCFullYear() !== year ||
    nominalDate.getUTCMonth() !== month - 1 ||
    nominalDate.getUTCDate() !== day ||
    nominalDate.getUTCHours() !== hour ||
    nominalDate.getUTCMinutes() !== minute
  ) {
    throw new BadRequestException(`eventTime ${value} is not a valid calendar time`);
  }

  const candidates: Date[] = [];
  for (let delta = -36 * 3600_000; delta <= 36 * 3600_000; delta += 3600_000) {
    const candidate = new Date(nominal + delta);
    const parts = localParts(candidate, timeZone);
    if (
      parts.year === match[1] &&
      parts.month === match[2] &&
      parts.day === match[3] &&
      parts.hour === match[4] &&
      parts.minute === match[5] &&
      !candidates.some((existing) => existing.getTime() === candidate.getTime())
    ) {
      candidates.push(candidate);
    }
  }

  if (candidates.length !== 1) {
    throw new BadRequestException(
      candidates.length === 0
        ? `eventTime ${value} does not exist in source timezone ${timeZone}`
        : `eventTime ${value} is ambiguous in source timezone ${timeZone}`,
    );
  }

  return candidates[0];
}

function eventKey(event: {
  eventTime: Date;
  eventType: string;
  operation?: string | null;
  sourceTimeZone?: string | null;
}): string {
  return [
    event.operation ?? '',
    event.eventTime.toISOString(),
    event.eventType,
    event.sourceTimeZone ?? '',
  ].join('|');
}

@Injectable()
export class SofFixtureImportService {
  constructor(
    private readonly sofDocumentsService: SofDocumentsService,
    private readonly voyagesService: VoyagesService,
    private readonly databaseContext: TenantDatabaseContextService,
  ) {}

  async importFixture(
    voyageId: string,
    fixture: ImportSofFixtureDto,
  ): Promise<SofFixtureImportResult> {
    this.ensureEnabled();
    this.validateFixture(fixture);

    return this.databaseContext.transaction(async (manager) => {
      await this.voyagesService.ensureExists(voyageId);

      const draftDocuments = await manager.find(SofDocument, {
        where: {
          voyageId,
          operation: fixture.operation,
          status: 'Draft',
        },
        order: { uploadDate: 'DESC', id: 'ASC' },
      });

      const candidateEvents = draftDocuments.length
        ? await manager.find(SofEvent, {
            where: { sofId: In(draftDocuments.map((document) => document.id)) },
          })
        : [];
      const existingKeys = new Set(candidateEvents.map((event) => eventKey(event)));
      const parsedEvents = fixture.events.map((event) => ({
        ...event,
        eventTime: resolveLocalWallClock(event.eventTime, fixture.sourceTimeZone),
      }));
      const fixtureKeys = parsedEvents.map((event) =>
        eventKey({
          eventTime: event.eventTime,
          eventType: event.eventType,
          operation: fixture.operation,
          sourceTimeZone: fixture.sourceTimeZone,
        }),
      );

      if (new Set(fixtureKeys).size !== fixtureKeys.length) {
        throw new ConflictException(
          'The SOF fixture contains duplicate operation/time/type/timezone events.',
        );
      }

      if (fixtureKeys.every((key) => existingKeys.has(key))) {
        throw new ConflictException(
          'This SOF fixture has already been imported into a Draft document for this operation.',
        );
      }

      let document = draftDocuments[0];
      let createdDocument = false;
      if (!document) {
        document = await this.sofDocumentsService.createForVoyage(voyageId, {
          filePath: `fixture-imports/${voyageId}/statement-of-facts.json`,
          status: 'Draft',
          operation: fixture.operation,
        });
        createdDocument = true;
      }

      for (const event of parsedEvents) {
        await this.sofDocumentsService.addEvent(document.id, {
          eventTime: event.eventTime.toISOString(),
          sourceTimeZone: fixture.sourceTimeZone,
          eventType: event.eventType,
          operation: fixture.operation,
          remarks: JSON.stringify({
            ...(event.cause !== undefined ? { cause: event.cause } : {}),
            ...(event.durationHours !== null && event.durationHours !== undefined
              ? { duration: String(event.durationHours) }
              : {}),
            deductible: event.exceptionCandidate,
            ...(event.notes !== undefined ? { notes: event.notes } : {}),
          }),
        });
      }

      return {
        sofDocumentId: document.id,
        operation: fixture.operation,
        eventCount: parsedEvents.length,
        createdDocument,
      };
    });
  }

  private ensureEnabled(): void {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.APP_ENV !== 'staging'
    ) {
      throw new NotFoundException('SOF fixture import is not available in production');
    }
  }

  private validateFixture(fixture: ImportSofFixtureDto): void {
    if (fixture.version !== 1) {
      throw new BadRequestException('version must equal 1');
    }
    if (fixture.operation !== 'Loading' && fixture.operation !== 'Discharge') {
      throw new BadRequestException('operation must be Loading or Discharge');
    }
    if (!Array.isArray(fixture.events) || fixture.events.length === 0) {
      throw new BadRequestException('events must contain at least one event');
    }
    if (!isValidIanaTimeZone(fixture.sourceTimeZone)) {
      throw new BadRequestException(
        'sourceTimeZone must be a valid IANA timezone identifier',
      );
    }

    const supported = new Set<string>(SUPPORTED_SOF_EVENT_TYPES);
    fixture.events.forEach((event, index) => {
      if (!supported.has(event.eventType)) {
        throw new BadRequestException(
          `events[${index}].eventType is not a supported SOF event type`,
        );
      }
      if (event.operation !== undefined && event.operation !== fixture.operation) {
        throw new BadRequestException(
          `events[${index}].operation must match fixture operation ${fixture.operation}`,
        );
      }
      resolveLocalWallClock(event.eventTime, fixture.sourceTimeZone);
    });
  }
}
