import { DataSource } from 'typeorm';
import { databaseEntities } from '.';

describe('database entities', () => {
  it('registers the database-design tables plus audited NOR location evidence', async () => {
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
      'nor_tender_location_evidence',
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

    const column = (table: string, property: string) =>
      dataSource.entityMetadatas
        .find(({ tableName }) => tableName === table)
        ?.columns.find(({ propertyName }) => propertyName === property);
    expect(column('charter_parties', 'settlementCurrency')).toMatchObject({
      databaseName: 'settlement_currency',
      isNullable: true,
      length: '3',
    });
    expect(column('laytime_calculations', 'currency')).toMatchObject({
      databaseName: 'currency',
      isNullable: true,
      length: '3',
    });
    expect(column('dispute_cases_bulk', 'currency')).toMatchObject({
      databaseName: 'currency',
      isNullable: true,
      length: '3',
    });
  });
});
