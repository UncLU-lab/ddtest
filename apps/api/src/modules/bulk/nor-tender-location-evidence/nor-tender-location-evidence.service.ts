import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { NorDocument } from '../entities/nor-document.entity';
import { NorTenderLocationEvidence } from '../entities/nor-tender-location-evidence.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { isValidIanaTimeZone } from '../laytime/shex-calendar';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateNorTenderLocationEvidenceDto } from './dto/create-nor-tender-location-evidence.dto';
import { FindNorTenderLocationEvidenceQueryDto } from './dto/find-nor-tender-location-evidence-query.dto';

@Injectable()
export class NorTenderLocationEvidenceService {
  constructor(
    @InjectRepository(NorTenderLocationEvidence)
    private readonly evidence: Repository<NorTenderLocationEvidence>,
    @InjectRepository(NorDocument)
    private readonly norDocuments: Repository<NorDocument>,
    @InjectRepository(SofDocument)
    private readonly sofDocuments: Repository<SofDocument>,
    @InjectRepository(SofEvent)
    private readonly sofEvents: Repository<SofEvent>,
    private readonly voyagesService: VoyagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findForVoyage(
    voyageId: string,
    query: FindNorTenderLocationEvidenceQueryDto,
  ): Promise<Paginated<NorTenderLocationEvidence>> {
    await this.voyagesService.ensureExists(voyageId);

    const result = await this.evidence.findAndCount({
      where: query.operation
        ? { voyageId, operation: query.operation }
        : { voyageId },
      order: { evidenceTime: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async createForVoyage(
    voyageId: string,
    dto: CreateNorTenderLocationEvidenceDto,
  ): Promise<NorTenderLocationEvidence> {
    await this.voyagesService.ensureExists(voyageId);
    this.assertSingleCandidateReference(dto);

    const candidateDocument = dto.norDocumentId
      ? await this.norDocuments.findOne({
          where: { id: dto.norDocumentId, voyageId },
        })
      : null;
    if (dto.norDocumentId && !candidateDocument) {
      throw new BadRequestException(
        'The referenced NOR document does not belong to this voyage',
      );
    }

    const candidateEvent = dto.norTenderedEventId
      ? await this.loadNorTenderedEvent(voyageId, dto.norTenderedEventId)
      : null;
    const sourceDocument = dto.sofDocumentId
      ? await this.loadSofDocument(voyageId, dto.sofDocumentId)
      : null;

    if (dto.source === 'SOF' && !sourceDocument) {
      throw new BadRequestException(
        'SOF location evidence requires a source SOF document',
      );
    }
    if (dto.source === 'MANUAL' && sourceDocument) {
      throw new BadRequestException(
        'Manual location evidence cannot claim an SOF document source',
      );
    }
    if (
      sourceDocument?.operation &&
      sourceDocument.operation !== dto.operation
    ) {
      throw new BadRequestException(
        'The source SOF document operation does not match the evidence operation',
      );
    }
    if (
      candidateEvent?.operation &&
      candidateEvent.operation !== dto.operation
    ) {
      throw new BadRequestException(
        'The NOR tender event operation does not match the evidence operation',
      );
    }
    if (
      candidateEvent &&
      sourceDocument &&
      candidateEvent.sofId !== sourceDocument.id
    ) {
      throw new BadRequestException(
        'The NOR tender event does not belong to the source SOF document',
      );
    }

    const sourceTimeZone =
      candidateEvent?.sourceTimeZone ?? dto.sourceTimeZone?.trim() ?? null;
    if (!sourceTimeZone && !candidateEvent && !candidateDocument) {
      throw new BadRequestException(
        'Unassociated location evidence requires an explicit sourceTimeZone',
      );
    }
    if (sourceTimeZone && !isValidIanaTimeZone(sourceTimeZone)) {
      throw new BadRequestException(
        'sourceTimeZone must be a valid IANA timezone identifier',
      );
    }

    const candidateTenderTime =
      candidateDocument?.tenderTime ?? candidateEvent?.eventTime;
    if (
      candidateTenderTime &&
      new Date(dto.evidenceTime).getTime() > candidateTenderTime.getTime()
    ) {
      throw new BadRequestException(
        'Candidate-associated location evidence cannot apply after the referenced NOR tender time',
      );
    }

    return this.evidence.save(
      this.evidence.create({
        voyageId,
        evidenceTime: new Date(dto.evidenceTime),
        sourceTimeZone,
        operation: dto.operation,
        portRelation: dto.portRelation,
        berthRelation: dto.berthRelation,
        waitingPlace: dto.waitingPlace,
        source: dto.source,
        sofDocumentId: dto.sofDocumentId ?? null,
        sourceReference: dto.sourceReference?.trim() || null,
        note: dto.note?.trim() || null,
        norDocumentId: dto.norDocumentId ?? null,
        norTenderedEventId: dto.norTenderedEventId ?? null,
        createdByUserId: this.tenantContext.getUserId(),
      }),
    );
  }

  private assertSingleCandidateReference(
    dto: CreateNorTenderLocationEvidenceDto,
  ): void {
    if (dto.norDocumentId && dto.norTenderedEventId) {
      throw new BadRequestException(
        'Location evidence can reference either a NOR document or a NOR_TENDERED SOF event, not both',
      );
    }
  }

  private async loadSofDocument(
    voyageId: string,
    sofDocumentId: string,
  ): Promise<SofDocument> {
    const document = await this.sofDocuments.findOne({
      where: { id: sofDocumentId, voyageId },
    });
    if (!document) {
      throw new BadRequestException(
        'The referenced SOF document does not belong to this voyage',
      );
    }
    return document;
  }

  private async loadNorTenderedEvent(
    voyageId: string,
    eventId: string,
  ): Promise<SofEvent> {
    const event = await this.sofEvents.findOne({ where: { id: eventId } });
    if (!event || event.eventType !== 'NOR_TENDERED') {
      throw new BadRequestException(
        'The referenced SOF event must be a NOR_TENDERED event',
      );
    }
    await this.loadSofDocument(voyageId, event.sofId);
    return event;
  }
}
