import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { CpClause } from './cp-clause.entity';
import { Voyage } from './voyage.entity';

@Entity('charter_parties')
@Index('idx_charter_parties_voyage', ['voyageId'])
export class CharterParty extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @OneToOne(() => Voyage, (voyage) => voyage.contractRecord)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ name: 'form_type', type: 'varchar', length: 50 })
  formType!: string;

  @Column({ name: 'full_text', type: 'text' })
  fullText!: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Column({
    name: 'laytime_allowed',
    type: 'integer',
    nullable: true,
  })
  laytimeAllowed?: number | null;

  @Column({
    name: 'demurrage_rate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  demurrageRate?: string | null;

  @Column({
    name: 'dispatch_rate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  dispatchRate?: string | null;

  @Column({
    name: 'time_counting_basis',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  timeCountingBasis?: string | null;

  @Column({
    name: 'nor_notice_period',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  norNoticePeriod?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => CpClause, (clause) => clause.charterParty)
  clauses?: CpClause[];
}
