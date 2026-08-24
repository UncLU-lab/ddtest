import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Organization } from '../../cross-cutting/entities/organization.entity';
import { VoyageCounterparty } from './voyage-counterparty.entity';

export const COUNTERPARTY_TYPES = ['owner', 'charterer'] as const;
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number];
export const COUNTERPARTY_STATUSES = ['Active', 'Inactive'] as const;
export type CounterpartyStatus = (typeof COUNTERPARTY_STATUSES)[number];

@Entity('counterparties')
@Index('idx_counterparties_name', ['name'])
@Index('idx_counterparties_organization_name', ['organizationId', 'name'])
@Index('idx_counterparties_organization_status', ['organizationId', 'status'])
export class Counterparty extends UuidEntity {
  @Column({
    name: 'organization_id',
    type: 'uuid',
  })
  organizationId!: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

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

  @Column({ type: 'varchar', length: 20, default: 'Active' })
  status!: CounterpartyStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(
    () => VoyageCounterparty,
    (voyageCounterparty) => voyageCounterparty.counterparty,
  )
  voyageLinks?: VoyageCounterparty[];
}
