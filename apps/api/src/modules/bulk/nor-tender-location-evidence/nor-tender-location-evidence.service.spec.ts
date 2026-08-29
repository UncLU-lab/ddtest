import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { NorDocument } from '../entities/nor-document.entity';
import { NorTenderLocationEvidence } from '../entities/nor-tender-location-evidence.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { NorTenderLocationEvidenceService } from './nor-tender-location-evidence.service';

const VOYAGE_ID = '10000000-0000-4000-8000-000000000001';
const USER_ID = '10000000-0000-4000-8000-000000000002';
const SOF_ID = '10000000-0000-4000-8000-000000000003';
const NOR_ID = '10000000-0000-4000-8000-000000000004';
const NOR_EVENT_ID = '10000000-0000-4000-8000-000000000005';

function buildService() {
  const evidence = {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn((value: Partial<NorTenderLocationEvidence>) => value),
    save: jest.fn((value: Partial<NorTenderLocationEvidence>) =>
      Promise.resolve({ id: 'evidence-1', ...value }),
    ),
  };
  const norDocuments = {
    findOne: jest.fn().mockResolvedValue({
      id: NOR_ID,
      voyageId: VOYAGE_ID,
      tenderTime: new Date('2026-03-04T10:00:00Z'),
    }),
  };
  const sofDocuments = {
    findOne: jest.fn().mockResolvedValue({ id: SOF_ID, voyageId: VOYAGE_ID }),
  };
  const sofEvents = {
    findOne: jest.fn().mockResolvedValue({
      id: NOR_EVENT_ID,
      sofId: SOF_ID,
      eventType: 'NOR_TENDERED',
      eventTime: new Date('2026-03-04T14:00:00Z'),
      sourceTimeZone: 'Australia/Perth',
    }),
  };
  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue({ id: VOYAGE_ID }),
  };
  const tenantContext = { getUserId: jest.fn().mockReturnValue(USER_ID) };

  return {
    service: new NorTenderLocationEvidenceService(
      evidence as unknown as Repository<NorTenderLocationEvidence>,
      norDocuments as unknown as Repository<NorDocument>,
      sofDocuments as unknown as Repository<SofDocument>,
      sofEvents as unknown as Repository<SofEvent>,
      voyagesService as unknown as VoyagesService,
      tenantContext as unknown as TenantContextService,
    ),
    evidence,
    norDocuments,
    sofDocuments,
    sofEvents,
    voyagesService,
  };
}

const manualDto = {
  evidenceTime: '2026-03-04T08:00:00Z',
  operation: 'Loading' as const,
  portRelation: 'INSIDE_PORT_LIMITS' as const,
  berthRelation: 'NOT_AT_BERTH' as const,
  waitingPlace: 'ANCHORAGE' as const,
  source: 'MANUAL' as const,
  norDocumentId: NOR_ID,
  note: 'Agent confirmed berth occupied',
};

