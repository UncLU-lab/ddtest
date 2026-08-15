import { Column, Entity, Index, OneToMany } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { FreeTimeClock } from './free-time-clock.entity';

export interface TariffTier {
  day_range_from: number;
  day_range_to: number | null;
  rate: number;
}

@Entity('carrier_tariffs')
@Index('idx_tariffs_carrier_port', ['carrierName', 'port'])
export class CarrierTariff extends UuidEntity {
  @Column({ name: 'carrier_name', type: 'varchar', length: 100 })
  carrierName!: string;

  @Column({
    name: 'contract_ref',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  contractRef?: string | null;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Column({ type: 'varchar', length: 10 })
  port!: string;

  @Column({ name: 'free_time_days', type: 'integer' })
  freeTimeDays!: number;

  @Column({ name: 'detention_tiers', type: 'jsonb' })
  detentionTiers!: TariffTier[];

  @Column({ name: 'demurrage_tiers', type: 'jsonb', nullable: true })
  demurrageTiers?: TariffTier[] | null;

  @OneToMany(() => FreeTimeClock, (clock) => clock.tariff)
  freeTimeClocks?: FreeTimeClock[];
}
