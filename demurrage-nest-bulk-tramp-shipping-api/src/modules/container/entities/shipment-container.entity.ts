import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Container } from './container.entity';
import { Shipment } from './shipment.entity';

@Entity('shipment_containers')
@Index('idx_ship_cont_shipment', ['shipmentId'])
@Index('idx_ship_cont_container', ['containerId'])
export class ShipmentContainer extends UuidEntity {
  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId!: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.containerLinks)
  @JoinColumn({ name: 'shipment_id' })
  shipment!: Shipment;

  @Column({ name: 'container_id', type: 'uuid' })
  containerId!: string;

  @ManyToOne(() => Container, (container) => container.shipmentLinks)
  @JoinColumn({ name: 'container_id' })
  container!: Container;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;
}
