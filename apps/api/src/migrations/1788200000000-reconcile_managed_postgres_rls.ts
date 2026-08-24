import { MigrationInterface, QueryRunner } from 'typeorm';

const APPLICATION_ROLE = 'demurrage_defender_app';
const AUTHENTICATOR_ROLE = 'demurrage_defender_authenticator';

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
  'nor_tender_location_evidence',
  'laytime_calculations',
  'calculation_periods',
  'dispute_cases_bulk',
] as const;

const AUTHENTICATOR_COLUMN_GRANTS = {
  users: 'id, organization_id, firebase_uid',
  vessels: 'id, organization_id',
  counterparties: 'id, organization_id',
  voyages: 'id, organization_id',
  charter_parties: 'id, voyage_id',
  cp_clauses: 'id, charter_party_id',
  sof_documents: 'id, voyage_id',
  sof_events: 'id, sof_id, event_type',
  nor_documents: 'id, voyage_id',
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
  sof_events: `app.sof_document_belongs_to_current_tenant(sof_id)`,
  nor_documents: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  laytime_calculations: `app.voyage_belongs_to_current_tenant(voyage_id)`,
};

const SECURITY_DEFINER_FUNCTIONS = [
  'user_belongs_to_current_tenant(uuid)',
  'vessel_belongs_to_current_tenant(uuid)',
  'counterparty_belongs_to_current_tenant(uuid)',
  'voyage_belongs_to_current_tenant(uuid)',
  'charter_party_belongs_to_current_tenant(uuid)',
  'cp_clause_belongs_to_current_tenant(uuid)',
  'sof_document_belongs_to_current_tenant(uuid)',
  'laytime_calculation_belongs_to_current_tenant(uuid)',
  'nor_document_belongs_to_voyage(uuid, uuid)',
  'sof_document_belongs_to_voyage(uuid, uuid)',
  'sof_event_belongs_to_voyage(uuid, uuid)',
  'resolve_authenticated_user(text)',
] as const;

export class ReconcileManagedPostgresRls1788200000000
  implements MigrationInterface
{
  name = 'ReconcileManagedPostgresRls1788200000000';

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
    await queryRunner.query(
      `REVOKE ${AUTHENTICATOR_ROLE} FROM ${APPLICATION_ROLE}`,
    );
    await queryRunner.query(
      `GRANT CREATE ON SCHEMA app TO ${AUTHENTICATOR_ROLE}`,
    );

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

    await queryRunner.query(`REVOKE ALL ON SCHEMA app FROM PUBLIC`);
    await queryRunner.query(
      `GRANT USAGE ON SCHEMA app, public TO ${APPLICATION_ROLE}, ${AUTHENTICATOR_ROLE}`,
    );

    for (const table of PROTECTED_TABLES) {
      await queryRunner.query(`
        REVOKE ALL PRIVILEGES ON TABLE public.${table}
        FROM ${AUTHENTICATOR_ROLE}
      `);
    }
    for (const [table, columns] of Object.entries(
      AUTHENTICATOR_COLUMN_GRANTS,
    )) {
      await queryRunner.query(`
        GRANT SELECT (${columns}) ON TABLE public.${table}
        TO ${AUTHENTICATOR_ROLE}
      `);
    }

    await queryRunner.query(
      `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC, ${APPLICATION_ROLE}`,
    );
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION
        app.current_tenant_id(),
        app.current_user_id()
      FROM ${AUTHENTICATOR_ROLE}
    `);
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

    for (const functionSignature of SECURITY_DEFINER_FUNCTIONS) {
      await queryRunner.query(`
        ALTER FUNCTION app.${functionSignature}
        OWNER TO ${AUTHENTICATOR_ROLE}
      `);
      await queryRunner.query(`
        ALTER FUNCTION app.${functionSignature}
        SECURITY DEFINER
      `);
      await queryRunner.query(`
        REVOKE ALL ON FUNCTION app.${functionSignature} FROM PUBLIC
      `);
      await queryRunner.query(`
        GRANT EXECUTE ON FUNCTION app.${functionSignature}
        TO ${APPLICATION_ROLE}
      `);
    }
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION
        app.voyage_belongs_to_current_tenant(uuid),
        app.charter_party_belongs_to_current_tenant(uuid),
        app.sof_document_belongs_to_current_tenant(uuid)
      TO ${AUTHENTICATOR_ROLE}
    `);

    for (const functionSignature of SECURITY_DEFINER_FUNCTIONS.filter(
      (signature) => signature !== 'resolve_authenticated_user(text)',
    )) {
      await queryRunner.query(`
        ALTER FUNCTION app.${functionSignature}
        SET search_path = pg_catalog
      `);
    }
    await queryRunner.query(`
      ALTER FUNCTION app.resolve_authenticated_user(text)
      SET search_path = pg_catalog
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
      await queryRunner.query(
        `DROP POLICY IF EXISTS authenticator_function_read_${table} ON public.${table}`,
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
      await queryRunner.query(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`,
      );
    }

    await queryRunner.query(`
      DO $role_attributes$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_roles
          WHERE rolname = '${AUTHENTICATOR_ROLE}'
            AND rolbypassrls
        ) THEN
          ALTER ROLE ${AUTHENTICATOR_ROLE} NOBYPASSRLS;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_roles
          WHERE rolname IN ('${APPLICATION_ROLE}', '${AUTHENTICATOR_ROLE}')
            AND (
              rolsuper
              OR rolcreaterole
              OR rolcreatedb
              OR rolcanlogin
              OR rolinherit
              OR rolbypassrls
            )
        ) THEN
          RAISE EXCEPTION 'RLS roles do not have the required restricted attributes';
        END IF;
      END
      $role_attributes$;
    `);
    await queryRunner.query(`REVOKE ${AUTHENTICATOR_ROLE} FROM CURRENT_USER`);
    await queryRunner.query(
      `REVOKE CREATE ON SCHEMA app FROM ${AUTHENTICATOR_ROLE}`,
    );
  }

  // Re-introducing BYPASSRLS is not a safe rollback. Earlier migrations own
  // complete teardown when intentionally reverting the RLS foundation.
  public down(): Promise<void> {
    return Promise.resolve();
  }
}
