import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNonReversibleSettlementV11788000000000
  implements MigrationInterface
{
  name = 'AddNonReversibleSettlementV11788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      ADD COLUMN "laytime_operation_scope" character varying(30),
      ADD CONSTRAINT "chk_charter_party_laytime_operation_scope"
        CHECK ("laytime_operation_scope" IN ('Loading', 'Discharge', 'LoadingAndDischarge'))
    `);
    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      ADD COLUMN "settlement_authority_status" character varying(30),
      ADD CONSTRAINT "chk_laytime_settlement_authority_status"
        CHECK ("settlement_authority_status" IN ('FINAL_AUTHORITATIVE', 'PROVISIONAL', 'NONAUTHORITATIVE', 'LEGACY')),
      ALTER COLUMN "allowed_laytime" DROP NOT NULL,
      ALTER COLUMN "used_laytime" DROP NOT NULL,
      ALTER COLUMN "demurrage_amount" DROP NOT NULL,
      ALTER COLUMN "despatch_amount" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "laytime_calculations"
      SET "allowed_laytime" = COALESCE("allowed_laytime", interval '0 seconds'),
          "used_laytime" = COALESCE("used_laytime", interval '0 seconds'),
          "demurrage_amount" = COALESCE("demurrage_amount", 0),
          "despatch_amount" = COALESCE("despatch_amount", 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "laytime_calculations"
      ALTER COLUMN "allowed_laytime" SET NOT NULL,
      ALTER COLUMN "used_laytime" SET NOT NULL,
      ALTER COLUMN "demurrage_amount" SET NOT NULL,
      ALTER COLUMN "despatch_amount" SET NOT NULL,
      DROP CONSTRAINT "chk_laytime_settlement_authority_status",
      DROP COLUMN "settlement_authority_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "charter_parties"
      DROP CONSTRAINT "chk_charter_party_laytime_operation_scope",
      DROP COLUMN "laytime_operation_scope"
    `);
  }
}
