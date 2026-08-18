import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaytimeCalculationChildUniqueOperation1787300000000
  implements MigrationInterface
{
  name = 'AddLaytimeCalculationChildUniqueOperation1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_laytime_calc_parent_operation_child"
      ON "laytime_calculations" ("parent_calculation_id", "operation")
      WHERE "parent_calculation_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "uq_laytime_calc_parent_operation_child"
    `);
  }
}
