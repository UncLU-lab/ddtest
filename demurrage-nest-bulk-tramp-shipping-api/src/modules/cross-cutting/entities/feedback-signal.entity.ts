import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { User } from './user.entity';

export type FeedbackRating = 'positive' | 'negative' | 'neutral';

@Entity('feedback_signals')
@Index('idx_feedback_source', ['sourceType', 'sourceId'])
export class FeedbackSignal extends UuidEntity {
  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.feedbackSignals)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 10 })
  rating!: FeedbackRating;

  @Column({ name: 'correction_text', type: 'text', nullable: true })
  correctionText?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
