import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { CalculationPeriod } from './calculation-period.entity';
import { CharterParty } from './charter-party.entity';

@Entity('cp_clauses')
@Index('idx_cp_clauses_cp', ['charterPartyId'])
@Index('idx_cp_clauses_type', ['clauseType'])
export class CpClause extends UuidEntity {
  @Column({ name: 'charter_party_id', type: 'uuid' })
  charterPartyId!: string;

  @ManyToOne(() => CharterParty, (charterParty) => charterParty.clauses)
  @JoinColumn({ name: 'charter_party_id' })
  charterParty!: CharterParty;

  @Column({ name: 'clause_type', type: 'varchar', length: 50 })
  clauseType!: string;

  @Column({ name: 'raw_text', type: 'text' })
  rawText!: string;

  @Column({ type: 'jsonb' })
  parameters!: Record<string, unknown>;

  @OneToMany(() => CalculationPeriod, (period) => period.appliedClause)
  calculationPeriods?: CalculationPeriod[];
}
