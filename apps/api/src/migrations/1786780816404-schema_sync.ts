import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaSync1786780816404 implements MigrationInterface {
  name = 'SchemaSync1786780816404';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------
    // Organizations
    // ------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_organizations_slug"
      ON "organizations" ("slug")
    `);

    // The existing entities use this UUID as the default organization.
    // Insert it before adding foreign keys that reference it.
    await queryRunner.query(`
      INSERT INTO "organizations" (
        "id",
        "name",
        "slug"
      )
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Default Organization',
        'default'
      )
    `);

    // ------------------------------------------------------------
    // Voyage counterparties
    // ------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "voyage_counterparties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "voyage_id" uuid NOT NULL,
        "counterparty_id" uuid NOT NULL,
        "role" character varying(20) NOT NULL,
        CONSTRAINT "PK_c6b4ea702d207d69e9785ce45dd"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_voyage_counterparties_voyage"
      ON "voyage_counterparties" ("voyage_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_voyage_counterparties_counterparty"
      ON "voyage_counterparties" ("counterparty_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_voyage_counterparties_link"
      ON "voyage_counterparties"
      ("voyage_id", "counterparty_id", "role")
    `);

    // ------------------------------------------------------------
    // Counterparties
    // ------------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ADD "organization_id" uuid
      NOT NULL
      DEFAULT '00000000-0000-0000-0000-000000000001'
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ADD "status" character varying(20)
      NOT NULL
      DEFAULT 'Active'
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ADD "created_at" TIMESTAMP WITH TIME ZONE
      NOT NULL
      DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ADD "updated_at" TIMESTAMP WITH TIME ZONE
      NOT NULL
      DEFAULT now()
    `);

    // ------------------------------------------------------------
    // Voyages
    // ------------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "organization_id" uuid
      NOT NULL
      DEFAULT '00000000-0000-0000-0000-000000000001'
    `);

    // IMPORTANT:
    // Existing voyages already exist, so reference must initially
    // be nullable while we populate it.
    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "reference" character varying(100)
    `);

    // Generate a unique reference for every existing voyage.
    //
    // Example:
    // VOY-<existing voyage UUID>
    //
    // This guarantees uniqueness without relying on existing data.
    await queryRunner.query(`
      UPDATE "voyages"
      SET "reference" = 'VOY-' || "id"::text
      WHERE "reference" IS NULL
    `);

    // Now that every existing row has a value, make it required.
    await queryRunner.query(`
      ALTER TABLE "voyages"
      ALTER COLUMN "reference" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "cargo_quantity_unit" character varying(10)
      NOT NULL
      DEFAULT 'MT'
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "eta" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "laytime_operation" character varying(20)
      NOT NULL
      DEFAULT 'Discharge'
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "calculation_time_zone" character varying(100)
      NOT NULL
      DEFAULT 'UTC'
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "notes" text
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "created_by_user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "updated_by_user_id" uuid
    `);

    // ------------------------------------------------------------
    // Free time clocks
    // ------------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "free_time_clocks"
      ALTER COLUMN "free_time_used"
      SET DEFAULT '0'
    `);

    // ------------------------------------------------------------
    // Indexes
    // ------------------------------------------------------------

    await queryRunner.query(`
      CREATE INDEX "idx_counterparties_organization_status"
      ON "counterparties" ("organization_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_counterparties_organization_name"
      ON "counterparties" ("organization_id", "name")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_voyages_organization"
      ON "voyages" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_voyages_organization_reference"
      ON "voyages" ("organization_id", "reference")
    `);

    // ------------------------------------------------------------
    // Foreign keys
    // ------------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ADD CONSTRAINT "FK_9d29073e67e125787cedef475bb"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "voyage_counterparties"
      ADD CONSTRAINT "FK_029ec833b110fc25175584c7b85"
      FOREIGN KEY ("voyage_id")
      REFERENCES "voyages"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "voyage_counterparties"
      ADD CONSTRAINT "FK_f49dbb84694128ed3f40a7e9e7c"
      FOREIGN KEY ("counterparty_id")
      REFERENCES "counterparties"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD CONSTRAINT "FK_d0e633149277e0fa5af7bbaac98"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD CONSTRAINT "FK_87abe3dd4ef7e75f841d91bc2a7"
      FOREIGN KEY ("created_by_user_id")
      REFERENCES "users"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD CONSTRAINT "FK_d8fe216cc470bd88f963f957358"
      FOREIGN KEY ("updated_by_user_id")
      REFERENCES "users"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------
    // Foreign keys
    // ------------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP CONSTRAINT "FK_d8fe216cc470bd88f963f957358"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP CONSTRAINT "FK_87abe3dd4ef7e75f841d91bc2a7"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP CONSTRAINT "FK_d0e633149277e0fa5af7bbaac98"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyage_counterparties"
      DROP CONSTRAINT "FK_f49dbb84694128ed3f40a7e9e7c"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyage_counterparties"
      DROP CONSTRAINT "FK_029ec833b110fc25175584c7b85"
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      DROP CONSTRAINT "FK_9d29073e67e125787cedef475bb"
    `);

    // ------------------------------------------------------------
    // Indexes
    // ------------------------------------------------------------

    await queryRunner.query(`
      DROP INDEX "public"."uq_voyages_organization_reference"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_voyages_organization"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_counterparties_organization_name"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_counterparties_organization_status"
    `);

    // ------------------------------------------------------------
    // Columns
    // ------------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "free_time_clocks"
      ALTER COLUMN "free_time_used"
      SET DEFAULT '00:00:00'
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "updated_by_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "created_by_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "notes"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "calculation_time_zone"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "laytime_operation"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "eta"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "cargo_quantity_unit"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "reference"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "organization_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      DROP COLUMN "updated_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      DROP COLUMN "created_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      DROP COLUMN "status"
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      DROP COLUMN "organization_id"
    `);

    // ------------------------------------------------------------
    // Voyage counterparties
    // ------------------------------------------------------------

    await queryRunner.query(`
      DROP INDEX "public"."uq_voyage_counterparties_link"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_voyage_counterparties_counterparty"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_voyage_counterparties_voyage"
    `);

    await queryRunner.query(`
      DROP TABLE "voyage_counterparties"
    `);

    // ------------------------------------------------------------
    // Organizations
    // ------------------------------------------------------------

    await queryRunner.query(`
      DROP INDEX "public"."uq_organizations_slug"
    `);

    await queryRunner.query(`
      DROP TABLE "organizations"
    `);
  }
}