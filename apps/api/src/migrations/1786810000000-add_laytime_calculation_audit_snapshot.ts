import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaytimeCalculationAuditSnapshot1786810000000
  implements MigrationInterface
{
  name = 'AddLaytimeCalculationAuditSnapshot1786810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" ADD "input_snapshot" jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" ADD "decision_snapshot" jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" ADD "warnings" jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" ADD "engine_version" character varying(50)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" DROP COLUMN "engine_version"',
    );
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" DROP COLUMN "warnings"',
    );
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" DROP COLUMN "decision_snapshot"',
    );
    await queryRunner.query(
      'ALTER TABLE "laytime_calculations" DROP COLUMN "input_snapshot"',
    );
  }
}
