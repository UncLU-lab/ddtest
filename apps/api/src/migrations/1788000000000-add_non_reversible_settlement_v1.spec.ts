import { AddNonReversibleSettlementV11788000000000 } from './1788000000000-add_non_reversible_settlement_v1';

describe('AddNonReversibleSettlementV11788000000000', () => {
  it('adds nullable scope, authority, and summary-safe scalar columns without backfill', async () => {
    const migration = new AddNonReversibleSettlementV11788000000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.up(queryRunner);

    const sql = (queryRunner as { query: jest.Mock }).query.mock.calls
      .map(([query]: [string]) => query)
      .join('\n');
    expect(sql).toContain('ADD COLUMN "laytime_operation_scope"');
    expect(sql).toContain("'LoadingAndDischarge'");
    expect(sql).toContain('ADD COLUMN "settlement_authority_status"');
    expect(sql).toContain('ALTER COLUMN "allowed_laytime" DROP NOT NULL');
    expect(sql).not.toContain('UPDATE "charter_parties"');
  });

  it('restores historical non-null constraints on rollback', async () => {
    const migration = new AddNonReversibleSettlementV11788000000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.down(queryRunner);

    const sql = (queryRunner as { query: jest.Mock }).query.mock.calls
      .map(([query]: [string]) => query)
      .join('\n');
    expect(sql).toContain('COALESCE("allowed_laytime"');
    expect(sql).toContain('DROP COLUMN "settlement_authority_status"');
    expect(sql).toContain('DROP COLUMN "laytime_operation_scope"');
  });
});
