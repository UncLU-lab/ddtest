import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { SofEvent } from './sof-event.entity';
import { Voyage } from './voyage.entity';

export const SOF_DOCUMENT_STATUSES = ['Draft', 'Final'] as const;
export type SofDocumentStatus = (typeof SOF_DOCUMENT_STATUSES)[number];

export const SOF_DOCUMENT_OPERATIONS = ['Loading', 'Discharge'] as const;
export type SofDocumentOperation = (typeof SOF_DOCUMENT_OPERATIONS)[number];

@Entity('sof_documents')
@Index('idx_sof_documents_voyage', ['voyageId'])
export class SofDocument extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage, (voyage) => voyage.sofDocuments)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @CreateDateColumn({ name: 'upload_date', type: 'timestamptz' })
  uploadDate!: Date;

  @Column({ type: 'varchar', length: 20, default: 'Draft' })
  status!: SofDocumentStatus;

  @Column({ name: 'operation', type: 'varchar', length: 20, nullable: true })
  operation?: SofDocumentOperation | null;

  @OneToMany(() => SofEvent, (event) => event.sofDocument)
  events?: SofEvent[];
}
