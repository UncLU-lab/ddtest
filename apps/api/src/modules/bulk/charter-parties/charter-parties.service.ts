import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { Paginated, paginate } from '../../../common/dto/paginated';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CalculationPeriod } from '../entities/calculation-period.entity';
import { CharterParty } from '../entities/charter-party.entity';
import { CpClause } from '../entities/cp-clause.entity';
import { Voyage } from '../entities/voyage.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { CreateCharterPartyDto } from './dto/create-charter-party.dto';
import { CreateCpClauseDto } from './dto/create-cp-clause.dto';
import { UpdateCharterPartyDto } from './dto/update-charter-party.dto';
import { UpdateCpClauseDto } from './dto/update-cp-clause.dto';
import {
  areCpClauseParametersValid,
  cpClauseParametersValidationMessage,
} from './dto/cp-clause-parameters.validator';
import { readExplicitNotice } from '../laytime/commencement-rule';
import { parseNoticeHours } from '../charter-party-terms';

@Injectable()
export class CharterPartiesService {
  constructor(
    @InjectRepository(CharterParty)
    private readonly charterParties: Repository<CharterParty>,
    @InjectRepository(CpClause)
    private readonly clauses: Repository<CpClause>,
    private readonly voyagesService: VoyagesService,
    private readonly databaseContext: TenantDatabaseContextService,
    private readonly tenantContext: TenantContextService,
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

    return this.databaseContext.transaction(async (manager) => {
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

    await this.voyagesService.ensureExists(charterParty.voyageId);

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
    const charterParty = await this.findOne(charterPartyId);
    this.assertClauseContract(dto.clauseType, dto.parameters);
    this.assertCommencementRulesCompatible(
      [...(charterParty.clauses ?? []), dto],
      charterParty.norNoticePeriod,
    );
    this.assertReversibleClausesUnambiguous([
      ...(charterParty.clauses ?? []),
      dto,
    ]);

    return this.clauses.save(this.clauses.create({ ...dto, charterPartyId }));
  }

  async updateClause(id: string, dto: UpdateCpClauseDto): Promise<CpClause> {
    const clause = await this.clauses.findOne({
      where: { id },
      relations: { charterParty: true },
    });

    if (!clause) {
      throw new NotFoundException(`Clause ${id} not found`);
    }

    await this.voyagesService.ensureExists(clause.charterParty.voyageId);

    const mergedClause = {
      ...clause,
      ...dto,
      parameters: dto.parameters ?? clause.parameters,
    };
    this.assertClauseContract(mergedClause.clauseType, mergedClause.parameters);
    const charterParty = await this.findOne(clause.charterPartyId);
    this.assertCommencementRulesCompatible(
      [
        ...(charterParty.clauses ?? []).filter(
          (existingClause) => existingClause.id !== clause.id,
        ),
        mergedClause,
      ],
      charterParty.norNoticePeriod,
    );
    this.assertReversibleClausesUnambiguous([
      ...(charterParty.clauses ?? []).filter(
        (existingClause) => existingClause.id !== clause.id,
      ),
      mergedClause,
    ]);

    return this.clauses.save(this.clauses.merge(clause, dto));
  }

  private assertClauseContract(
    clauseType: string,
    parameters: Record<string, unknown>,
  ): void {
    if (!areCpClauseParametersValid(clauseType, parameters)) {
      throw new BadRequestException(
        cpClauseParametersValidationMessage(clauseType),
      );
    }
  }

  private assertCommencementRulesCompatible(
    clauses: Array<Pick<CpClause, 'clauseType' | 'parameters'>>,
    charterPartyNoticePeriod?: string | null,
  ): void {
    const hasSchedule = clauses.some(
      (clause) => clause.clauseType === 'nor_commencement_schedule',
    );
    const hasExplicitNotice =
      parseNoticeHours(charterPartyNoticePeriod) !== undefined ||
      clauses.some(
        (clause) =>
          clause.clauseType === 'laytime_rate' &&
          readExplicitNotice(clause.parameters) !== null,
      );

    if (hasSchedule && hasExplicitNotice) {
      throw new ConflictException(
        'The Charter Party cannot contain both explicit notice hours and a NOR commencement schedule; remove one commencement rule before saving.',
      );
    }
  }

  private assertReversibleClausesUnambiguous(
    clauses: Array<Pick<CpClause, 'clauseType' | 'parameters'>>,
  ): void {
    const activeReversibleClauses = clauses.filter(
      (clause) =>
        clause.clauseType === 'reversible_laytime' &&
        clause.parameters.enabled === true,
    );
    if (activeReversibleClauses.length > 1) {
      throw new ConflictException(
        'The Charter Party cannot contain multiple active reversible laytime settlement clauses.',
      );
    }
  }

  /**
   * Removes a clause unless it is cited by a final calculation period. Draft
   * calculations can lose the live relation; final calculation evidence cannot.
   */
  async removeClause(id: string): Promise<void> {
    const clause = await this.clauses.findOne({
      where: { id },
      relations: { charterParty: true },
    });

    if (!clause) {
      throw new NotFoundException(`Clause ${id} not found`);
    }

    await this.voyagesService.ensureExists(clause.charterParty.voyageId);

    await this.databaseContext.transaction(async (manager) => {
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
