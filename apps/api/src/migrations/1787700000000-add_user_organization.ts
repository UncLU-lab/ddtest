import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserOrganization1787700000000 implements MigrationInterface {
  name = 'AddUserOrganization1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "organization_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_organization"
      ON "users" ("organization_id")
    `);

    // Existing rows require explicit provisioning, while all new rows must be scoped.
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "chk_users_organization_required"
      CHECK ("organization_id" IS NOT NULL) NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_organization"
      FOREIGN KEY ("organization_id")
      REFERENCES "organizations"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT "FK_users_organization"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT "chk_users_organization_required"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."idx_users_organization"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "organization_id"
    `);
  }
}
