import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaytimeStatementsV11789000000000 implements MigrationInterface {
  name = 'AddLaytimeStatementsV11789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "laytime_statements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "voyage_id" uuid NOT NULL,
        "charter_party_id" uuid,
        "source_calculation_id" uuid NOT NULL,
        "source_calculation_version" integer NOT NULL,
        "loading_calculation_id" uuid,
        "discharge_calculation_id" uuid,
        "authoritative_sof_document_ids" jsonb NOT NULL,
        "settlement_authority_status" character varying(30) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "version" integer NOT NULL,
        "statement_snapshot" jsonb NOT NULL,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_laytime_statements_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laytime_statements_source_calculation" UNIQUE ("source_calculation_id"),
        CONSTRAINT "UQ_laytime_statements_voyage_version" UNIQUE ("voyage_id", "version"),
        CONSTRAINT "FK_laytime_statements_voyage" FOREIGN KEY ("voyage_id") REFERENCES "voyages"("id"),
        CONSTRAINT "FK_laytime_statements_calculation" FOREIGN KEY ("source_calculation_id") REFERENCES "laytime_calculations"("id"),
        CONSTRAINT "FK_laytime_statements_charter_party" FOREIGN KEY ("charter_party_id") REFERENCES "charter_parties"("id"),
        CONSTRAINT "FK_laytime_statements_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id"),
        CONSTRAINT "chk_laytime_statements_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "chk_laytime_statements_authority" CHECK ("settlement_authority_status" = 'FINAL_AUTHORITATIVE'),
        CONSTRAINT "chk_laytime_statements_version" CHECK ("version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_laytime_statements_voyage" ON "laytime_statements" ("voyage_id")`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON TABLE public."laytime_statements" TO demurrage_defender_app`,
    );
    await queryRunner.query(
      `ALTER TABLE public."laytime_statements" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public."laytime_statements" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation_laytime_statements"
      ON public."laytime_statements" AS PERMISSIVE FOR ALL TO demurrage_defender_app
      USING (app.voyage_belongs_to_current_tenant("voyage_id"))
      WITH CHECK (app.voyage_belongs_to_current_tenant("voyage_id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation_laytime_statements" ON public."laytime_statements"`,
    );
    await queryRunner.query(`DROP TABLE "laytime_statements"`);
  }
}
