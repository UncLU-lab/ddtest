import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import type { DisputeStatus } from '../../bulk/entities/dispute-case-bulk.entity';
import { DdInvoice } from './dd-invoice.entity';

@Entity('dispute_cases_container')
@Index('idx_container_disputes_invoice', ['invoiceId'])
@Index('idx_container_disputes_status', ['status'])
export class DisputeCaseContainer extends UuidEntity {
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => DdInvoice, (invoice) => invoice.disputes)
  @JoinColumn({ name: 'invoice_id' })
  invoice!: DdInvoice;

  @Column({
    name: 'amount_disputed',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amountDisputed!: string;

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
