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

@Entity('ai_interactions')
@Index('idx_ai_interactions_user', ['userId', 'createdAt'])
@Index('idx_ai_interactions_session', ['sessionId'])
export class AiInteraction extends UuidEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.aiInteractions)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'session_id', type: 'varchar', length: 100 })
  sessionId!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'text' })
  response!: string;

  @Column({ name: 'retrieved_context', type: 'jsonb', nullable: true })
  retrievedContext?: unknown[] | null;

  @Column({ name: 'model_version', type: 'varchar', length: 50 })
  modelVersion!: string;

  @Column({ name: 'feedback_score', type: 'integer', nullable: true })
  feedbackScore?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
