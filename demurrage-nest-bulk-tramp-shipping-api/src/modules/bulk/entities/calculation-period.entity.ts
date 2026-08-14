import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { CpClause } from './cp-clause.entity';
import { LaytimeCalculation } from './laytime-calculation.entity';

export const CALCULATION_PERIOD_TYPES = [
  'laytime',
  'exception',
  'demurrage',
] as const;
export type CalculationPeriodType = (typeof CALCULATION_PERIOD_TYPES)[number];

@Entity('calculation_periods')
@Index('idx_calc_periods_calc', ['calculationId'])
export class CalculationPeriod extends UuidEntity {
  @Column({ name: 'calculation_id', type: 'uuid' })
  calculationId!: string;

  @ManyToOne(() => LaytimeCalculation, (calculation) => calculation.periods)
  @JoinColumn({ name: 'calculation_id' })
  calculation!: LaytimeCalculation;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @Column({ name: 'period_type', type: 'varchar', length: 20 })
  periodType!: CalculationPeriodType;

  @Column({ name: 'applied_clause_id', type: 'uuid', nullable: true })
  appliedClauseId?: string | null;

  @ManyToOne(() => CpClause, (clause) => clause.calculationPeriods, {
    nullable: true,
  })
  @JoinColumn({ name: 'applied_clause_id' })
  appliedClause?: CpClause | null;
}
