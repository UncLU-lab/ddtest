import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSofDocumentOperation1787200000000 implements MigrationInterface {
  name = 'AddSofDocumentOperation1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sof_documents"
      ADD "operation" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sof_documents"
      DROP COLUMN "operation"
    `);
  }
}
