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
import { intervalTransformer } from '../laytime/interval.util';
import { CalculationPeriod } from './calculation-period.entity';
import { Voyage } from './voyage.entity';

export const LAYTIME_CALCULATION_STATUSES = ['Draft', 'Final'] as const;
export type LaytimeCalculationStatus =
  (typeof LAYTIME_CALCULATION_STATUSES)[number];

@Entity('laytime_calculations')
@Index('idx_laytime_calc_voyage', ['voyageId'])
export class LaytimeCalculation extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage, (voyage) => voyage.laytimeCalculations)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({
    name: 'allowed_laytime',
    type: 'interval',
    transformer: intervalTransformer,
  })
  allowedLaytime!: string;

  @Column({
    name: 'used_laytime',
    type: 'interval',
    transformer: intervalTransformer,
  })
  usedLaytime!: string;

  @Column({
    name: 'demurrage_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  demurrageAmount!: string;

  @Column({
    name: 'despatch_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  despatchAmount!: string;

  @Column({ type: 'varchar', length: 20, default: 'Draft' })
  status!: LaytimeCalculationStatus;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt!: Date;

  @OneToMany(() => CalculationPeriod, (period) => period.calculation)
  periods?: CalculationPeriod[];
}
