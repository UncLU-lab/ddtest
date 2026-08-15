import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Voyage } from './voyage.entity';

@Entity('nor_documents')
@Index('idx_nor_voyage', ['voyageId'])
export class NorDocument extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage, (voyage) => voyage.norDocuments)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'tender_time', type: 'timestamptz' })
  tenderTime!: Date;

  @Column({ name: 'accepted_time', type: 'timestamptz', nullable: true })
  acceptedTime?: Date | null;
}
