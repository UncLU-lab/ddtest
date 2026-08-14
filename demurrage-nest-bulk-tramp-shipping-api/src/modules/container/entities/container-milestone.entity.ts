import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Container } from './container.entity';

@Entity('container_milestones')
@Index('idx_milestones_container', ['containerId', 'time'])
export class ContainerMilestone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @PrimaryColumn({ type: 'timestamptz' })
  time!: Date;

  @Column({ name: 'container_id', type: 'uuid' })
  containerId!: string;

  @ManyToOne(() => Container, (container) => container.milestones)
  @JoinColumn({ name: 'container_id' })
  container!: Container;

  @Column({ name: 'event_type', type: 'varchar', length: 30 })
  eventType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string | null;

  @Column({ type: 'varchar', length: 50 })
  source!: string;

  @Column({ name: 'is_correction', type: 'boolean', default: false })
  isCorrection!: boolean;
}
