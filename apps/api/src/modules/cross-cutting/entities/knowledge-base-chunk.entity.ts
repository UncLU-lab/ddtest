import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('knowledge_base_chunks')
@Index('idx_kb_source', ['sourceType', 'sourceRef'])
export class KnowledgeBaseChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType!: string;

  @Column({ name: 'source_ref', type: 'varchar', length: 500 })
  sourceRef!: string;

  @Column({ name: 'text_chunk', type: 'text' })
  textChunk!: string;

  @Column({ type: 'vector', length: 1536 })
  embedding!: number[];

  @Column({
    name: 'last_updated',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastUpdated!: Date;
}
