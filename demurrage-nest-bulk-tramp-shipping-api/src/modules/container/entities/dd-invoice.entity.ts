import { Column, CreateDateColumn, Entity, OneToMany } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { DdInvoiceLine } from './dd-invoice-line.entity';
import { DisputeCaseContainer } from './dispute-case-container.entity';

@Entity('dd_invoices')
export class DdInvoice extends UuidEntity {
  @Column({ name: 'carrier_name', type: 'varchar', length: 100 })
  carrierName!: string;

  @Column({ name: 'invoice_date', type: 'timestamptz' })
  invoiceDate!: Date;

  @Column({ name: 'due_date', type: 'timestamptz' })
  dueDate!: Date;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  totalAmount!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => DdInvoiceLine, (line) => line.invoice)
  lines?: DdInvoiceLine[];

  @OneToMany(() => DisputeCaseContainer, (dispute) => dispute.invoice)
  disputes?: DisputeCaseContainer[];
}
