import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { LaytimeCalculation } from './laytime-calculation.entity';
import { Voyage } from './voyage.entity';
import type { LaytimeSettlementAuthorityStatus } from '../laytime-calculations/laytime-settlement-authority';
import type { SettlementCurrency } from '../currency/settlement-currency';

@Entity('laytime_statements')
@Index('uq_laytime_statements_source_calculation', ['sourceCalculationId'], {
  unique: true,
})
@Index('uq_laytime_statements_voyage_version', ['voyageId', 'version'], {
  unique: true,
})
@Index('idx_laytime_statements_voyage', ['voyageId'])
export class LaytimeStatement extends UuidEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ name: 'charter_party_id', type: 'uuid', nullable: true })
  charterPartyId?: string | null;

  @Column({ name: 'source_calculation_id', type: 'uuid' })
  sourceCalculationId!: string;

  @ManyToOne(() => LaytimeCalculation)
  @JoinColumn({ name: 'source_calculation_id' })
  sourceCalculation!: LaytimeCalculation;

  @Column({ name: 'source_calculation_version', type: 'integer' })
  sourceCalculationVersion!: number;

  @Column({ name: 'loading_calculation_id', type: 'uuid', nullable: true })
  loadingCalculationId?: string | null;

  @Column({ name: 'discharge_calculation_id', type: 'uuid', nullable: true })
  dischargeCalculationId?: string | null;

  @Column({ name: 'authoritative_sof_document_ids', type: 'jsonb' })
  authoritativeSofDocumentIds!: string[];

  @Column({ name: 'settlement_authority_status', type: 'varchar', length: 30 })
  settlementAuthorityStatus!: LaytimeSettlementAuthorityStatus;

  @Column({ type: 'varchar', length: 3 })
  currency!: SettlementCurrency;

  @Column({ type: 'integer' })
  version!: number;

  /** Stable commercial/evidence presentation snapshot for this statement. */
  @Column({ name: 'statement_snapshot', type: 'jsonb' })
  statementSnapshot!: Record<string, unknown>;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
