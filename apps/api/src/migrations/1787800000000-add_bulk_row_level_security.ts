import { MigrationInterface, QueryRunner } from 'typeorm';

const APPLICATION_ROLE = 'demurrage_defender_app';
const AUTHENTICATOR_ROLE = 'demurrage_defender_authenticator';

const AUTHENTICATOR_COLUMN_GRANTS = {
  users: 'id, organization_id, firebase_uid',
  vessels: 'id, organization_id',
  counterparties: 'id, organization_id',
  voyages: 'id, organization_id',
  charter_parties: 'id, voyage_id',
  cp_clauses: 'id, charter_party_id',
  sof_documents: 'id, voyage_id',
  laytime_calculations: 'id, voyage_id',
} as const;

const AUTHENTICATOR_POLICY_EXPRESSIONS: Record<
  keyof typeof AUTHENTICATOR_COLUMN_GRANTS,
  string
> = {
  users: `
    organization_id = app.current_tenant_id()
    OR (
      app.current_tenant_id() IS NULL
      AND firebase_uid = NULLIF(
        current_setting('app.authenticated_provider_identity', true),
        ''
      )
    )
  `,
  vessels: `organization_id = app.current_tenant_id()`,
  counterparties: `organization_id = app.current_tenant_id()`,
  voyages: `organization_id = app.current_tenant_id()`,
  charter_parties: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  cp_clauses: `app.charter_party_belongs_to_current_tenant(charter_party_id)`,
  sof_documents: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  laytime_calculations: `app.voyage_belongs_to_current_tenant(voyage_id)`,
};

const PROTECTED_TABLES = [
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
  'laytime_calculations',
  'calculation_periods',
  'dispute_cases_bulk',
] as const;

const POLICY_EXPRESSIONS: Record<(typeof PROTECTED_TABLES)[number], string> = {
  organizations: `id = app.current_tenant_id()`,
  users: `organization_id = app.current_tenant_id()`,
  vessels: `organization_id = app.current_tenant_id()`,
  counterparties: `organization_id = app.current_tenant_id()`,
  voyages: `
    organization_id = app.current_tenant_id()
    AND app.vessel_belongs_to_current_tenant(vessel_id)
    AND (charter_party_id IS NULL OR app.charter_party_belongs_to_current_tenant(charter_party_id))
    AND (created_by_user_id IS NULL OR app.user_belongs_to_current_tenant(created_by_user_id))
    AND (updated_by_user_id IS NULL OR app.user_belongs_to_current_tenant(updated_by_user_id))
  `,
  charter_parties: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  cp_clauses: `app.charter_party_belongs_to_current_tenant(charter_party_id)`,
  voyage_counterparties: `
    app.voyage_belongs_to_current_tenant(voyage_id)
    AND app.counterparty_belongs_to_current_tenant(counterparty_id)
  `,
  sof_documents: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  sof_events: `app.sof_document_belongs_to_current_tenant(sof_id)`,
  nor_documents: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  laytime_calculations: `
    app.voyage_belongs_to_current_tenant(voyage_id)
    AND (
      parent_calculation_id IS NULL
      OR app.laytime_calculation_belongs_to_current_tenant(parent_calculation_id)
    )
  `,
  calculation_periods: `
    app.laytime_calculation_belongs_to_current_tenant(calculation_id)
    AND (
      applied_clause_id IS NULL
      OR app.cp_clause_belongs_to_current_tenant(applied_clause_id)
    )
  `,
  dispute_cases_bulk: `app.voyage_belongs_to_current_tenant(voyage_id)`,
};

