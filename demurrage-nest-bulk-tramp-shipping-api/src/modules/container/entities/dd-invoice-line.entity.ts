import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Container } from './container.entity';
import { DdInvoice } from './dd-invoice.entity';

export type DdChargeType = 'detention' | 'demurrage';

@Entity('dd_invoice_lines')
@Index('idx_invoice_lines_invoice', ['invoiceId'])
@Index('idx_invoice_lines_container', ['containerId'])
export class DdInvoiceLine extends UuidEntity {
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => DdInvoice, (invoice) => invoice.lines)
  @JoinColumn({ name: 'invoice_id' })
  invoice!: DdInvoice;

  @Column({ name: 'container_id', type: 'uuid' })
  containerId!: string;

  @ManyToOne(() => Container, (container) => container.invoiceLines)
  @JoinColumn({ name: 'container_id' })
  container!: Container;

  @Column({ name: 'charge_type', type: 'varchar', length: 20 })
  chargeType!: DdChargeType;

  @Column({ name: 'claimed_days', type: 'integer' })
  claimedDays!: number;

  @Column({
    name: 'claimed_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  claimedRate!: string;

  @Column({
    name: 'claimed_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  claimedAmount!: string;
}
