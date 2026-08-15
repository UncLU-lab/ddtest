import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { LaytimeCalculation } from '../entities/laytime-calculation.entity';
import { NorDocument } from '../entities/nor-document.entity';
import { SofDocument } from '../entities/sof-document.entity';
import { SofEvent } from '../entities/sof-event.entity';
import { runLaytimeEngine } from '../laytime/laytime.engine';
import { LaytimeEngineError } from '../laytime/laytime.types';
import { secondsToInterval } from '../laytime/interval.util';
import { VoyagesService } from '../voyages/voyages.service';

/** A calculation plus the engine notes that produced it. */
export interface CalculationResult {
  calculation: LaytimeCalculation;
  warnings: string[];
}

@Injectable()
export class LaytimeCalculationsService {
  constructor(
    @InjectRepository(LaytimeCalculation)
    private readonly calculations: Repository<LaytimeCalculation>,
    @InjectRepository(CalculationPeriod)
    private readonly periods: Repository<CalculationPeriod>,
    @InjectRepository(CharterParty)
    private readonly charterParties: Repository<CharterParty>,
    @InjectRepository(NorDocument)
    private readonly norDocuments: Repository<NorDocument>,
    @InjectRepository(SofDocument)
    private readonly sofDocuments: Repository<SofDocument>,
    @InjectRepository(SofEvent)
    private readonly sofEvents: Repository<SofEvent>,
    private readonly voyagesService: VoyagesService,
    private readonly dataSource: DataSource,
  ) {}

  async findForVoyage(
    voyageId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<LaytimeCalculation>> {
    await this.voyagesService.ensureExists(voyageId);

    const result = await this.calculations.findAndCount({
      where: { voyageId },
      order: { version: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async findOne(id: string): Promise<LaytimeCalculation> {
    const calculation = await this.calculations.findOne({ where: { id } });

    if (!calculation) {
      throw new NotFoundException(`Laytime calculation ${id} not found`);
    }

    return calculation;
  }

  async findPeriods(
    calculationId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<CalculationPeriod>> {
    await this.findOne(calculationId);

    const result = await this.periods.findAndCount({
      where: { calculationId },
      relations: { appliedClause: true },
      order: { startTime: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  /**
   * Runs the laytime engine over the voyage's NOR, SOF events and charter-party
   * clauses, then persists the result as the next version.
   */
  async calculate(voyageId: string): Promise<CalculationResult> {
    const voyage = await this.voyagesService.ensureExists(voyageId);
    const warnings: string[] = [];

    const charterParty = await this.charterParties.findOne({
      where: { voyageId },
      relations: { clauses: true },
    });

    if (!charterParty) {
      throw new UnprocessableEntityException(
        `Voyage ${voyageId} has no charter party; attach one before calculating laytime`,
      );
    }

    const [norDocuments, sofEvents] = await Promise.all([
      this.norDocuments.find({ where: { voyageId } }),
      this.loadSofEvents(voyageId, warnings),
    ]);

    let result;
    try {
      result = runLaytimeEngine({
        cargoQuantity: Number(voyage.cargoQuantity),
        clauses: charterParty.clauses ?? [],
        norDocuments,
        sofEvents,
      });
    } catch (error) {
      if (error instanceof LaytimeEngineError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    const calculation = await this.dataSource.transaction(async (manager) => {
      const { maximum } = (await manager
        .createQueryBuilder(LaytimeCalculation, 'calculation')
        .select('MAX(calculation.version)', 'maximum')
        .where('calculation.voyageId = :voyageId', { voyageId })
        .getRawOne<{ maximum: number | null }>()) ?? { maximum: null };

      const saved = await manager.save(
        manager.create(LaytimeCalculation, {
          voyageId,
          version: (maximum ?? 0) + 1,
          allowedLaytime: secondsToInterval(result.allowedSeconds),
          usedLaytime: secondsToInterval(result.usedSeconds),
          demurrageAmount: result.demurrageAmount.toFixed(2),
          despatchAmount: result.despatchAmount.toFixed(2),
          status: 'Draft' as const,
        }),
      );

      await manager.save(
        result.periods.map((period) =>
          manager.create(CalculationPeriod, {
            calculationId: saved.id,
            startTime: period.startTime,
            endTime: period.endTime,
            periodType: period.periodType,
            appliedClauseId: period.appliedClauseId,
          }),
        ),
      );

      return manager.findOneOrFail(LaytimeCalculation, {
        where: { id: saved.id },
        relations: { periods: true },
      });
    });

    return { calculation, warnings: [...warnings, ...result.warnings] };
  }

  async finalize(id: string): Promise<LaytimeCalculation> {
    const calculation = await this.findOne(id);

    if (calculation.status === 'Final') {
      throw new ConflictException(`Laytime calculation ${id} is already final`);
    }

    calculation.status = 'Final';

    return this.calculations.save(calculation);
  }

  /**
   * Prefers events from finalised SOFs; falls back to drafts so a voyage can be
   * calculated provisionally while the paperwork is still being agreed.
   */
  private async loadSofEvents(
    voyageId: string,
    warnings: string[],
  ): Promise<SofEvent[]> {
    const documents = await this.sofDocuments.find({
      where: { voyageId },
      select: { id: true, status: true },
    });

    if (documents.length === 0) {
      throw new UnprocessableEntityException(
        `Voyage ${voyageId} has no Statement of Facts; upload one before calculating laytime`,
      );
    }

    const finalDocuments = documents.filter(
      (document) => document.status === 'Final',
    );
    const source = finalDocuments.length > 0 ? finalDocuments : documents;

    if (finalDocuments.length === 0) {
      warnings.push(
        'No finalised Statement of Facts was available; the calculation used draft SOF events.',
      );
    }

    return this.sofEvents.find({
      where: { sofId: In(source.map((document) => document.id)) },
      order: { eventTime: 'ASC' },
    });
  }
}
