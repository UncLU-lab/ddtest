import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthoritativeCalculationCurrencyV11788100000000
  implements MigrationInterface
{
  name = 'AddAuthoritativeCalculationCurrencyV11788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD COLUMN "settlement_currency" character varying(3),
      ADD CONSTRAINT "chk_charter_party_settlement_currency_shape"
        CHECK ("settlement_currency" IS NULL OR "settlement_currency" ~ '^[A-Z]{3}$')
    `);
    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      ADD COLUMN "currency" character varying(3),
      ADD CONSTRAINT "chk_laytime_calculation_currency_shape"
        CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$')
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_cases_bulk"
      ADD COLUMN "currency" character varying(3),
      ADD CONSTRAINT "chk_dispute_case_bulk_currency_shape"
        CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dispute_cases_bulk"
      DROP CONSTRAINT "chk_dispute_case_bulk_currency_shape",
      DROP COLUMN "currency"
    `);
    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      DROP CONSTRAINT "chk_laytime_calculation_currency_shape",
      DROP COLUMN "currency"
    `);
    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP CONSTRAINT "chk_charter_party_settlement_currency_shape",
      DROP COLUMN "settlement_currency"
    `);
  }
}