export class AddBulkRowLevelSecurity1787800000000
  implements MigrationInterface
{
  name = 'AddBulkRowLevelSecurity1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $roles$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = '${APPLICATION_ROLE}'
        ) THEN
          CREATE ROLE ${APPLICATION_ROLE}
            NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = '${AUTHENTICATOR_ROLE}'
        ) THEN
          CREATE ROLE ${AUTHENTICATOR_ROLE}
            NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
        END IF;
      END
      $roles$;
    `);

    await queryRunner.query(
      `GRANT ${APPLICATION_ROLE}, ${AUTHENTICATOR_ROLE} TO CURRENT_USER`,
    );
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS app`);
    await queryRunner.query(
      `GRANT USAGE, CREATE ON SCHEMA app TO ${AUTHENTICATOR_ROLE}`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app.current_tenant_id()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $function$
        SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      $function$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app.current_user_id()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $function$
        SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
      $function$
    `);

    const ownershipFunctions = [
      {
        name: 'user_belongs_to_current_tenant',
        argument: 'user_id',
        sql: `SELECT EXISTS (
          SELECT 1 FROM public.users item
          WHERE item.id = $1
            AND item.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'vessel_belongs_to_current_tenant',
        argument: 'vessel_id',
        sql: `SELECT EXISTS (
          SELECT 1 FROM public.vessels item
          WHERE item.id = $1
            AND item.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'counterparty_belongs_to_current_tenant',
        argument: 'counterparty_id',
        sql: `SELECT EXISTS (
          SELECT 1 FROM public.counterparties item
          WHERE item.id = $1
            AND item.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'voyage_belongs_to_current_tenant',
        argument: 'voyage_id',
        sql: `SELECT EXISTS (
          SELECT 1 FROM public.voyages item
          WHERE item.id = $1
            AND item.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'charter_party_belongs_to_current_tenant',
        argument: 'charter_party_id',
        sql: `SELECT EXISTS (
          SELECT 1
          FROM public.charter_parties item
          JOIN public.voyages voyage ON voyage.id = item.voyage_id
          WHERE item.id = $1
            AND voyage.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'cp_clause_belongs_to_current_tenant',
        argument: 'clause_id',
        sql: `SELECT EXISTS (
          SELECT 1
          FROM public.cp_clauses item
          JOIN public.charter_parties charter_party
            ON charter_party.id = item.charter_party_id
          JOIN public.voyages voyage ON voyage.id = charter_party.voyage_id
          WHERE item.id = $1
            AND voyage.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'sof_document_belongs_to_current_tenant',
        argument: 'sof_id',
        sql: `SELECT EXISTS (
          SELECT 1
          FROM public.sof_documents item
          JOIN public.voyages voyage ON voyage.id = item.voyage_id
          WHERE item.id = $1
            AND voyage.organization_id = app.current_tenant_id()
        )`,
      },
      {
        name: 'laytime_calculation_belongs_to_current_tenant',
        argument: 'calculation_id',
        sql: `SELECT EXISTS (
          SELECT 1
          FROM public.laytime_calculations item
          JOIN public.voyages voyage ON voyage.id = item.voyage_id
          WHERE item.id = $1
            AND voyage.organization_id = app.current_tenant_id()
        )`,
      },
    ] as const;

    for (const helper of ownershipFunctions) {
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION app.${helper.name}(${helper.argument} uuid)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $function$
          ${helper.sql}
        $function$
      `);
      await queryRunner.query(
        `ALTER FUNCTION app.${helper.name}(uuid) OWNER TO ${AUTHENTICATOR_ROLE}`,
      );
    }

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app.resolve_authenticated_user(provider_identity text)
      RETURNS TABLE (
        user_id uuid,
        organization_id uuid,
        organization_exists boolean
      )
      LANGUAGE plpgsql
      VOLATILE
      SECURITY DEFINER
      SET search_path = pg_catalog
      AS $function$
      DECLARE
        previous_provider_identity text;
      BEGIN
        IF provider_identity IS NULL OR provider_identity = '' THEN
          RETURN;
        END IF;

        previous_provider_identity := current_setting(
          'app.authenticated_provider_identity',
          true
        );
        PERFORM pg_catalog.set_config(
          'app.authenticated_provider_identity',
          provider_identity,
          true
        );

        RETURN QUERY
          SELECT
            app_user.id,
            app_user.organization_id,
            app_user.organization_id IS NOT NULL
          FROM public.users app_user
          WHERE app_user.firebase_uid = provider_identity
          LIMIT 1;

        PERFORM pg_catalog.set_config(
          'app.authenticated_provider_identity',
          COALESCE(previous_provider_identity, ''),
          true
        );
      EXCEPTION WHEN OTHERS THEN
        PERFORM pg_catalog.set_config(
          'app.authenticated_provider_identity',
          COALESCE(previous_provider_identity, ''),
          true
        );
        RAISE;
      END
      $function$
    `);
    await queryRunner.query(`
      ALTER FUNCTION app.resolve_authenticated_user(text)
      OWNER TO ${AUTHENTICATOR_ROLE}
    `);

    await queryRunner.query(`REVOKE ALL ON SCHEMA app FROM PUBLIC`);
    await queryRunner.query(
      `GRANT USAGE ON SCHEMA app, public TO ${APPLICATION_ROLE}, ${AUTHENTICATOR_ROLE}`,
    );
    for (const [table, columns] of Object.entries(
      AUTHENTICATOR_COLUMN_GRANTS,
    )) {
      await queryRunner.query(`
        GRANT SELECT (${columns}) ON TABLE public.${table}
        TO ${AUTHENTICATOR_ROLE}
      `);
    }
    await queryRunner.query(
      `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC`,
    );
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION
        app.current_tenant_id(),
        app.current_user_id()
      TO ${APPLICATION_ROLE}
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION app.current_tenant_id()
      TO ${AUTHENTICATOR_ROLE}
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION
        app.voyage_belongs_to_current_tenant(uuid),
        app.charter_party_belongs_to_current_tenant(uuid),
        app.sof_document_belongs_to_current_tenant(uuid)
      TO ${AUTHENTICATOR_ROLE}
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION
        app.user_belongs_to_current_tenant(uuid),
        app.vessel_belongs_to_current_tenant(uuid),
        app.counterparty_belongs_to_current_tenant(uuid),
        app.voyage_belongs_to_current_tenant(uuid),
        app.charter_party_belongs_to_current_tenant(uuid),
        app.cp_clause_belongs_to_current_tenant(uuid),
        app.sof_document_belongs_to_current_tenant(uuid),
        app.laytime_calculation_belongs_to_current_tenant(uuid),
        app.resolve_authenticated_user(text)
      TO ${APPLICATION_ROLE}
    `);

    for (const [table, expression] of Object.entries(
      AUTHENTICATOR_POLICY_EXPRESSIONS,
    )) {
      await queryRunner.query(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(`
        CREATE POLICY authenticator_function_read_${table}
        ON public.${table}
        AS PERMISSIVE
        FOR SELECT
        TO ${AUTHENTICATOR_ROLE}
        USING (${expression})
      `);
    }

    for (const table of PROTECTED_TABLES) {
      const policyName = `tenant_isolation_${table}`;
      const expression = POLICY_EXPRESSIONS[table];

      await queryRunner.query(`
        GRANT SELECT, INSERT, UPDATE, DELETE
        ON TABLE public.${table}
        TO ${APPLICATION_ROLE}
      `);
      await queryRunner.query(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(`
        CREATE POLICY ${policyName}
        ON public.${table}
        AS PERMISSIVE
        FOR ALL
        TO ${APPLICATION_ROLE}
        USING (${expression})
        WITH CHECK (${expression})
      `);
    }
    await queryRunner.query(
      `REVOKE CREATE ON SCHEMA app FROM ${AUTHENTICATOR_ROLE}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...PROTECTED_TABLES].reverse()) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS tenant_isolation_${table} ON public.${table}`,
      );
      await queryRunner.query(
        `ALTER TABLE public.${table} NO FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.${table} FROM ${APPLICATION_ROLE}`,
      );
    }

    for (const table of Object.keys(AUTHENTICATOR_COLUMN_GRANTS).reverse()) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS authenticator_function_read_${table} ON public.${table}`,
      );
    }

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS app.resolve_authenticated_user(text)`,
    );
    for (const functionName of [
      'laytime_calculation_belongs_to_current_tenant',
      'sof_document_belongs_to_current_tenant',
      'cp_clause_belongs_to_current_tenant',
      'charter_party_belongs_to_current_tenant',
      'voyage_belongs_to_current_tenant',
      'counterparty_belongs_to_current_tenant',
      'vessel_belongs_to_current_tenant',
      'user_belongs_to_current_tenant',
    ]) {
      await queryRunner.query(
        `DROP FUNCTION IF EXISTS app.${functionName}(uuid)`,
      );
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS app.current_user_id()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app.current_tenant_id()`);
    for (const [table, columns] of Object.entries(
      AUTHENTICATOR_COLUMN_GRANTS,
    )) {
      await queryRunner.query(`
        REVOKE SELECT (${columns}) ON TABLE public.${table}
        FROM ${AUTHENTICATOR_ROLE}
      `);
    }
    await queryRunner.query(
      `REVOKE USAGE ON SCHEMA public FROM ${APPLICATION_ROLE}, ${AUTHENTICATOR_ROLE}`,
    );
    await queryRunner.query(`DROP SCHEMA IF EXISTS app`);
    await queryRunner.query(
      `REVOKE ${APPLICATION_ROLE}, ${AUTHENTICATOR_ROLE} FROM CURRENT_USER`,
    );
    await queryRunner.query(`DROP ROLE IF EXISTS ${APPLICATION_ROLE}`);
    await queryRunner.query(`DROP ROLE IF EXISTS ${AUTHENTICATOR_ROLE}`);
  }
}
