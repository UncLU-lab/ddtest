import { Column, Entity, Index } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';

export const COUNTERPARTY_TYPES = ['owner', 'charterer'] as const;
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number];

@Entity('counterparties')
@Index('idx_counterparties_name', ['name'])
export class Counterparty extends UuidEntity {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: CounterpartyType;

  @Column({
    name: 'imo_company_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  imoCompanyId?: string | null;
}
