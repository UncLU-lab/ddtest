import { MigrationInterface, QueryRunner } from 'typeorm';

const APPLICATION_ROLE = 'demurrage_defender_app';
const AUTHENTICATOR_ROLE = 'demurrage_defender_authenticator';

const SECURITY_DEFINER_FUNCTIONS = [
  'user_belongs_to_current_tenant(uuid)',
  'vessel_belongs_to_current_tenant(uuid)',
  'counterparty_belongs_to_current_tenant(uuid)',
  'voyage_belongs_to_current_tenant(uuid)',
  'charter_party_belongs_to_current_tenant(uuid)',
  'cp_clause_belongs_to_current_tenant(uuid)',
  'sof_document_belongs_to_current_tenant(uuid)',
  'laytime_calculation_belongs_to_current_tenant(uuid)',
  'nor_document_belongs_to_voyage(uuid, uuid)',
  'sof_document_belongs_to_voyage(uuid, uuid)',
  'sof_event_belongs_to_voyage(uuid, uuid)',
  'resolve_authenticated_user(text)',
] as const;

export class HardenRlsFunctionSearchPath1788300000000
  implements MigrationInterface
{
  name = 'HardenRlsFunctionSearchPath1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT ${AUTHENTICATOR_ROLE} TO CURRENT_USER WITH SET TRUE`,
    );
    await queryRunner.query(
      `REVOKE ${AUTHENTICATOR_ROLE} FROM ${APPLICATION_ROLE}`,
    );

    for (const functionSignature of SECURITY_DEFINER_FUNCTIONS) {
      await queryRunner.query(`
        ALTER FUNCTION app.${functionSignature}
        OWNER TO ${AUTHENTICATOR_ROLE}
      `);
      await queryRunner.query(`
        ALTER FUNCTION app.${functionSignature}
        SECURITY DEFINER
      `);
      await queryRunner.query(`
        ALTER FUNCTION app.${functionSignature}
        SET search_path = pg_catalog
      `);
      await queryRunner.query(`
        REVOKE ALL ON FUNCTION app.${functionSignature} FROM PUBLIC
      `);
      await queryRunner.query(`
        GRANT EXECUTE ON FUNCTION app.${functionSignature}
        TO ${APPLICATION_ROLE}
      `);
    }

    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION
        app.user_belongs_to_current_tenant(uuid),
        app.vessel_belongs_to_current_tenant(uuid),
        app.counterparty_belongs_to_current_tenant(uuid),
        app.cp_clause_belongs_to_current_tenant(uuid),
        app.laytime_calculation_belongs_to_current_tenant(uuid),
        app.nor_document_belongs_to_voyage(uuid, uuid),
        app.sof_document_belongs_to_voyage(uuid, uuid),
        app.sof_event_belongs_to_voyage(uuid, uuid),
        app.resolve_authenticated_user(text)
      FROM ${AUTHENTICATOR_ROLE}
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION
        app.voyage_belongs_to_current_tenant(uuid),
        app.charter_party_belongs_to_current_tenant(uuid),
        app.sof_document_belongs_to_current_tenant(uuid)
      TO ${AUTHENTICATOR_ROLE}
    `);

    await queryRunner.query(`
      DO $membership$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_auth_members membership
          JOIN pg_roles target ON target.oid = membership.roleid
          JOIN pg_roles member ON member.oid = membership.member
          WHERE target.rolname = '${AUTHENTICATOR_ROLE}'
            AND member.rolname = '${APPLICATION_ROLE}'
        ) THEN
          RAISE EXCEPTION 'Application role must not be a member of authenticator';
        END IF;
      END
      $membership$;
    `);
    await queryRunner.query(`REVOKE ${AUTHENTICATOR_ROLE} FROM CURRENT_USER`);
  }

  public down(): Promise<void> {
    return Promise.resolve();
  }
}
