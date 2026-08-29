import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { User } from '../../cross-cutting/entities/user.entity';
import { NorDocument } from './nor-document.entity';
import { SofDocument } from './sof-document.entity';
import { SofEvent } from './sof-event.entity';
import { Voyage } from './voyage.entity';

export const NOR_LOCATION_OPERATIONS = ['Loading', 'Discharge'] as const;
export type NorLocationOperation = (typeof NOR_LOCATION_OPERATIONS)[number];

export const NOR_PORT_RELATIONS = [
  'INSIDE_PORT_LIMITS',
  'OUTSIDE_PORT_LIMITS',
  'UNKNOWN',
] as const;
export type NorPortRelation = (typeof NOR_PORT_RELATIONS)[number];

export const NOR_BERTH_RELATIONS = [
  'AT_BERTH',
  'NOT_AT_BERTH',
  'UNKNOWN',
] as const;
export type NorBerthRelation = (typeof NOR_BERTH_RELATIONS)[number];

export const NOR_WAITING_PLACES = [
  'ANCHORAGE',
  'PILOT_STATION',
  'CUSTOMARY_WAITING_PLACE',
  'OTHER',
  'NONE',
  'UNKNOWN',
] as const;
export type NorWaitingPlace = (typeof NOR_WAITING_PLACES)[number];

export const NOR_LOCATION_EVIDENCE_SOURCES = [
  'MANUAL',
  'SOF',
  'OCR',
  'AIS',
] as const;
export type NorLocationEvidenceSource =
  (typeof NOR_LOCATION_EVIDENCE_SOURCES)[number];

@Entity('nor_tender_location_evidence')
@Check(
  'chk_nor_location_single_candidate',
  'num_nonnulls("nor_document_id", "nor_tendered_event_id") <= 1',
)
@Index('idx_nor_location_voyage_operation_time', [
  'voyageId',
  'operation',
  'evidenceTime',
])
@Index('idx_nor_location_nor_document', ['norDocumentId'])
@Index('idx_nor_location_nor_event', ['norTenderedEventId'])
@Index('idx_nor_location_sof_document', ['sofDocumentId'])
export class NorTenderLocationEvidence extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ type: 'varchar', length: 20 })
  operation!: NorLocationOperation;

  @Column({ name: 'evidence_time', type: 'timestamptz' })
  evidenceTime!: Date;

  /** Source-local timezone used to interpret this observation; null for legacy rows. */
  @Column({
    name: 'source_time_zone',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sourceTimeZone?: string | null;

  @Column({ name: 'port_relation', type: 'varchar', length: 30 })
  portRelation!: NorPortRelation;

  @Column({ name: 'berth_relation', type: 'varchar', length: 20 })
  berthRelation!: NorBerthRelation;

  @Column({ name: 'waiting_place', type: 'varchar', length: 30 })
  waitingPlace!: NorWaitingPlace;

  @Column({ type: 'varchar', length: 20 })
  source!: NorLocationEvidenceSource;

  @Column({ name: 'sof_document_id', type: 'uuid', nullable: true })
  sofDocumentId?: string | null;

  @ManyToOne(() => SofDocument, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sof_document_id' })
  sofDocument?: SofDocument | null;

  @Column({
    name: 'source_reference',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  sourceReference?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'nor_document_id', type: 'uuid', nullable: true })
  norDocumentId?: string | null;

  @ManyToOne(() => NorDocument, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'nor_document_id' })
  norDocument?: NorDocument | null;

  @Column({ name: 'nor_tendered_event_id', type: 'uuid', nullable: true })
  norTenderedEventId?: string | null;

  @ManyToOne(() => SofEvent, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'nor_tendered_event_id' })
  norTenderedEvent?: SofEvent | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
