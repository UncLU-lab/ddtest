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

export const VOYAGE_STATUSES = [
  'Planned',
  'Active',
  'Completed',
  'Cancelled',
] as const;
export type VoyageStatus = (typeof VOYAGE_STATUSES)[number];

@Entity('voyages')
@Check(
  'chk_voyages_status',
  `"status" IN (${VOYAGE_STATUSES.map((status) => `'${status}'`).join(', ')})`,
)
@Index('idx_voyages_vessel', ['vesselId'])
@Index('idx_voyages_status', ['status'])
@Index('idx_voyages_ports', ['loadPort', 'dischargePort'])
export class Voyage extends UuidEntity {
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

  @Column({
    type: 'varchar',
    length: 20,
    default: 'Planned',
  })
  status!: VoyageStatus;

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
}
