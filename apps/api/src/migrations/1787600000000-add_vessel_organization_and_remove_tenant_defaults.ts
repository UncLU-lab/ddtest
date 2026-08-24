import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVesselOrganizationAndRemoveTenantDefaults1787600000000
  implements MigrationInterface
{
  name = 'AddVesselOrganizationAndRemoveTenantDefaults1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vessels"
      ADD "organization_id" uuid NOT NULL
      DEFAULT '00000000-0000-0000-0000-000000000001'
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_vessels_organization"
      ON "vessels" ("organization_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "vessels"
      ADD CONSTRAINT "FK_vessels_organization"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "vessels"
      ALTER COLUMN "organization_id" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ALTER COLUMN "organization_id" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ALTER COLUMN "organization_id" DROP DEFAULT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "counterparties"
      ALTER COLUMN "organization_id"
      SET DEFAULT '00000000-0000-0000-0000-000000000001'
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ALTER COLUMN "organization_id"
      SET DEFAULT '00000000-0000-0000-0000-000000000001'
    `);

    await queryRunner.query(`
      ALTER TABLE "vessels"
      DROP CONSTRAINT "FK_vessels_organization"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_vessels_organization"
    `);

    await queryRunner.query(`
      ALTER TABLE "vessels"
      DROP COLUMN "organization_id"
    `);
  }
}
