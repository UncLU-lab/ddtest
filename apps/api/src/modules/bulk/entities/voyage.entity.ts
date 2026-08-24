import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { CharterParty } from './charter-party.entity';
import { DisputeCaseBulk } from './dispute-case-bulk.entity';
import { LaytimeCalculation } from './laytime-calculation.entity';
import { NorDocument } from './nor-document.entity';
import { SofDocument } from './sof-document.entity';
import { Vessel } from './vessel.entity';
import { Organization } from '../../cross-cutting/entities/organization.entity';
import { User } from '../../cross-cutting/entities/user.entity';
import { VoyageCounterparty } from './voyage-counterparty.entity';

export const VOYAGE_STATUSES = [
  'Planned',
  'Active',
  'Completed',
  'Cancelled',
] as const;
export type VoyageStatus = (typeof VOYAGE_STATUSES)[number];
export const CARGO_QUANTITY_UNITS = ['MT', 'BBL', 'M3'] as const;
export type CargoQuantityUnit = (typeof CARGO_QUANTITY_UNITS)[number];
export const LAYTIME_OPERATIONS = ['Loading', 'Discharge'] as const;
export type LaytimeOperation = (typeof LAYTIME_OPERATIONS)[number];
export const BULK_OPERATION_TYPES = ['dry_bulk', 'tanker'] as const;
export type BulkOperationType = (typeof BULK_OPERATION_TYPES)[number];

@Entity('voyages')
@Check(
  'chk_voyages_status',
  `"status" IN (${VOYAGE_STATUSES.map((status) => `'${status}'`).join(', ')})`,
)
@Check(
  'chk_voyages_bulk_operation_type',
  `"bulk_operation_type" IS NULL OR "bulk_operation_type" IN ('dry_bulk', 'tanker')`,
)
@Index('idx_voyages_vessel', ['vesselId'])
@Index('idx_voyages_status', ['status'])
@Index('idx_voyages_ports', ['loadPort', 'dischargePort'])
@Index('uq_voyages_organization_reference', ['organizationId', 'reference'], {
  unique: true,
})
@Index('idx_voyages_organization', ['organizationId'])
export class Voyage extends UuidEntity {
  @Column({
    name: 'organization_id',
    type: 'uuid',
  })
  organizationId!: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ type: 'varchar', length: 100 })
  reference!: string;

  @Column({ name: 'vessel_id', type: 'uuid' })
  vesselId!: string;

  @ManyToOne(() => Vessel, (vessel) => vessel.voyages)
  @JoinColumn({ name: 'vessel_id' })
  vessel!: Vessel;

  @Column({ name: 'charter_party_id', type: 'uuid', nullable: true })
  charterPartyId?: string | null;

  @OneToOne(() => CharterParty, { nullable: true })
  @JoinColumn({ name: 'charter_party_id' })
  charterParty?: CharterParty | null;

  @OneToOne(() => CharterParty, (charterParty) => charterParty.voyage)
  contractRecord?: CharterParty;

  @Column({
    name: 'cargo_quantity',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  cargoQuantity!: string;

  @Column({
    name: 'cargo_quantity_unit',
    type: 'varchar',
    length: 10,
    default: 'MT',
  })
  cargoQuantityUnit!: CargoQuantityUnit;

  @Column({ name: 'cargo_type', type: 'varchar', length: 100 })
  cargoType!: string;

  @Column({ name: 'load_port', type: 'varchar', length: 10 })
  loadPort!: string;

  @Column({ name: 'discharge_port', type: 'varchar', length: 10 })
  dischargePort!: string;

  @Column({ name: 'laycan_start', type: 'date' })
  laycanStart!: string;

  @Column({ name: 'laycan_end', type: 'date' })
  laycanEnd!: string;

  @Column({ type: 'timestamptz', nullable: true })
  eta?: Date | null;

  @Column({
    name: 'laytime_operation',
    type: 'varchar',
    length: 20,
    default: 'Discharge',
  })
  laytimeOperation!: LaytimeOperation;

  @Column({
    name: 'bulk_operation_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  bulkOperationType?: BulkOperationType | null;

  @Column({
    name: 'calculation_time_zone',
    type: 'varchar',
    length: 100,
    default: 'UTC',
  })
  calculationTimeZone!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'Planned',
  })
  status!: VoyageStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => SofDocument, (sofDocument) => sofDocument.voyage)
  sofDocuments?: SofDocument[];

  @OneToMany(() => NorDocument, (norDocument) => norDocument.voyage)
  norDocuments?: NorDocument[];

  @OneToMany(
    () => LaytimeCalculation,
    (laytimeCalculation) => laytimeCalculation.voyage,
  )
  laytimeCalculations?: LaytimeCalculation[];

  @OneToMany(() => DisputeCaseBulk, (dispute) => dispute.voyage)
  disputes?: DisputeCaseBulk[];

  @OneToMany(
    () => VoyageCounterparty,
    (voyageCounterparty) => voyageCounterparty.voyage,
  )
  counterpartyLinks?: VoyageCounterparty[];
}
