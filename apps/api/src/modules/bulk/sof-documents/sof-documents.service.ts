import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateSofDocumentDto } from './dto/create-sof-document.dto';
import { CreateSofEventDto } from './dto/create-sof-event.dto';
import { UpdateSofDocumentDto } from './dto/update-sof-document.dto';
import { UpdateSofEventDto } from './dto/update-sof-event.dto';

@Injectable()
export class SofDocumentsService {
  constructor(
    @InjectRepository(SofDocument)
    private readonly documents: Repository<SofDocument>,
    @InjectRepository(SofEvent)
    private readonly events: Repository<SofEvent>,
    private readonly voyagesService: VoyagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findForVoyage(
    voyageId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<SofDocument>> {
    await this.voyagesService.ensureExists(voyageId);

    const result = await this.documents.findAndCount({
      where: { voyageId },
      order: { uploadDate: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async createForVoyage(
    voyageId: string,
    dto: CreateSofDocumentDto,
  ): Promise<SofDocument> {
    await this.voyagesService.ensureExists(voyageId);

    return this.documents.save(
      this.documents.create({
        ...dto,
        voyageId,
        operation: dto.operation ?? null,
      }),
    );
  }

  async findOne(id: string): Promise<SofDocument> {
    const document = await this.documents.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`SOF document ${id} not found`);
    }

    await this.voyagesService.ensureExists(document.voyageId);

    return document;
  }

  async update(id: string, dto: UpdateSofDocumentDto): Promise<SofDocument> {
    const document = await this.findOne(id);

    return this.documents.save(this.documents.merge(document, dto));
  }

  async findEvents(
    sofId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<SofEvent>> {
    await this.findOne(sofId);

    const result = await this.events.findAndCount({
      where: { sofId },
      order: { eventTime: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  /** Events added through the API are manual by definition. */
  async addEvent(sofId: string, dto: CreateSofEventDto): Promise<SofEvent> {
    await this.findOne(sofId);

    return this.events.save(
      this.events.create({
        sofId,
        eventTime: new Date(dto.eventTime),
        eventType: dto.eventType,
        operation: dto.operation ?? null,
        remarks: dto.remarks ?? null,
        confidenceScore: dto.confidenceScore?.toFixed(2) ?? null,
        isManualOverride: true,
      }),
    );
  }

  /**
   * Corrects an event. Extracted evidence retains its override-reason audit
   * requirement; manually entered evidence may be corrected directly.
   */
  async updateEvent(id: string, dto: UpdateSofEventDto): Promise<SofEvent> {
    const event = await this.events.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`SOF event ${id} not found`);
    }

    await this.findOne(event.sofId);

    const changesTimeOrType =
      (dto.eventTime !== undefined &&
        new Date(dto.eventTime).getTime() !== event.eventTime.getTime()) ||
      (dto.eventType !== undefined && dto.eventType !== event.eventType);

    const correctsExtraction = !event.isManualOverride && changesTimeOrType;

    if (correctsExtraction && !dto.overrideReason) {
      throw new BadRequestException(
        'overrideReason is required when changing an event time or type',
      );
    }

    if (dto.eventTime !== undefined) {
      event.eventTime = new Date(dto.eventTime);
    }
    if (dto.eventType !== undefined) {
      event.eventType = dto.eventType;
    }
    if (dto.operation !== undefined) {
      event.operation = dto.operation;
    }
    if (dto.remarks !== undefined) {
      event.remarks = dto.remarks;
    }
    if (dto.confidenceScore !== undefined) {
      event.confidenceScore = dto.confidenceScore.toFixed(2);
    }
    if (correctsExtraction) {
      event.isManualOverride = true;
      event.overrideReason = dto.overrideReason ?? null;
    }

    return this.events.save(event);
  }
}
