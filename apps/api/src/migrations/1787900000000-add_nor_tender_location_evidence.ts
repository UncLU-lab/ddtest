import { MigrationInterface, QueryRunner } from 'typeorm';

const APPLICATION_ROLE = 'demurrage_defender_app';
const AUTHENTICATOR_ROLE = 'demurrage_defender_authenticator';
const TABLE = 'nor_tender_location_evidence';
const POLICY = `tenant_isolation_${TABLE}`;
const AUTHENTICATOR_COLUMN_GRANTS = {
  nor_documents: 'id, voyage_id',
  sof_events: 'id, sof_id, event_type',
} as const;

const AUTHENTICATOR_POLICY_EXPRESSIONS: Record<
  keyof typeof AUTHENTICATOR_COLUMN_GRANTS,
  string
> = {
  nor_documents: `app.voyage_belongs_to_current_tenant(voyage_id)`,
  sof_events: `app.sof_document_belongs_to_current_tenant(sof_id)`,
};

export class AddNorTenderLocationEvidence1787900000000
  implements MigrationInterface
{
  name = 'AddNorTenderLocationEvidence1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT CREATE ON SCHEMA app TO ${AUTHENTICATOR_ROLE}`,
    );
    await queryRunner.query(`
      CREATE TABLE "${TABLE}" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "voyage_id" uuid NOT NULL,
        "operation" character varying(20) NOT NULL,
        "evidence_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "port_relation" character varying(30) NOT NULL,
        "berth_relation" character varying(20) NOT NULL,
        "waiting_place" character varying(30) NOT NULL,
        "source" character varying(20) NOT NULL,
        "sof_document_id" uuid,
        "source_reference" character varying(500),
        "note" text,
        "nor_document_id" uuid,
        "nor_tendered_event_id" uuid,
        "created_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nor_tender_location_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "chk_nor_location_operation"
          CHECK ("operation" IN ('Loading', 'Discharge')),
        CONSTRAINT "chk_nor_location_port_relation"
          CHECK ("port_relation" IN ('INSIDE_PORT_LIMITS', 'OUTSIDE_PORT_LIMITS', 'UNKNOWN')),
        CONSTRAINT "chk_nor_location_berth_relation"
          CHECK ("berth_relation" IN ('AT_BERTH', 'NOT_AT_BERTH', 'UNKNOWN')),
        CONSTRAINT "chk_nor_location_waiting_place"
          CHECK ("waiting_place" IN ('ANCHORAGE', 'PILOT_STATION', 'CUSTOMARY_WAITING_PLACE', 'OTHER', 'NONE', 'UNKNOWN')),
        CONSTRAINT "chk_nor_location_source"
          CHECK ("source" IN ('MANUAL', 'SOF', 'OCR', 'AIS')),
        CONSTRAINT "chk_nor_location_source_reference"
          CHECK (
            ("source" = 'SOF' AND "sof_document_id" IS NOT NULL)
            OR ("source" <> 'SOF' AND "sof_document_id" IS NULL)
          ),
        CONSTRAINT "chk_nor_location_single_candidate"
          CHECK (num_nonnulls("nor_document_id", "nor_tendered_event_id") <= 1),
        CONSTRAINT "FK_nor_location_voyage"
          FOREIGN KEY ("voyage_id") REFERENCES "voyages"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_nor_location_sof_document"
          FOREIGN KEY ("sof_document_id") REFERENCES "sof_documents"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_nor_location_nor_document"
          FOREIGN KEY ("nor_document_id") REFERENCES "nor_documents"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_nor_location_nor_event"
          FOREIGN KEY ("nor_tendered_event_id") REFERENCES "sof_events"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_nor_location_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_nor_location_voyage_operation_time"
      ON "${TABLE}" ("voyage_id", "operation", "evidence_time")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_nor_location_nor_document"
      ON "${TABLE}" ("nor_document_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_nor_location_nor_event"
      ON "${TABLE}" ("nor_tendered_event_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_nor_location_sof_document"
      ON "${TABLE}" ("sof_document_id")
    `);

    const ownershipFunctions = [
      {
        name: 'nor_document_belongs_to_voyage',
        sql: `SELECT EXISTS (
          SELECT 1 FROM public.nor_documents item
          WHERE item.id = $1 AND item.voyage_id = $2
        )`,
      },
      {
        name: 'sof_document_belongs_to_voyage',
        sql: `SELECT EXISTS (
          SELECT 1 FROM public.sof_documents item
          WHERE item.id = $1 AND item.voyage_id = $2
        )`,
      },
      {
        name: 'sof_event_belongs_to_voyage',
        sql: `SELECT EXISTS (
          SELECT 1
          FROM public.sof_events event
          JOIN public.sof_documents document ON document.id = event.sof_id
          WHERE event.id = $1
            AND event.event_type = 'NOR_TENDERED'
            AND document.voyage_id = $2
        )`,
      },
    ] as const;

    await queryRunner.query(`
      GRANT SELECT (id, voyage_id) ON TABLE public.sof_documents
      TO ${AUTHENTICATOR_ROLE}
    `);
    for (const [table, columns] of Object.entries(
      AUTHENTICATOR_COLUMN_GRANTS,
    )) {
      await queryRunner.query(`
        GRANT SELECT (${columns}) ON TABLE public.${table}
        TO ${AUTHENTICATOR_ROLE}
      `);
    }

    for (const [table, expression] of Object.entries(
      AUTHENTICATOR_POLICY_EXPRESSIONS,
    )) {
      await queryRunner.query(`
        CREATE POLICY authenticator_function_read_${table}
        ON public.${table}
        AS PERMISSIVE
        FOR SELECT
        TO ${AUTHENTICATOR_ROLE}
        USING (${expression})
      `);
    }

    for (const helper of ownershipFunctions) {
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION app.${helper.name}(item_id uuid, voyage_id uuid)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $function$
          ${helper.sql}
        $function$
      `);
      await queryRunner.query(`
        ALTER FUNCTION app.${helper.name}(uuid, uuid)
        OWNER TO ${AUTHENTICATOR_ROLE}
      `);
      await queryRunner.query(`
        REVOKE ALL ON FUNCTION app.${helper.name}(uuid, uuid) FROM PUBLIC
      `);
      await queryRunner.query(`
        GRANT EXECUTE ON FUNCTION app.${helper.name}(uuid, uuid)
        TO ${APPLICATION_ROLE}
      `);
    }

    const expression = `
      app.voyage_belongs_to_current_tenant(voyage_id)
      AND app.user_belongs_to_current_tenant(created_by_user_id)
      AND (
        sof_document_id IS NULL
        OR app.sof_document_belongs_to_voyage(sof_document_id, voyage_id)
      )
      AND (
        nor_document_id IS NULL
        OR app.nor_document_belongs_to_voyage(nor_document_id, voyage_id)
      )
      AND (
        nor_tendered_event_id IS NULL
        OR app.sof_event_belongs_to_voyage(nor_tendered_event_id, voyage_id)
      )
    `;

    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${TABLE}
      TO ${APPLICATION_ROLE}
    `);
    await queryRunner.query(
      `ALTER TABLE public.${TABLE} ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public.${TABLE} FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY ${POLICY}
      ON public.${TABLE}
      AS PERMISSIVE
      FOR ALL
      TO ${APPLICATION_ROLE}
      USING (${expression})
      WITH CHECK (${expression})
    `);
    await queryRunner.query(
      `REVOKE CREATE ON SCHEMA app FROM ${AUTHENTICATOR_ROLE}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS ${POLICY} ON public.${TABLE}`,
    );
    await queryRunner.query(
      `ALTER TABLE public.${TABLE} NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public.${TABLE} DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.${TABLE}
      FROM ${APPLICATION_ROLE}
    `);
    await queryRunner.query(`DROP TABLE "${TABLE}"`);

    for (const functionName of [
      'sof_event_belongs_to_voyage',
      'sof_document_belongs_to_voyage',
      'nor_document_belongs_to_voyage',
    ]) {
      await queryRunner.query(
        `DROP FUNCTION IF EXISTS app.${functionName}(uuid, uuid)`,
      );
    }
    await queryRunner.query(`
      REVOKE SELECT (id, voyage_id) ON TABLE public.sof_documents
      FROM ${AUTHENTICATOR_ROLE}
    `);
    for (const [table, columns] of Object.entries(
      AUTHENTICATOR_COLUMN_GRANTS,
    )) {
      await queryRunner.query(`
        REVOKE SELECT (${columns}) ON TABLE public.${table}
        FROM ${AUTHENTICATOR_ROLE}
      `);
    }
    for (const table of Object.keys(AUTHENTICATOR_COLUMN_GRANTS).reverse()) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS authenticator_function_read_${table} ON public.${table}`,
      );
    }
  }
}
