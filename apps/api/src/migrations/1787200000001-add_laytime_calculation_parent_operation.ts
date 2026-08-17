import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaytimeCalculationParentOperation1787200000001
  implements MigrationInterface
{
  name = 'AddLaytimeCalculationParentOperation1787200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      ADD "parent_calculation_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      ADD "operation" character varying(20)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_laytime_calc_voyage_parent_version"
      ON "laytime_calculations" ("voyage_id", "parent_calculation_id", "version")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_laytime_calc_parent_operation"
      ON "laytime_calculations" ("parent_calculation_id", "operation")
    `);

    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      ADD CONSTRAINT "fk_laytime_calculations_parent"
      FOREIGN KEY ("parent_calculation_id")
      REFERENCES "laytime_calculations"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      DROP CONSTRAINT "fk_laytime_calculations_parent"
    `);

    await queryRunner.query(`
      DROP INDEX "idx_laytime_calc_parent_operation"
    `);

    await queryRunner.query(`
      DROP INDEX "idx_laytime_calc_voyage_parent_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      DROP COLUMN "operation"
    `);

    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      DROP COLUMN "parent_calculation_id"
    `);
  }
}
