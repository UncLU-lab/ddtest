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
import { Vessel } from '../../bulk/entities/vessel.entity';
import { ShipmentContainer } from './shipment-container.entity';

@Entity('shipments')
@Index('idx_shipments_booking', ['bookingRef'])
@Index('idx_shipments_consignee', ['consignee'])
export class Shipment extends UuidEntity {
  @Column({ name: 'booking_ref', type: 'varchar', length: 100 })
  bookingRef!: string;

  @Column({
    name: 'bill_of_lading',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  billOfLading?: string | null;

  @Column({ type: 'varchar', length: 10 })
  origin!: string;

  @Column({ type: 'varchar', length: 10 })
  destination!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  consignee?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  shipper?: string | null;

  @Column({ name: 'vessel_id', type: 'uuid', nullable: true })
  vesselId?: string | null;

  @ManyToOne(() => Vessel, (vessel) => vessel.shipments, { nullable: true })
  @JoinColumn({ name: 'vessel_id' })
  vessel?: Vessel | null;

  @Column({ name: 'voyage_ref', type: 'varchar', length: 50, nullable: true })
  voyageRef?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(
    () => ShipmentContainer,
    (shipmentContainer) => shipmentContainer.shipment,
  )
  containerLinks?: ShipmentContainer[];
}
