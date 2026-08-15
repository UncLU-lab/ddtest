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

  /** Immutable source data used when this calculation was created. */
  @Column({ name: 'input_snapshot', type: 'jsonb', nullable: true, update: false })
  inputSnapshot?: Record<string, unknown> | null;

  /** Immutable engine decisions and derived timeline for audit and explanation. */
  @Column({ name: 'decision_snapshot', type: 'jsonb', nullable: true, update: false })
  decisionSnapshot?: Record<string, unknown> | null;

  /** Non-fatal engine and source-selection notes captured at calculation time. */
  @Column({ type: 'jsonb', nullable: true, update: false })
  warnings?: string[] | null;

  /** Identifies the deterministic laytime rule set used for this calculation. */
  @Column({ name: 'engine_version', type: 'varchar', length: 50, nullable: true, update: false })
  engineVersion?: string | null;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt!: Date;

  @OneToMany(() => CalculationPeriod, (period) => period.calculation)
  periods?: CalculationPeriod[];
}
