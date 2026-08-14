import { Column, CreateDateColumn, Entity, Index, OneToMany } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { AiInteraction } from './ai-interaction.entity';
import { AuditLog } from './audit-log.entity';
import { FeedbackSignal } from './feedback-signal.entity';

@Entity('users')
@Index('idx_users_firebase', ['firebaseUid'])
@Index('idx_users_email', ['email'])
export class User extends UuidEntity {
  @Column({
    name: 'firebase_uid',
    type: 'varchar',
    length: 128,
    unique: true,
  })
  firebaseUid!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 200 })
  fullName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_login', type: 'timestamptz', nullable: true })
  lastLogin?: Date | null;

  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  auditLogs?: AuditLog[];

  @OneToMany(() => AiInteraction, (interaction) => interaction.user)
  aiInteractions?: AiInteraction[];

  @OneToMany(() => FeedbackSignal, (feedback) => feedback.user)
  feedbackSignals?: FeedbackSignal[];
}
