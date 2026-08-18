import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreopsCharterPartyTerms1787050000001
  implements MigrationInterface
{
  name = 'AddPreopsCharterPartyTerms1787050000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD "laytime_allowed" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD "demurrage_rate" numeric(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD "dispatch_rate" numeric(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD "time_counting_basis" character varying(20)
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD "nor_notice_period" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP COLUMN "nor_notice_period"
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP COLUMN "time_counting_basis"
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP COLUMN "dispatch_rate"
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP COLUMN "demurrage_rate"
    `);

    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP COLUMN "laytime_allowed"
    `);
  }
}
