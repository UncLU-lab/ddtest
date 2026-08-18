import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../../database/entities/base.entity';
import { Counterparty } from './counterparty.entity';
import { Voyage } from './voyage.entity';

export const VOYAGE_COUNTERPARTY_ROLES = [
  'Supplier',
  'Receiver',
  'Charterer',
  'Owner',
  'Broker',
  'Trader',
  'PortAgent',
  'Terminal',
] as const;
export type VoyageCounterpartyRole =
  (typeof VOYAGE_COUNTERPARTY_ROLES)[number];

@Entity('voyage_counterparties')
@Index('uq_voyage_counterparties_link', ['voyageId', 'counterpartyId', 'role'], {
  unique: true,
})
@Index('idx_voyage_counterparties_counterparty', ['counterpartyId'])
@Index('idx_voyage_counterparties_voyage', ['voyageId'])
export class VoyageCounterparty extends UuidEntity {
  @Column({ name: 'voyage_id', type: 'uuid' })
  voyageId!: string;

  @ManyToOne(() => Voyage, (voyage) => voyage.counterpartyLinks)
  @JoinColumn({ name: 'voyage_id' })
  voyage!: Voyage;

  @Column({ name: 'counterparty_id', type: 'uuid' })
  counterpartyId!: string;

  @ManyToOne(() => Counterparty, (counterparty) => counterparty.voyageLinks)
  @JoinColumn({ name: 'counterparty_id' })
  counterparty!: Counterparty;

  @Column({ type: 'varchar', length: 20 })
  role!: VoyageCounterpartyRole;
}
