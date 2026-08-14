import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { CarrierTariff } from './carrier-tariff.entity';
import { Container } from './container.entity';

export type FreeTimeClockStatus = 'Active' | 'Closed';

@Entity('free_time_clocks')
@Index('idx_clocks_container', ['containerId'])
@Index('idx_clocks_status_expiry', ['status', 'expiryTime'])
export class FreeTimeClock extends UuidEntity {
  @Column({ name: 'container_id', type: 'uuid' })
  containerId!: string;

  @ManyToOne(() => Container, (container) => container.freeTimeClocks)
  @JoinColumn({ name: 'container_id' })
  container!: Container;

  @Column({ name: 'tariff_id', type: 'uuid' })
  tariffId!: string;

  @ManyToOne(() => CarrierTariff, (tariff) => tariff.freeTimeClocks)
  @JoinColumn({ name: 'tariff_id' })
  tariff!: CarrierTariff;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'expiry_time', type: 'timestamptz' })
  expiryTime!: Date;

  @Column({ name: 'free_time_used', type: 'interval', default: '0' })
  freeTimeUsed!: string;

  @Column({
    name: 'demurrage_accrued',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  demurrageAccrued!: string;

  @Column({
    name: 'detention_accrued',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  detentionAccrued!: string;

  @Column({ type: 'varchar', length: 20, default: 'Active' })
  status!: FreeTimeClockStatus;
}
