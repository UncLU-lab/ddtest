import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Voyage } from './voyage.entity';
import type { SettlementCurrency } from '../currency/settlement-currency';

export const BULK_DISPUTE_TYPES = [
  'demurrage_counter',
  'despatch_claim',
] as const;
export type BulkDisputeType = (typeof BULK_DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = [
  'Open',
  'Evidence Submitted',
  'In Negotiation',
  'Resolved',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

@Entity('dispute_cases_bulk')
@Index('idx_disputes_voyage', ['voyageId'])
@Index('idx_disputes_status', ['status'])
export class DisputeCaseBulk extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage, (voyage) => voyage.disputes)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ type: 'varchar', length: 20 })
  type!: BulkDisputeType;

  @Column({
    name: 'amount_disputed',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amountDisputed!: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency?: SettlementCurrency | null;

  @Column({ type: 'varchar', length: 30, default: 'Open' })
  status!: DisputeStatus;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate!: Date;

  @Column({ name: 'resolved_date', type: 'timestamptz', nullable: true })
  resolvedDate?: Date | null;

  @Column({
    name: 'final_settlement_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  finalSettlementAmount?: string | null;
}
