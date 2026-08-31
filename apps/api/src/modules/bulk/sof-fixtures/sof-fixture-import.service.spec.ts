import { BadRequestException, ConflictException } from '@nestjs/common';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { ImportSofFixtureDto } from './dto/import-sof-fixture.dto';
import { SofFixtureImportService } from './sof-fixture-import.service';

const VOYAGE_ID = '11111111-1111-4111-8111-111111111111';

function fixture(
  operation: 'Loading' | 'Discharge' = 'Loading',
): ImportSofFixtureDto {
  return {
    version: 1,
    operation,
    sourceTimeZone: 'Australia/Sydney',
    events: [
      {
        eventTime: '2026-09-07T00:00',
        eventType: 'NOR_TENDERED',
        exceptionCandidate: false,
        notes: 'NOR tendered',
      },
      {
        eventTime: '2026-09-09T06:00',
        eventType: 'CARGO_COMPLETED',
        exceptionCandidate: false,
      },
    ],
  };
}

function buildService(options?: {
  draftDocuments?: Array<Partial<SofDocument>>;
  existingEvents?: Array<Partial<SofEvent>>;
  ensureExists?: jest.Mock;
  addEvent?: jest.Mock;
}) {
  const manager = {
    find: jest
      .fn()
      .mockResolvedValueOnce(options?.draftDocuments ?? [])
      .mockResolvedValueOnce(options?.existingEvents ?? []),
  };
  const databaseContext = {
    transaction: jest.fn((work: (manager: typeof manager) => unknown) =>
      work(manager),
    ),
  };
  const voyagesService = {
    ensureExists:
      options?.ensureExists ?? jest.fn().mockResolvedValue({ id: VOYAGE_ID }),
  };
  const sofDocumentsService = {
    createForVoyage: jest.fn().mockResolvedValue({
      id: 'created-sof',
      voyageId: VOYAGE_ID,
      status: 'Draft',
      operation: 'Loading',
    }),
    addEvent: options?.addEvent ?? jest.fn().mockResolvedValue({}),
  };
  const service = new SofFixtureImportService(
    sofDocumentsService as any,
    voyagesService as any,
    databaseContext as any,
  );

  return { service, manager, databaseContext, voyagesService, sofDocumentsService };
}

describe('SofFixtureImportService', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'creates an operation-scoped %s Draft document and persists timezone provenance',
    async (operation) => {
      const { service, sofDocumentsService } = buildService();

      const result = await service.importFixture(VOYAGE_ID, fixture(operation));

      expect(result).toEqual({
        sofDocumentId: 'created-sof',
        operation,
        eventCount: 2,
        createdDocument: true,
      });
      expect(sofDocumentsService.createForVoyage).toHaveBeenCalledWith(
        VOYAGE_ID,
        expect.objectContaining({
          status: 'Draft',
          operation,
        }),
      );
      expect(sofDocumentsService.addEvent).toHaveBeenNthCalledWith(
        1,
        'created-sof',
        expect.objectContaining({
          eventTime: '2026-09-06T14:00:00.000Z',
          sourceTimeZone: 'Australia/Sydney',
          operation,
        }),
      );
    },
  );

  it('rejects an invalid timezone before opening the write path', async () => {
    const { service, databaseContext } = buildService();
    const invalid = fixture();
    invalid.sourceTimeZone = 'Australia/Nowhere';

    await expect(service.importFixture(VOYAGE_ID, invalid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(databaseContext.transaction).not.toHaveBeenCalled();
  });

  it('rejects an unsupported event type before opening the write path', async () => {
    const { service, databaseContext } = buildService();
    const invalid = fixture();
    invalid.events[0].eventType = 'NOT_A_SOF_EVENT';

    await expect(service.importFixture(VOYAGE_ID, invalid)).rejects.toThrow(
      'events[0].eventType is not a supported SOF event type',
    );
    expect(databaseContext.transaction).not.toHaveBeenCalled();
  });

  it('rejects mixed operation fixtures', async () => {
    const { service, databaseContext } = buildService();
    const invalid = fixture('Loading');
    invalid.events[1].operation = 'Discharge';

    await expect(service.importFixture(VOYAGE_ID, invalid)).rejects.toThrow(
      'events[1].operation must match fixture operation Loading',
    );
    expect(databaseContext.transaction).not.toHaveBeenCalled();
  });

  it('rejects an exact duplicate already present in a Draft operation document', async () => {
    const existingDocument = {
      id: 'draft-sof',
      voyageId: VOYAGE_ID,
      status: 'Draft' as const,
      operation: 'Loading' as const,
    };
    const source = fixture();
    const { service, sofDocumentsService } = buildService({
      draftDocuments: [existingDocument],
      existingEvents: source.events.map((event, index) => ({
        id: `event-${index}`,
        sofId: 'draft-sof',
        eventTime:
          index === 0
            ? new Date('2026-09-06T14:00:00.000Z')
            : new Date('2026-09-08T20:00:00.000Z'),
        eventType: event.eventType,
        operation: 'Loading' as const,
        sourceTimeZone: 'Australia/Sydney',
      })),
    });

    await expect(service.importFixture(VOYAGE_ID, source)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(sofDocumentsService.createForVoyage).not.toHaveBeenCalled();
    expect(sofDocumentsService.addEvent).not.toHaveBeenCalled();
  });

  it('uses one transaction and leaves rollback to the database transaction when an event write fails', async () => {
    const addEvent = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('event persistence failed'));
    const { service, databaseContext, sofDocumentsService } = buildService({
      addEvent,
    });

    await expect(service.importFixture(VOYAGE_ID, fixture())).rejects.toThrow(
      'event persistence failed',
    );
    expect(databaseContext.transaction).toHaveBeenCalledTimes(1);
    expect(sofDocumentsService.createForVoyage).toHaveBeenCalledTimes(1);
    expect(addEvent).toHaveBeenCalledTimes(2);
  });

  it('does not mutate a Final SOF and creates a new Draft document instead', async () => {
    const { service, sofDocumentsService } = buildService();

    await service.importFixture(VOYAGE_ID, fixture('Discharge'));

    expect(sofDocumentsService.createForVoyage).toHaveBeenCalledWith(
      VOYAGE_ID,
      expect.objectContaining({ status: 'Draft', operation: 'Discharge' }),
    );
  });

  it('stops before any document or event write when the voyage is outside the tenant', async () => {
    const ensureExists = jest.fn().mockRejectedValue(new Error('Voyage not found'));
    const { service, sofDocumentsService } = buildService({ ensureExists });

    await expect(service.importFixture(VOYAGE_ID, fixture())).rejects.toThrow(
      'Voyage not found',
    );
    expect(sofDocumentsService.createForVoyage).not.toHaveBeenCalled();
    expect(sofDocumentsService.addEvent).not.toHaveBeenCalled();
  });
});
