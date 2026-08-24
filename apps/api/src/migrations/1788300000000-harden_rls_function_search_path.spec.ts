import { HardenRlsFunctionSearchPath1788300000000 } from './1788300000000-harden_rls_function_search_path';

describe('HardenRlsFunctionSearchPath1788300000000', () => {
  it('converges every security-definer helper on a trusted search path', async () => {
    const migration = new HardenRlsFunctionSearchPath1788300000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.up(queryRunner);

    const sql = (queryRunner as { query: jest.Mock }).query.mock.calls
      .map(([query]: [string]) => query)
      .join('\n');
    expect(sql.match(/SET search_path = pg_catalog/g)).toHaveLength(12);
    expect(sql).not.toContain('search_path = pg_catalog, public');
    expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(12);
    expect(
      sql.match(/OWNER TO demurrage_defender_authenticator/g),
    ).toHaveLength(12);
    expect(sql.match(/FROM PUBLIC/g)).toHaveLength(12);
    expect(sql).toContain(
      'REVOKE demurrage_defender_authenticator FROM demurrage_defender_app',
    );
    expect(sql).toContain("member.rolname = 'demurrage_defender_app'");
    expect(sql).toContain(
      'REVOKE demurrage_defender_authenticator FROM CURRENT_USER',
    );
  });

  it('does not recreate the historical BYPASSRLS design on rollback', async () => {
    const migration = new HardenRlsFunctionSearchPath1788300000000();
    await expect(migration.down()).resolves.toBeUndefined();
  });
});
