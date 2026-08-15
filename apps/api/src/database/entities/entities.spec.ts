import { DataSource } from 'typeorm';
import { databaseEntities } from '.';

describe('database entities', () => {
  it('registers all 27 tables defined in the database design document', async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      database: 'metadata-only',
      entities: [...databaseEntities],
    });

    const metadataBuilder = dataSource as unknown as {
      buildMetadatas(): Promise<void>;
    };
    await metadataBuilder.buildMetadatas();

    expect(
      dataSource.entityMetadatas.map(({ tableName }) => tableName).sort(),
    ).toEqual([
      'ai_interactions',
      'audit_log',
      'calculation_periods',
      'carrier_tariffs',
      'charter_parties',
      'container_milestones',
      'containers',
      'counterparties',
      'cp_clauses',
      'dd_invoice_lines',
      'dd_invoices',
      'dispute_cases_bulk',
      'dispute_cases_container',
      'feedback_signals',
      'free_time_clocks',
      'knowledge_base_chunks',
      'laytime_calculations',
      'nor_documents',
      'organizations',
      'shipment_containers',
      'shipments',
      'sof_documents',
      'sof_events',
      'users',
      'vessels',
      'voyage_counterparties',
      'voyages',
    ]);
  });
});
