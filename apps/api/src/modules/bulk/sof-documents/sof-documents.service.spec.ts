import { Repository } from 'typeorm';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateSofDocumentDto } from './dto/create-sof-document.dto';
import { CreateSofEventDto } from './dto/create-sof-event.dto';
import { UpdateSofDocumentDto } from './dto/update-sof-document.dto';
import { UpdateSofEventDto } from './dto/update-sof-event.dto';
import { SofDocumentsService } from './sof-documents.service';

const SOF_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';

function buildService() {
  const documents = {
    findOne: jest.fn().mockResolvedValue({ id: SOF_ID, voyageId: SOF_ID }),
    create: jest.fn((value) => value),
    merge: jest.fn((entity, dto) => ({ ...entity, ...dto })),
    save: jest.fn(async (value) => value),
    findAndCount: jest.fn().mockResolvedValue([
      [
        {
          id: EVENT_ID,
          sofId: SOF_ID,
          eventTime: new Date('2026-08-17T10:00:00Z'),
          eventType: 'NOR_TENDERED',
          operation: 'Loading',
          isManualOverride: true,
        },
      ],
      1,
    ]),
  };
  const events = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
    findAndCount: jest.fn().mockResolvedValue([
      [
        {
          id: EVENT_ID,
          sofId: SOF_ID,
          eventTime: new Date('2026-08-17T10:00:00Z'),
          eventType: 'NOR_TENDERED',
          operation: 'Loading',
          remarks: null,
          confidenceScore: null,
          isManualOverride: true,
          overrideReason: null,
          createdAt: new Date('2026-08-17T10:00:00Z'),
        },
      ],
      1,
    ]),
  };
  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue({ id: SOF_ID }),
  };
  const tenantContext = {
    getOrganizationId: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
  };

  return {
    service: new SofDocumentsService(
      documents as unknown as Repository<SofDocument>,
      events as unknown as Repository<SofEvent>,
      voyagesService as unknown as VoyagesService,
      tenantContext as unknown as TenantContextService,
    ),
    documents,
    events,
    voyagesService,
    tenantContext,
  };
}

describe('SofDocumentsService documents', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'persists operation = %s when creating a SOF document',
    async (operation) => {
      const { service, documents } = buildService();

      const result = await service.createForVoyage(SOF_ID, {
        filePath: 'voyages/sof.pdf',
        status: 'Draft',
        operation,
      } as CreateSofDocumentDto);

      expect(documents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          voyageId: SOF_ID,
          operation,
        }),
      );
      expect(result.operation).toBe(operation);
    },
  );

  it('stores null operation when it is omitted on create', async () => {
    const { service, documents } = buildService();

    await service.createForVoyage(SOF_ID, {
      filePath: 'voyages/sof.pdf',
      status: 'Draft',
    } as CreateSofDocumentDto);

    expect(documents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        voyageId: SOF_ID,
        operation: null,
      }),
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'persists updated document operation = %s',
    async (operation) => {
      const { service, documents, events } = buildService();
      documents.findOne.mockResolvedValueOnce({
        id: DOCUMENT_ID,
        voyageId: SOF_ID,
        filePath: 'voyages/sof.pdf',
        status: 'Draft',
        operation: null,
      });

      const result = await service.update(DOCUMENT_ID, {
        operation,
      } as UpdateSofDocumentDto);

      expect(result.operation).toBe(operation);
      expect(documents.save).toHaveBeenCalledWith(
        expect.objectContaining({
          operation,
        }),
      );
      expect(events.save).not.toHaveBeenCalled();
    },
  );

  it('rejects a SOF document that belongs to another organization', async () => {
    const { service, documents, voyagesService } = buildService();
    documents.findOne.mockResolvedValueOnce({
      id: DOCUMENT_ID,
      voyageId: '22222222-2222-4222-8222-222222222222',
    });
    voyagesService.ensureExists.mockRejectedValueOnce(new Error('Voyage not found'));

    await expect(service.update(DOCUMENT_ID, {})).rejects.toThrow(
      'Voyage not found',
    );
  });
});

