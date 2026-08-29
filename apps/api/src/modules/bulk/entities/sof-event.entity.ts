import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { SofDocument } from './sof-document.entity';

export const SOF_EVENT_OPERATIONS = ['Loading', 'Discharge'] as const;
export type SofEventOperation = (typeof SOF_EVENT_OPERATIONS)[number];

@Entity('sof_events')
@Index('idx_sof_events_sof_time', ['sofId', 'eventTime'])
@Index('idx_sof_events_type', ['eventType'])
export class SofEvent extends UuidEntity {
  @Column({ name: 'sof_id', type: 'uuid' })
  sofId!: string;

  @ManyToOne(() => SofDocument, (sofDocument) => sofDocument.events)
  @JoinColumn({ name: 'sof_id' })
  sofDocument!: SofDocument;

  @Column({ name: 'event_time', type: 'timestamptz' })
  eventTime!: Date;

  /** IANA timezone of the source document/civil timestamp; null for legacy events. */
  @Column({ name: 'source_time_zone', type: 'varchar', length: 100, nullable: true })
  sourceTimeZone?: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: string;

  @Column({ name: 'operation', type: 'varchar', length: 20, nullable: true })
  operation?: SofEventOperation | null;

  @Column({ type: 'text', nullable: true })
  remarks?: string | null;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  confidenceScore?: string | null;

  @Column({ name: 'is_manual_override', type: 'boolean', default: false })
  isManualOverride!: boolean;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
