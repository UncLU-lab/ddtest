import { Column, CreateDateColumn, Entity, Index, OneToMany } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { ContainerMilestone } from './container-milestone.entity';
import { DdInvoiceLine } from './dd-invoice-line.entity';
import { FreeTimeClock } from './free-time-clock.entity';
import { ShipmentContainer } from './shipment-container.entity';

@Entity('containers')
@Index('idx_containers_number', ['containerNumber'])
export class Container extends UuidEntity {
  @Column({
    name: 'container_number',
    type: 'varchar',
    length: 11,
    unique: true,
  })
  containerNumber!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(
    () => ShipmentContainer,
    (shipmentContainer) => shipmentContainer.container,
  )
  shipmentLinks?: ShipmentContainer[];

  @OneToMany(() => ContainerMilestone, (milestone) => milestone.container)
  milestones?: ContainerMilestone[];

  @OneToMany(() => FreeTimeClock, (clock) => clock.container)
  freeTimeClocks?: FreeTimeClock[];

  @OneToMany(() => DdInvoiceLine, (line) => line.container)
  invoiceLines?: DdInvoiceLine[];
}
