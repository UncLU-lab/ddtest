import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateBulkDisputeDto } from './dto/create-bulk-dispute.dto';
import { ListBulkDisputesQueryDto } from './dto/list-bulk-disputes-query.dto';
import { UpdateBulkDisputeDto } from './dto/update-bulk-dispute.dto';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { readReversibleSettlementStatus } from '../laytime-calculations/reversible-laytime-settlement';
import type { SettlementCurrency } from '../currency/settlement-currency';

const ACTIVE_DISPUTE_STATUSES = ['Open', 'Evidence Submitted', 'In Negotiation'] as const;

@Injectable()
export class BulkDisputesService {
  constructor(
    @InjectRepository(DisputeCaseBulk)
    private readonly disputes: Repository<DisputeCaseBulk>,
    private readonly voyagesService: VoyagesService,
    private readonly tenantContext: TenantContextService,
    @InjectRepository(LaytimeCalculation)
    private readonly calculations: Repository<LaytimeCalculation>,
  ) {}

  async findAll(
    query: ListBulkDisputesQueryDto,
  ): Promise<Paginated<DisputeCaseBulk>> {
    const organizationId = this.tenantContext.getOrganizationId();
    const builder = this.disputes
      .createQueryBuilder('dispute')
      .innerJoin('dispute.voyage', 'voyage')
      .andWhere('voyage.organizationId = :organizationId', { organizationId })
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
    const dispute = await this.disputes.findOne({
      where: { id },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    await this.voyagesService.ensureExists(dispute.voyageId);

    return dispute;
  }

  async create(dto: CreateBulkDisputeDto): Promise<DisputeCaseBulk> {
    await this.voyagesService.ensureExists(dto.voyageId);
    const claimCurrency = await this.assertClaimableLaytimeSettlement(dto);

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
        currency: claimCurrency,
        status: dto.status,
      }),
    );
  }

  private async assertClaimableLaytimeSettlement(
    dto: CreateBulkDisputeDto,
  ): Promise<SettlementCurrency> {
    const calculation = await this.calculations.findOne({
      where: {
        voyageId: dto.voyageId,
        parentCalculationId: IsNull(),
      },
      order: { version: 'DESC' },
    });
    const settlementStatus = readReversibleSettlementStatus(
      calculation?.decisionSnapshot,
    );
    const nonReversibleSettlement =
      calculation?.decisionSnapshot?.nonReversibleSettlement;
    const reversibleRule = calculation?.decisionSnapshot?.reversibleLaytimeRule;
    const historicalReversibleEnabled =
      !settlementStatus &&
      reversibleRule !== null &&
      typeof reversibleRule === 'object' &&
      !Array.isArray(reversibleRule) &&
      (reversibleRule as Record<string, unknown>).enabled === true;
    if (nonReversibleSettlement || (!settlementStatus && !historicalReversibleEnabled)) {
      if (!calculation?.currency) {
        throw new ConflictException(
          'LAYTIME_CALCULATION_CURRENCY_REQUIRED: New non-reversible claims require an authoritative calculation currency.',
        );
      }
      throw new ConflictException(
        'LAYTIME_OPERATION_CLAIM_LINK_REQUIRED: New non-reversible claims require an operation-linked authoritative source calculation.',
      );
    }

    if (!calculation?.currency) {
      throw new ConflictException(
        'LAYTIME_CALCULATION_CURRENCY_REQUIRED: A new claim requires authoritative calculation currency.',
      );
    }

    if (settlementStatus !== 'FINAL_AUTHORITATIVE') {
      throw new ConflictException(
        `A claim cannot be created because the reversible settlement is ${settlementStatus ?? 'LEGACY'} and is not final and authoritative.`,
      );
    }
    if (calculation?.status !== 'Final') {
      throw new ConflictException(
        'A final authoritative reversible settlement must be finalized before a claim can be created.',
      );
    }

    const settlement = calculation.decisionSnapshot?.reversibleSettlement as
      | Record<string, unknown>
      | undefined;
    const expectedAmount =
      dto.type === 'demurrage_counter'
        ? settlement?.demurrageAmount
        : settlement?.despatchAmount;
    if (
      typeof expectedAmount !== 'number' ||
      Math.abs(expectedAmount - dto.amountDisputed) >= 0.005
    ) {
      throw new BadRequestException(
        'The claim amount must match the finalized authoritative reversible settlement.',
      );
    }

    return calculation.currency;
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
