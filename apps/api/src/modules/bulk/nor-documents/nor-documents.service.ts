import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { NorDocument } from '../entities/nor-document.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateNorDocumentDto } from './dto/create-nor-document.dto';
import { UpdateNorDocumentDto } from './dto/update-nor-document.dto';

@Injectable()
export class NorDocumentsService {
  constructor(
    @InjectRepository(NorDocument)
    private readonly documents: Repository<NorDocument>,
    private readonly voyagesService: VoyagesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findForVoyage(
    voyageId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<NorDocument>> {
    await this.voyagesService.ensureExists(voyageId);

    const result = await this.documents.findAndCount({
      where: { voyageId },
      order: { tenderTime: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async createForVoyage(
    voyageId: string,
    dto: CreateNorDocumentDto,
  ): Promise<NorDocument> {
    await this.voyagesService.ensureExists(voyageId);

    this.assertAcceptanceOrder(dto.tenderTime, dto.acceptedTime);

    return this.documents.save(
      this.documents.create({
        voyageId,
        filePath: dto.filePath,
        tenderTime: new Date(dto.tenderTime),
        acceptedTime: dto.acceptedTime ? new Date(dto.acceptedTime) : null,
      }),
    );
  }

  async update(id: string, dto: UpdateNorDocumentDto): Promise<NorDocument> {
    const document = await this.documents.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`NOR document ${id} not found`);
    }

    await this.voyagesService.ensureExists(document.voyageId);

    const tenderTime = dto.tenderTime
      ? new Date(dto.tenderTime)
      : document.tenderTime;
    const acceptedTime =
      dto.acceptedTime !== undefined
        ? new Date(dto.acceptedTime)
        : document.acceptedTime;

    this.assertAcceptanceOrder(tenderTime, acceptedTime);

    document.tenderTime = tenderTime;
    document.acceptedTime = acceptedTime ?? null;
    if (dto.filePath !== undefined) {
      document.filePath = dto.filePath;
    }

    return this.documents.save(document);
  }

  private assertAcceptanceOrder(
    tenderTime: string | Date,
    acceptedTime: string | Date | null | undefined,
  ): void {
    if (acceptedTime && new Date(acceptedTime) < new Date(tenderTime)) {
      throw new BadRequestException('acceptedTime must not precede tenderTime');
    }
  }
}
