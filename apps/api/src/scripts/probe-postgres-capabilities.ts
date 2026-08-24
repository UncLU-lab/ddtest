import { DataSource } from 'typeorm';
import { createDatabaseConfig } from '../config/database.config';

interface CurrentRoleRow {
  current_user: string;
  session_user: string;
  rolsuper: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolcanlogin: boolean;
  rolinherit: boolean;
  rolbypassrls: boolean;
}

async function probePostgresCapabilities(): Promise<void> {
  const dataSource = new DataSource(
    createDatabaseConfig({ useApplicationRole: false }),
  );
  await dataSource.initialize();

  const probeRole = `demurrage_defender_probe_${process.pid}_${Date.now()}`;
  const queryRunner = dataSource.createQueryRunner();
  let ordinaryRoleCreated = false;
  let membershipGranted = false;
  let membershipVisible = false;

  try {
    const [identity] = (await queryRunner.query(`
        SELECT
          current_user,
          session_user,
          role.rolsuper,
          role.rolcreaterole,
          role.rolcreatedb,
          role.rolcanlogin,
          role.rolinherit,
          role.rolbypassrls
        FROM pg_roles role
        WHERE role.rolname = current_user
      `)) as CurrentRoleRow[];

    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        CREATE ROLE ${probeRole}
          NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
      `);
      ordinaryRoleCreated = true;

      await queryRunner.query(`GRANT ${probeRole} TO CURRENT_USER`);
      membershipGranted = true;

      const [membership] = (await queryRunner.query(
        `SELECT pg_has_role(current_user, $1, 'MEMBER') AS member`,
        [probeRole],
      )) as Array<{ member: boolean }>;
      membershipVisible = membership.member;
    } finally {
      await queryRunner.rollbackTransaction();
    }

    const [cleanup] = (await queryRunner.query(
      `SELECT EXISTS (
           SELECT 1 FROM pg_roles WHERE rolname = $1
         ) AS exists`,
      [probeRole],
    )) as Array<{ exists: boolean }>;

    process.stdout.write(
      `${JSON.stringify(
        {
          identity,
          capabilities: {
            ordinary_nologin_role_create: ordinaryRoleCreated,
            role_membership_grant: membershipGranted,
            role_membership_visible: membershipVisible,
          },
          probe_role_removed: !cleanup.exists,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

void probePostgresCapabilities().catch((error: unknown) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  process.stderr.write(`PostgreSQL capability probe failed (${code}).\n`);
  process.exitCode = 1;
});
