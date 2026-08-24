import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createDatabaseConfig } from '../config/database.config';

type Row = Record<string, unknown>;
type MembershipRow = Row & {
  target_role: string;
  member_role: string;
  grantor_role: string;
  admin_option: boolean;
  inherit_option: boolean;
  set_option: boolean;
};
type FunctionRow = Row & {
  signature: string;
  owner: string;
  security_definer: boolean;
  settings: string[] | null;
};
type FunctionPrivilegeRow = Row & {
  signature: string;
  grantee: string;
};

function sortNormalizedRows<T>(rows: T[]): T[] {
  return rows.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

async function auditRlsStructure(): Promise<void> {
  const dataSource = new DataSource(
    createDatabaseConfig({ useApplicationRole: false }),
  );
  await dataSource.initialize();

  try {
    const [identity] = await dataSource.query<
      Array<{ current_user: string; session_user: string }>
    >(`
      SELECT current_user, session_user
    `);
    const normalizeLogin = (value: string): string =>
      value === identity.current_user ? '<database_login>' : value;

    const roles = await dataSource.query<Row[]>(`
      SELECT
        rolname,
        rolsuper,
        rolcreaterole,
        rolcreatedb,
        rolcanlogin,
        rolinherit,
        rolbypassrls
      FROM pg_roles
      WHERE rolname IN (
        'demurrage_defender_app',
        'demurrage_defender_authenticator'
      )
      ORDER BY rolname
    `);
    const memberships = await dataSource.query<MembershipRow[]>(`
      SELECT
        target.rolname AS target_role,
        member.rolname AS member_role,
        grantor.rolname AS grantor_role,
        membership.admin_option,
        membership.inherit_option,
        membership.set_option
      FROM pg_auth_members membership
      JOIN pg_roles target ON target.oid = membership.roleid
      JOIN pg_roles member ON member.oid = membership.member
      JOIN pg_roles grantor ON grantor.oid = membership.grantor
      WHERE target.rolname IN (
        'demurrage_defender_app',
        'demurrage_defender_authenticator'
      )
      ORDER BY target_role, member_role
    `);
    const tablePrivileges = await dataSource.query<Row[]>(`
      SELECT grantee, table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN (
          'demurrage_defender_app',
          'demurrage_defender_authenticator'
        )
      ORDER BY grantee, table_name, privilege_type
    `);
    const schemaPrivileges = await dataSource.query<Row[]>(`
      SELECT
        namespace.nspname AS schema_name,
        grantee.rolname AS grantee,
        privilege.privilege_type
      FROM pg_namespace namespace
      CROSS JOIN LATERAL aclexplode(
        COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
      ) privilege
      JOIN pg_roles grantee ON grantee.oid = privilege.grantee
      WHERE namespace.nspname IN ('app', 'public')
        AND grantee.rolname IN (
          'demurrage_defender_app',
          'demurrage_defender_authenticator'
        )
      ORDER BY schema_name, grantee, privilege_type
    `);
    const columnPrivileges = await dataSource.query<Row[]>(`
      SELECT grantee, table_name, column_name, privilege_type
      FROM information_schema.role_column_grants
      WHERE table_schema = 'public'
        AND grantee = 'demurrage_defender_authenticator'
      ORDER BY grantee, table_name, column_name, privilege_type
    `);
    const functions = await dataSource.query<FunctionRow[]>(`
      SELECT
        function.oid::regprocedure::text AS signature,
        owner.rolname AS owner,
        language.lanname AS language,
        function.prosecdef AS security_definer,
        function.provolatile AS volatility,
        function.proconfig AS settings,
        function.prosrc AS body
      FROM pg_proc function
      JOIN pg_namespace namespace ON namespace.oid = function.pronamespace
      JOIN pg_roles owner ON owner.oid = function.proowner
      JOIN pg_language language ON language.oid = function.prolang
      WHERE namespace.nspname = 'app'
      ORDER BY signature
    `);
    const functionPrivileges = await dataSource.query<FunctionPrivilegeRow[]>(`
      SELECT
        function.oid::regprocedure::text AS signature,
        CASE
          WHEN privilege.grantee = 0 THEN 'PUBLIC'
          ELSE grantee.rolname
        END AS grantee,
        privilege.privilege_type
      FROM pg_proc function
      JOIN pg_namespace namespace ON namespace.oid = function.pronamespace
      CROSS JOIN LATERAL aclexplode(
        COALESCE(function.proacl, acldefault('f', function.proowner))
      ) privilege
      LEFT JOIN pg_roles grantee ON grantee.oid = privilege.grantee
      WHERE namespace.nspname = 'app'
      ORDER BY signature, grantee, privilege_type
    `);
    const policies = await dataSource.query<Row[]>(`
      SELECT
        tablename,
        policyname,
        permissive,
        roles::text,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (
          policyname LIKE 'tenant_isolation_%'
          OR policyname LIKE 'authenticator_function_read_%'
        )
      ORDER BY tablename, policyname
    `);
    const tableSecurity = await dataSource.query<Row[]>(`
      SELECT
        class.relname AS table_name,
        class.relrowsecurity AS rls_enabled,
        class.relforcerowsecurity AS rls_forced
      FROM pg_class class
      JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND class.relname IN (
          'organizations',
          'users',
          'voyages',
          'vessels',
          'counterparties',
          'charter_parties',
          'cp_clauses',
          'voyage_counterparties',
          'sof_documents',
          'sof_events',
          'nor_documents',
          'nor_tender_location_evidence',
          'laytime_calculations',
          'calculation_periods',
          'dispute_cases_bulk'
        )
      ORDER BY table_name
    `);
    const [{ migration_count: migrationCount }] = await dataSource.query<
      Array<{ migration_count: number }>
    >(`SELECT COUNT(*)::int AS migration_count FROM migrations`);

    const normalizedFunctionPrivileges = sortNormalizedRows(
      functionPrivileges.map((privilege) => ({
        ...privilege,
        grantee: normalizeLogin(privilege.grantee),
      })),
    );
    const setCapableMemberships = sortNormalizedRows(
      memberships
        .filter((membership) => membership.set_option === true)
        .map((membership) => ({
          target_role: membership.target_role,
          member_role: normalizeLogin(membership.member_role),
        })),
    );
    const structure = {
      roles,
      memberships: memberships.map((membership) => ({
        ...membership,
        member_role: normalizeLogin(membership.member_role),
        grantor_role: normalizeLogin(membership.grantor_role),
      })),
      setCapableMemberships,
      schemaPrivileges,
      tablePrivileges,
      columnPrivileges,
      functions: functions.map((databaseFunction) => ({
        ...databaseFunction,
        owner: normalizeLogin(databaseFunction.owner),
      })),
      functionPrivileges: normalizedFunctionPrivileges,
      policies,
      tableSecurity,
    };
    const structureHash = createHash('sha256')
      .update(JSON.stringify(structure))
      .digest('hex');
    const securityStructureHash = createHash('sha256')
      .update(
        JSON.stringify({
          roles,
          memberships: setCapableMemberships,
          schemaPrivileges,
          tablePrivileges,
          columnPrivileges,
          functions: structure.functions,
          functionPrivileges: normalizedFunctionPrivileges,
          policies,
          tableSecurity,
        }),
      )
      .digest('hex');
    const securityDefinerFunctions = functions
      .filter((databaseFunction) => databaseFunction.security_definer)
      .map((databaseFunction) => ({
        signature: databaseFunction.signature,
        owner: normalizeLogin(databaseFunction.owner),
        search_path: databaseFunction.settings,
        execute_grantees: normalizedFunctionPrivileges
          .filter(
            (privilege) => privilege.signature === databaseFunction.signature,
          )
          .map((privilege) => privilege.grantee),
      }));
    const result = {
      identity,
      migration_count: migrationCount,
      structure_hash: structureHash,
      security_structure_hash: securityStructureHash,
      roles,
      memberships: structure.memberships,
      set_capable_memberships: setCapableMemberships,
      security_definer_functions: securityDefinerFunctions,
      counts: {
        roles: roles.length,
        memberships: memberships.length,
        set_capable_memberships: memberships.filter(
          (membership) => membership.set_option === true,
        ).length,
        schema_privileges: schemaPrivileges.length,
        table_privileges: tablePrivileges.length,
        column_privileges: columnPrivileges.length,
        functions: functions.length,
        function_privileges: functionPrivileges.length,
        policies: policies.length,
        protected_tables: tableSecurity.length,
      },
      ...(process.argv.includes('--full') ? { structure } : {}),
    };

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await dataSource.destroy();
  }
}

void auditRlsStructure().catch((error: unknown) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  process.stderr.write(`PostgreSQL RLS structure audit failed (${code}).\n`);
  process.exitCode = 1;
});
