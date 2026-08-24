import { AddNorTenderLocationEvidence1787900000000 } from './1787900000000-add_nor_tender_location_evidence';

describe('AddNorTenderLocationEvidence1787900000000', () => {
  it('creates the audited evidence table with inherited tenant RLS', async () => {
    const migration = new AddNorTenderLocationEvidence1787900000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.up(queryRunner);

    const sql = (queryRunner as { query: jest.Mock }).query.mock.calls
      .map(([query]: [string]) => query)
      .join('\n');
    expect(sql).toContain('CREATE TABLE "nor_tender_location_evidence"');
    expect(sql).toContain('"voyage_id" uuid NOT NULL');
    expect(sql).toContain('"evidence_time" TIMESTAMP WITH TIME ZONE NOT NULL');
    expect(sql).toContain('"created_by_user_id" uuid NOT NULL');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('tenant_isolation_nor_tender_location_evidence');
    expect(sql).toContain('app.voyage_belongs_to_current_tenant(voyage_id)');
    expect(sql).toContain(
      'app.user_belongs_to_current_tenant(created_by_user_id)',
    );
    expect(sql).toContain(
      'app.nor_document_belongs_to_voyage(nor_document_id, voyage_id)',
    );
  });

  it('removes the policy and table on rollback', async () => {
    const migration = new AddNorTenderLocationEvidence1787900000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.down(queryRunner);

    const sql = (queryRunner as { query: jest.Mock }).query.mock.calls
      .map(([query]: [string]) => query)
      .join('\n');
    expect(sql).toContain(
      'DROP POLICY IF EXISTS tenant_isolation_nor_tender_location_evidence',
    );
    expect(sql).toContain('DROP TABLE "nor_tender_location_evidence"');
  });
});
