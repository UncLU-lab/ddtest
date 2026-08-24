import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoyageBulkOperationType1787400000000
  implements MigrationInterface
{
  name = 'AddVoyageBulkOperationType1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD "bulk_operation_type" character varying(20)
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      ADD CONSTRAINT "chk_voyages_bulk_operation_type"
      CHECK (
        "bulk_operation_type" IS NULL
        OR "bulk_operation_type" IN ('dry_bulk', 'tanker')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP CONSTRAINT "chk_voyages_bulk_operation_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "voyages"
      DROP COLUMN "bulk_operation_type"
    `);
  }
}
