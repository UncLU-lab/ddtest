import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { CpClause } from '../entities/cp-clause.entity';
import { Voyage } from '../entities/voyage.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateCharterPartyDto } from './dto/create-charter-party.dto';
import { CreateCpClauseDto } from './dto/create-cp-clause.dto';
import { UpdateCharterPartyDto } from './dto/update-charter-party.dto';
import { UpdateCpClauseDto } from './dto/update-cp-clause.dto';

@Injectable()
export class CharterPartiesService {
  constructor(
    @InjectRepository(CharterParty)
    private readonly charterParties: Repository<CharterParty>,
    @InjectRepository(CpClause)
    private readonly clauses: Repository<CpClause>,
    private readonly voyagesService: VoyagesService,
    private readonly dataSource: DataSource,
  ) {}

  async findForVoyage(voyageId: string): Promise<CharterParty> {
    await this.voyagesService.ensureExists(voyageId);

    const charterParty = await this.charterParties.findOne({
      where: { voyageId },
      relations: { clauses: true },
    });

    if (!charterParty) {
      throw new NotFoundException(
        `Voyage ${voyageId} has no charter party attached`,
      );
    }

    return charterParty;
  }

  /**
   * Attaches a charter party to a voyage, writing both sides of the link
   * (`charter_parties.voyage_id` and `voyages.charter_party_id`) in one transaction.
   */
  async createForVoyage(
    voyageId: string,
    dto: CreateCharterPartyDto,
  ): Promise<CharterParty> {
    await this.voyagesService.ensureExists(voyageId);

    const existing = await this.charterParties.findOne({
      where: { voyageId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Voyage ${voyageId} already has a charter party; update it instead`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const charterParty = await manager.save(
        manager.create(CharterParty, { ...dto, voyageId }),
      );

      await manager.update(Voyage, voyageId, {
        charterPartyId: charterParty.id,
      });

      return charterParty;
    });
  }

  async findOne(id: string): Promise<CharterParty> {
    const charterParty = await this.charterParties.findOne({
      where: { id },
      relations: { clauses: true },
    });

    if (!charterParty) {
      throw new NotFoundException(`Charter party ${id} not found`);
    }

    return charterParty;
  }

  async update(id: string, dto: UpdateCharterPartyDto): Promise<CharterParty> {
    const charterParty = await this.findOne(id);

    return this.charterParties.save(
      this.charterParties.merge(charterParty, dto),
    );
  }

  async findClauses(
    charterPartyId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<CpClause>> {
    await this.findOne(charterPartyId);

    const result = await this.clauses.findAndCount({
      where: { charterPartyId },
      order: { clauseType: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(result, query);
  }

  async addClause(
    charterPartyId: string,
    dto: CreateCpClauseDto,
  ): Promise<CpClause> {
    await this.findOne(charterPartyId);

    return this.clauses.save(this.clauses.create({ ...dto, charterPartyId }));
  }

  async updateClause(id: string, dto: UpdateCpClauseDto): Promise<CpClause> {
    const clause = await this.clauses.findOne({ where: { id } });

    if (!clause) {
      throw new NotFoundException(`Clause ${id} not found`);
    }

    return this.clauses.save(this.clauses.merge(clause, dto));
  }

  /**
   * Removes a clause unless it is cited by a final calculation period. Draft
   * calculations can lose the live relation; final calculation evidence cannot.
   */
  async removeClause(id: string): Promise<void> {
    const clause = await this.clauses.findOne({ where: { id } });

    if (!clause) {
      throw new NotFoundException(`Clause ${id} not found`);
    }

    await this.dataSource.transaction(async (manager) => {
      const finalPeriod = await manager
        .createQueryBuilder(CalculationPeriod, 'period')
        .innerJoin('period.calculation', 'calculation')
        .where('period.appliedClauseId = :id', { id })
        .andWhere('calculation.status = :status', { status: 'Final' })
        .getOne();

      if (finalPeriod) {
        throw new ConflictException(
          `Clause ${id} is referenced by a final laytime calculation and cannot be removed`,
        );
      }

      await manager.update(
        CalculationPeriod,
        { appliedClauseId: id },
        { appliedClauseId: null },
      );
      await manager.remove(clause);
    });
  }
}