describe('SofDocumentsService events', () => {
  it('persists vessel readiness with its evidence timestamp', async () => {
    const { service, events } = buildService();
    const eventTime = '2026-08-17T09:30:00.000Z';

    const result = await service.addEvent(SOF_ID, {
      eventTime,
      eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
    });

    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sofId: SOF_ID,
        eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
        eventTime: new Date(eventTime),
        operation: null,
        isManualOverride: true,
      }),
    );
    expect(result.eventType).toBe('VESSEL_READY_IN_ALL_RESPECTS');
    expect(result.eventTime).toEqual(new Date(eventTime));
  });

  it.each([
    ['Loading', 'Loading'],
    ['Discharge', 'Discharge'],
    ['null', undefined],
  ] as const)(
    'persists FREE_PRATIQUE_GRANTED with %s operation and its exact grant timestamp',
    async (_label, operation) => {
      const { service, events } = buildService();
      const eventTime = '2026-08-17T09:37:41.250Z';

      const result = await service.addEvent(SOF_ID, {
        eventTime,
        eventType: 'FREE_PRATIQUE_GRANTED',
        ...(operation ? { operation } : {}),
      });

      expect(events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sofId: SOF_ID,
          eventType: 'FREE_PRATIQUE_GRANTED',
          eventTime: new Date(eventTime),
          operation: operation ?? null,
          isManualOverride: true,
        }),
      );
      expect(result.eventType).toBe('FREE_PRATIQUE_GRANTED');
      expect(result.eventTime).toEqual(new Date(eventTime));
      expect(result.operation).toBe(operation ?? null);
    },
  );

  it.each(['Loading', 'Discharge'] as const)(
    'persists operation = %s when adding a manual event',
    async (operation) => {
      const { service, events } = buildService();

      const result = await service.addEvent(SOF_ID, {
        eventTime: '2026-08-17T10:00:00.000Z',
        eventType: 'NOR_TENDERED',
        operation,
      });

      expect(events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sofId: SOF_ID,
          operation,
          isManualOverride: true,
        }),
      );
      expect(result.operation).toBe(operation);
    },
  );

  it.each(['Loading', 'Discharge'] as const)(
    'persists CARGO_STARTED with operation = %s when adding a manual event',
    async (operation) => {
      const { service, events } = buildService();

      const result = await service.addEvent(SOF_ID, {
        eventTime: '2026-08-17T10:00:00.000Z',
        eventType: 'CARGO_STARTED',
        operation,
      });

      expect(events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sofId: SOF_ID,
          eventType: 'CARGO_STARTED',
          operation,
          isManualOverride: true,
        }),
      );
      expect(result.eventType).toBe('CARGO_STARTED');
      expect(result.operation).toBe(operation);
    },
  );

  it.each([
    ['HATCHES_CLOSED', 'Loading'],
    ['CARGO_SECURED', 'Discharge'],
    ['HATCHES_CLOSED', undefined],
  ] as const)(
    'persists %s with operation = %s and preserves the exact event timestamp',
    async (eventType, operation) => {
      const { service, events } = buildService();
      const eventTime = '2026-08-17T10:12:34.567Z';

      const result = await service.addEvent(SOF_ID, {
        eventTime,
        eventType,
        ...(operation ? { operation } : {}),
      });

      expect(events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sofId: SOF_ID,
          eventType,
          eventTime: new Date(eventTime),
          operation: operation ?? null,
          isManualOverride: true,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          eventType,
          eventTime: new Date(eventTime),
          operation: operation ?? null,
        }),
      );
    },
  );

  it('stores null operation when it is omitted on create', async () => {
    const { service, events } = buildService();

    await service.addEvent(SOF_ID, {
      eventTime: '2026-08-17T10:00:00.000Z',
      eventType: 'NOR_TENDERED',
    } as CreateSofEventDto);

    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: null,
      }),
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'persists updated operation = %s',
    async (operation) => {
      const { service, events } = buildService();
      events.findOne.mockResolvedValueOnce({
        id: EVENT_ID,
        sofId: SOF_ID,
        eventTime: new Date('2026-08-17T09:00:00Z'),
        eventType: 'NOR_TENDERED',
        operation: null,
        isManualOverride: false,
      });

      const result = await service.updateEvent(EVENT_ID, {
        operation,
      } as UpdateSofEventDto);

      expect(result.operation).toBe(operation);
      expect(events.save).toHaveBeenCalledWith(
        expect.objectContaining({
          operation,
        }),
      );
    },
  );

  it('persists edited event time, type, remarks, and preserves the event id', async () => {
    const { service, events } = buildService();
    const nextEventTime = '2026-08-17T11:30:00.000Z';
    const nextEventType = 'DISCHARGE_COMPLETED';
    const nextRemarks = JSON.stringify({
      cause: 'Terminal',
      duration: '1h 30m',
      deductible: true,
      notes: 'Edited note',
    });

    const existingEvent = {
      id: EVENT_ID,
      sofId: SOF_ID,
      eventTime: new Date('2026-08-17T09:00:00Z'),
      eventType: 'NOR_TENDERED',
      operation: 'Loading',
      remarks: 'old',
      confidenceScore: '0.90',
      isManualOverride: false,
      overrideReason: null,
    };
    events.findOne.mockResolvedValueOnce(existingEvent);

    const result = await service.updateEvent(EVENT_ID, {
      eventTime: nextEventTime,
      eventType: nextEventType,
      remarks: nextRemarks,
      operation: 'Discharge',
      overrideReason: 'Corrected event details',
      confidenceScore: 0.75,
    } as UpdateSofEventDto);

    expect(result.id).toBe(EVENT_ID);
    expect(result).toEqual(
      expect.objectContaining({
        eventTime: new Date(nextEventTime),
        eventType: nextEventType,
        operation: 'Discharge',
        remarks: nextRemarks,
        confidenceScore: '0.75',
        isManualOverride: true,
        overrideReason: 'Corrected event details',
      }),
    );
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: EVENT_ID,
        eventTime: new Date(nextEventTime),
        eventType: nextEventType,
        operation: 'Discharge',
        remarks: nextRemarks,
        confidenceScore: '0.75',
        isManualOverride: true,
        overrideReason: 'Corrected event details',
      }),
    );
  });

  it('allows a manually entered event to be corrected without an extraction override reason', async () => {
    const { service, events } = buildService();
    const manuallyEnteredEvent = {
      id: EVENT_ID,
      sofId: SOF_ID,
      eventTime: new Date('2026-08-17T09:00:00Z'),
      eventType: 'DISCHARGE_COMPLETED',
      operation: 'Discharge',
      remarks: JSON.stringify({ notes: 'Discharge hoses disconnected' }),
      isManualOverride: true,
      overrideReason: null,
    };
    events.findOne.mockResolvedValueOnce(manuallyEnteredEvent);

    const result = await service.updateEvent(EVENT_ID, {
      eventType: 'HOSES_DISCONNECTED',
      operation: 'Discharge',
      remarks: JSON.stringify({ notes: 'Discharge hoses disconnected' }),
    } as UpdateSofEventDto);

    expect(result.id).toBe(EVENT_ID);
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: EVENT_ID,
        eventType: 'HOSES_DISCONNECTED',
        operation: 'Discharge',
        remarks: JSON.stringify({ notes: 'Discharge hoses disconnected' }),
        isManualOverride: true,
      }),
    );
  });

  it('continues to require an override reason when correcting extracted evidence', async () => {
    const { service, events } = buildService();
    events.findOne.mockResolvedValueOnce({
      id: EVENT_ID,
      sofId: SOF_ID,
      eventTime: new Date('2026-08-17T09:00:00Z'),
      eventType: 'DISCHARGE_COMPLETED',
      operation: 'Discharge',
      isManualOverride: false,
    });

    await expect(
      service.updateEvent(EVENT_ID, {
        eventType: 'HOSES_DISCONNECTED',
      } as UpdateSofEventDto),
    ).rejects.toThrow('overrideReason is required when changing an event time or type');
    expect(events.save).not.toHaveBeenCalled();
  });

  it('returns persisted operation values from findEvents', async () => {
    const { service } = buildService();

    const result = await service.findEvents(SOF_ID, {
      skip: 0,
      limit: 10,
      page: 1,
    } as any);

    expect(result.data[0]).toEqual(expect.objectContaining({ operation: 'Loading' }));
  });
});