describe('NorTenderLocationEvidenceService', () => {
  it('lists one operation without mixing opposite-operation evidence', async () => {
    const { service, evidence, voyagesService } = buildService();

    await service.findForVoyage(VOYAGE_ID, {
      page: 1,
      limit: 25,
      skip: 0,
      operation: 'Loading',
    });

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(evidence.findAndCount).toHaveBeenCalledWith({
      where: { voyageId: VOYAGE_ID, operation: 'Loading' },
      order: { evidenceTime: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: 0,
      take: 25,
    });
  });

  it('persists explicit manual facts and derives the creator from request context', async () => {
    const { service, evidence } = buildService();

    const result = await service.createForVoyage(VOYAGE_ID, manualDto);

    expect(evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        evidenceTime: new Date(manualDto.evidenceTime),
        operation: 'Loading',
        source: 'MANUAL',
        createdByUserId: USER_ID,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'evidence-1' }));
  });

  it('supports distinct observations associated with separate NOR candidates', async () => {
    const { service, evidence } = buildService();

    await service.createForVoyage(VOYAGE_ID, manualDto);
    await service.createForVoyage(VOYAGE_ID, {
      ...manualDto,
      evidenceTime: '2026-03-04T12:00:00Z',
      norDocumentId: undefined,
      norTenderedEventId: NOR_EVENT_ID,
      portRelation: 'OUTSIDE_PORT_LIMITS',
      waitingPlace: 'PILOT_STATION',
    });

    expect(evidence.save).toHaveBeenCalledTimes(2);
    expect(evidence.create.mock.calls[0][0]?.norDocumentId).toBe(NOR_ID);
    expect(evidence.create.mock.calls[1][0]?.norTenderedEventId).toBe(
      NOR_EVENT_ID,
    );
    expect(evidence.create.mock.calls[1][0]?.sourceTimeZone).toBe(
      'Australia/Perth',
    );
  });

  it('requires an explicit timezone for unassociated observations', async () => {
    const { service, evidence } = buildService();

    await expect(
      service.createForVoyage(VOYAGE_ID, {
        ...manualDto,
        norDocumentId: undefined,
      }),
    ).rejects.toThrow('requires an explicit sourceTimeZone');
    expect(evidence.save).not.toHaveBeenCalled();
  });

  it('rejects ambiguous association with two NOR candidate types', async () => {
    const { service, evidence } = buildService();

    await expect(
      service.createForVoyage(VOYAGE_ID, {
        ...manualDto,
        norTenderedEventId: NOR_EVENT_ID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(evidence.save).not.toHaveBeenCalled();
  });

  it('requires and validates the SOF document for SOF provenance', async () => {
    const { service, evidence, sofDocuments } = buildService();

    await service.createForVoyage(VOYAGE_ID, {
      ...manualDto,
      source: 'SOF',
      sofDocumentId: SOF_ID,
    });

    expect(sofDocuments.findOne).toHaveBeenCalledWith({
      where: { id: SOF_ID, voyageId: VOYAGE_ID },
    });
    expect(evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({ sofDocumentId: SOF_ID, source: 'SOF' }),
    );
  });

  it('rejects a SOF source without a document reference', async () => {
    const { service } = buildService();

    await expect(
      service.createForVoyage(VOYAGE_ID, { ...manualDto, source: 'SOF' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a candidate event that is not NOR_TENDERED', async () => {
    const { service, sofEvents } = buildService();
    sofEvents.findOne.mockResolvedValueOnce({
      id: NOR_EVENT_ID,
      sofId: SOF_ID,
      eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
    });

    await expect(
      service.createForVoyage(VOYAGE_ID, {
        ...manualDto,
        norDocumentId: undefined,
        norTenderedEventId: NOR_EVENT_ID,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects candidate-associated evidence that applies after tender', async () => {
    const { service, evidence } = buildService();

    await expect(
      service.createForVoyage(VOYAGE_ID, {
        ...manualDto,
        evidenceTime: '2026-03-04T10:00:01Z',
      }),
    ).rejects.toThrow(
      'Candidate-associated location evidence cannot apply after the referenced NOR tender time',
    );
    expect(evidence.save).not.toHaveBeenCalled();
  });

  it('allows retrospective entry when factual evidenceTime is at tender', async () => {
    const { service, evidence } = buildService();

    await service.createForVoyage(VOYAGE_ID, {
      ...manualDto,
      evidenceTime: '2026-03-04T10:00:00Z',
    });

    expect(evidence.save).toHaveBeenCalledTimes(1);
  });

  it('snapshots the explicit timezone for a NOR document candidate', async () => {
    const { service, evidence } = buildService();

    await service.createForVoyage(VOYAGE_ID, {
      ...manualDto,
      sourceTimeZone: 'Australia/Perth',
    });

    expect(evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceTimeZone: 'Australia/Perth' }),
    );
  });
});
