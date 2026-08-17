import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSofEventOperation1787100000000 implements MigrationInterface {
  name = 'AddSofEventOperation1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sof_events"
      ADD "operation" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sof_events"
      DROP COLUMN "operation"
    `);
  }
}
