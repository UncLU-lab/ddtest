import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNorLocationEvidenceSourceTimezone1788500000000
  implements MigrationInterface
{
  name = 'AddNorLocationEvidenceSourceTimezone1788500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "nor_tender_location_evidence" ADD "source_time_zone" character varying(100)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "nor_tender_location_evidence" DROP COLUMN "source_time_zone"',
    );
  }
}
