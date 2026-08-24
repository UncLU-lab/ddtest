import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Organization } from '../../cross-cutting/entities/organization.entity';
import { Shipment } from '../../container/entities/shipment.entity';
import { Voyage } from './voyage.entity';

@Entity('vessels')
@Index('idx_vessels_imo', ['imo'])
@Index('idx_vessels_type', ['type'])
@Index('idx_vessels_organization', ['organizationId'])
export class Vessel extends UuidEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ type: 'varchar', length: 7, unique: true })
  imo!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  flag!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ type: 'integer' })
  dwt!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Voyage, (voyage) => voyage.vessel)
  voyages?: Voyage[];

  @OneToMany(() => Shipment, (shipment) => shipment.vessel)
  shipments?: Shipment[];
}
