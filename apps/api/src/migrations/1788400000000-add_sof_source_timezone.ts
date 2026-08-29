import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSofSourceTimezone1788400000000 implements MigrationInterface {
  name = 'AddSofSourceTimezone1788400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "sof_events" ADD "source_time_zone" character varying(100)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "sof_events" DROP COLUMN "source_time_zone"');
  }
}
