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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => CpClause, (clause) => clause.charterParty)
  clauses?: CpClause[];
}
