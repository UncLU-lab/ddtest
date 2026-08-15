import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateBulkDisputeDto } from './dto/create-bulk-dispute.dto';
import { ListBulkDisputesQueryDto } from './dto/list-bulk-disputes-query.dto';
import { UpdateBulkDisputeDto } from './dto/update-bulk-dispute.dto';

const ACTIVE_DISPUTE_STATUSES = ['Open', 'Evidence Submitted', 'In Negotiation'] as const;

@Injectable()
export class BulkDisputesService {
  constructor(
    @InjectRepository(DisputeCaseBulk)
    private readonly disputes: Repository<DisputeCaseBulk>,
    private readonly voyagesService: VoyagesService,
  ) {}

  async findAll(
    query: ListBulkDisputesQueryDto,
  ): Promise<Paginated<DisputeCaseBulk>> {
    const builder = this.disputes
      .createQueryBuilder('dispute')
      .orderBy('dispute.createdDate', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.voyageId) {
      builder.andWhere('dispute.voyageId = :voyageId', {
        voyageId: query.voyageId,
      });
    }
    if (query.status) {
      builder.andWhere('dispute.status = :status', { status: query.status });
    }
    if (query.type) {
      builder.andWhere('dispute.type = :type', { type: query.type });
    }

    return paginate(await builder.getManyAndCount(), query);
  }

  async findOne(id: string): Promise<DisputeCaseBulk> {
    const dispute = await this.disputes.findOne({ where: { id } });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    return dispute;
  }

  async create(dto: CreateBulkDisputeDto): Promise<DisputeCaseBulk> {
    await this.voyagesService.ensureExists(dto.voyageId);

    const existingActiveDispute = await this.disputes.findOne({
      where: ACTIVE_DISPUTE_STATUSES.map((status) => ({
        voyageId: dto.voyageId,
        type: dto.type,
        status,
      })),
    });

    if (existingActiveDispute) {
      throw new ConflictException(
        'An active claim already exists for this voyage and claim type.',
      );
    }

    return this.disputes.save(
      this.disputes.create({
        voyageId: dto.voyageId,
        type: dto.type,
        amountDisputed: dto.amountDisputed.toFixed(2),
        status: dto.status,
      }),
    );
  }

  /** Resolving a dispute records when it closed and for how much. */
  async update(
    id: string,
    dto: UpdateBulkDisputeDto,
  ): Promise<DisputeCaseBulk> {
    const dispute = await this.findOne(id);

    if (dto.status !== undefined) {
      dispute.status = dto.status;
    }
    if (dto.amountDisputed !== undefined) {
      dispute.amountDisputed = dto.amountDisputed.toFixed(2);
    }
    if (dto.finalSettlementAmount !== undefined) {
      dispute.finalSettlementAmount = dto.finalSettlementAmount.toFixed(2);
    }
    if (dto.resolvedDate !== undefined) {
      dispute.resolvedDate = new Date(dto.resolvedDate);
    }

    if (dispute.status === 'Resolved') {
      if (dispute.finalSettlementAmount === null) {
        throw new BadRequestException(
          'finalSettlementAmount is required when resolving a dispute',
        );
      }
      dispute.resolvedDate ??= new Date();
    }

    return this.disputes.save(dispute);
  }
}
