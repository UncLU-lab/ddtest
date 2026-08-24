import { AddAuthoritativeCalculationCurrencyV11788100000000 } from './1788100000000-add_authoritative_calculation_currency_v1';

describe('AddAuthoritativeCalculationCurrencyV1 migration', () => {
  it('adds nullable, shape-constrained currency columns without a backfill', async () => {
    const queries: string[] = [];
    const migration = new AddAuthoritativeCalculationCurrencyV11788100000000();

    await migration.up({ query: async (sql: string) => queries.push(sql) } as any);

    const sql = queries.join('\n');
    expect(sql).toContain('"settlement_currency" character varying(3)');
    expect(sql).toContain('"laytime_calculations"');
    expect(sql).toContain('"dispute_cases_bulk"');
    expect(sql).toContain("~ '^[A-Z]{3}$'");
    expect(sql).not.toMatch(/UPDATE|DEFAULT\s+'USD'/i);
  });

  it('drops only the new constraints and columns on rollback', async () => {
    const queries: string[] = [];
    const migration = new AddAuthoritativeCalculationCurrencyV11788100000000();

    await migration.down({ query: async (sql: string) => queries.push(sql) } as any);

    const sql = queries.join('\n');
    expect(sql).toContain('DROP COLUMN "settlement_currency"');
    expect(sql).toContain('DROP COLUMN "currency"');
    expect(sql).not.toMatch(/UPDATE/i);
  });
});
