import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { createDatabaseConfig } from '../config/database.config';

type IdentityRow = { current_user: string; session_user: string };
type ResolverRow = {
  user_id: string;
  organization_id: string;
  organization_exists: boolean;
};

const checks: string[] = [];

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) {
    throw new Error(`RLS verification failed: ${label}`);
  }
  checks.push(label);
}

async function setContext(
  runner: QueryRunner,
  organizationId: string,
  userId: string,
): Promise<void> {
  await runner.query(
    `SELECT set_config('app.current_tenant_id', $1, true),
            set_config('app.current_user_id', $2, true)`,
    [organizationId, userId],
  );
}

async function expectPolicyRejection(
  runner: QueryRunner,
  statement: string,
  parameters: unknown[],
  label: string,
): Promise<void> {
  const savepoint = `rls_probe_${checks.length}`;
  await runner.query(`SAVEPOINT ${savepoint}`);
  try {
    await runner.query(statement, parameters);
    throw new Error(`RLS verification failed: ${label} was accepted`);
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined;
    if (code !== '42501') {
      throw error;
    }
    await runner.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    checks.push(label);
  }
}

async function verifyPostgresRls(): Promise<void> {
  const dataSource = new DataSource(
    createDatabaseConfig({ useApplicationRole: false }),
  );
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  await runner.connect();

  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const vesselA = randomUUID();
  const vesselB = randomUUID();
  const voyageA = randomUUID();
  const voyageB = randomUUID();
  const voyageAInserted = randomUUID();
  const charterPartyA = randomUUID();
  const charterPartyB = randomUUID();
  const firebaseUidA = `rls-probe-a-${randomUUID()}`;
  const firebaseUidB = `rls-probe-b-${randomUUID()}`;
  let ownerIdentity: IdentityRow | undefined;
  let runtimeIdentity: IdentityRow | undefined;

  try {
    [ownerIdentity] = (await runner.query(
      'SELECT current_user, session_user',
    )) as IdentityRow[];
    await runner.startTransaction();
    await runner.query('SET LOCAL ROLE demurrage_defender_app');
    [runtimeIdentity] = (await runner.query(
      'SELECT current_user, session_user',
    )) as IdentityRow[];
    assert(
      runtimeIdentity.current_user === 'demurrage_defender_app' &&
        runtimeIdentity.session_user === ownerIdentity.session_user,
      'migration login and restricted runtime authority are separate',
    );

    await setContext(runner, organizationA, userA);
    await runner.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, 'RLS transaction probe A', $2)`,
      [organizationA, `rls-probe-a-${organizationA}`],
    );
    await runner.query(
      `INSERT INTO users (id, firebase_uid, email, full_name, organization_id)
       VALUES ($1, $2, $3, 'RLS Probe A', $4)`,
      [userA, firebaseUidA, `${firebaseUidA}@example.test`, organizationA],
    );
    await runner.query(
      `INSERT INTO vessels (id, organization_id, imo, name, flag, type, dwt)
       VALUES ($1, $2, $3, 'RLS Probe Vessel A', 'AU', 'Bulk Carrier', 75000)`,
      [
        vesselA,
        organizationA,
        `8${organizationA.replaceAll('-', '').slice(0, 6)}`,
      ],
    );
    await runner.query(
      `INSERT INTO voyages
         (id, organization_id, reference, vessel_id, cargo_quantity, cargo_type,
          load_port, discharge_port, laycan_start, laycan_end)
       VALUES ($1, $2, $3, $4, 10000, 'Iron Ore', 'AUSYD', 'SGSIN',
               '2026-01-01', '2026-01-05')`,
      [voyageA, organizationA, `RLS-A-${voyageA}`, vesselA],
    );
    await runner.query(
      `INSERT INTO charter_parties
         (id, voyage_id, form_type, full_text, effective_date)
       VALUES ($1, $2, 'GENCON', 'Probe A terms', '2026-01-01')`,
      [charterPartyA, voyageA],
    );

    await setContext(runner, organizationB, userB);
    await runner.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, 'RLS transaction probe B', $2)`,
      [organizationB, `rls-probe-b-${organizationB}`],
    );
    await runner.query(
      `INSERT INTO users (id, firebase_uid, email, full_name, organization_id)
       VALUES ($1, $2, $3, 'RLS Probe B', $4)`,
      [userB, firebaseUidB, `${firebaseUidB}@example.test`, organizationB],
    );
    await runner.query(
      `INSERT INTO vessels (id, organization_id, imo, name, flag, type, dwt)
       VALUES ($1, $2, $3, 'RLS Probe Vessel B', 'SG', 'Bulk Carrier', 76000)`,
      [
        vesselB,
        organizationB,
        `9${organizationB.replaceAll('-', '').slice(0, 6)}`,
      ],
    );
    await runner.query(
      `INSERT INTO voyages
         (id, organization_id, reference, vessel_id, cargo_quantity, cargo_type,
          load_port, discharge_port, laycan_start, laycan_end)
       VALUES ($1, $2, $3, $4, 20000, 'Coal', 'SGSIN', 'AUSYD',
               '2026-02-01', '2026-02-05')`,
      [voyageB, organizationB, `RLS-B-${voyageB}`, vesselB],
    );
    await runner.query(
      `INSERT INTO charter_parties
         (id, voyage_id, form_type, full_text, effective_date)
       VALUES ($1, $2, 'GENCON', 'Probe B terms', '2026-02-01')`,
      [charterPartyB, voyageB],
    );

    await setContext(runner, '', '');
    const noContext = (await runner.query(
      'SELECT id FROM voyages WHERE id IN ($1, $2)',
      [voyageA, voyageB],
    )) as Array<{ id: string }>;
    assert(
      noContext.length === 0,
      'missing tenant context reads no tenant rows',
    );

    const resolvedA = (await runner.query(
      'SELECT * FROM app.resolve_authenticated_user($1::text)',
      [firebaseUidA],
    )) as ResolverRow[];
    assert(
      resolvedA.length === 1 &&
        resolvedA[0].user_id === userA &&
        resolvedA[0].organization_id === organizationA &&
        resolvedA[0].organization_exists,
      'verified Firebase UID resolves only its mapped user and organization',
    );
    const unresolved = (await runner.query(
      'SELECT * FROM app.resolve_authenticated_user($1::text)',
      [`unknown-${randomUUID()}`],
    )) as ResolverRow[];
    assert(
      unresolved.length === 0,
      'bootstrap does not enumerate unrelated users',
    );

    await setContext(runner, organizationA, userA);
    const visibleVoyages = (await runner.query(
      'SELECT id FROM voyages WHERE id IN ($1, $2) ORDER BY id',
      [voyageA, voyageB],
    )) as Array<{ id: string }>;
    assert(
      visibleVoyages.length === 1 && visibleVoyages[0].id === voyageA,
      'Tenant A selects its Voyage and cannot select Tenant B Voyage',
    );
    await runner.query(
      `UPDATE voyages SET cargo_quantity = cargo_quantity + 1
       WHERE id = $1`,
      [voyageA],
    );
    const [updatedOwnVoyage] = (await runner.query(
      'SELECT cargo_quantity::numeric AS cargo_quantity FROM voyages WHERE id = $1',
      [voyageA],
    )) as Array<{ cargo_quantity: string }>;
    assert(
      Number(updatedOwnVoyage?.cargo_quantity) === 10001,
      'Tenant A updates its own Voyage',
    );
    await runner.query(
      `UPDATE voyages SET cargo_quantity = cargo_quantity + 1
       WHERE id = $1`,
      [voyageB],
    );
    await setContext(runner, organizationB, userB);
    const [unchangedCrossTenantVoyage] = (await runner.query(
      'SELECT cargo_quantity::numeric AS cargo_quantity FROM voyages WHERE id = $1',
      [voyageB],
    )) as Array<{ cargo_quantity: string }>;
    assert(
      Number(unchangedCrossTenantVoyage?.cargo_quantity) === 20000,
      'Tenant A cannot update Tenant B Voyage',
    );
    await setContext(runner, organizationA, userA);
    await runner.query(
      `INSERT INTO voyages
         (id, organization_id, reference, vessel_id, cargo_quantity, cargo_type,
          load_port, discharge_port, laycan_start, laycan_end)
       VALUES ($1, $2, $3, $4, 12000, 'Iron Ore', 'AUSYD', 'SGSIN',
               '2026-03-01', '2026-03-05')`,
      [voyageAInserted, organizationA, `RLS-AI-${voyageAInserted}`, vesselA],
    );
    assert(true, 'Tenant A inserts its own Voyage');
    await expectPolicyRejection(
      runner,
      `INSERT INTO voyages
         (id, organization_id, reference, vessel_id, cargo_quantity, cargo_type,
          load_port, discharge_port, laycan_start, laycan_end)
       VALUES ($1, $2, $3, $4, 12000, 'Coal', 'SGSIN', 'AUSYD',
               '2026-03-01', '2026-03-05')`,
      [randomUUID(), organizationB, `RLS-X-${randomUUID()}`, vesselB],
      'Tenant A cannot insert Tenant B Voyage',
    );

    const visibleParents = (await runner.query(
      'SELECT id FROM charter_parties WHERE id IN ($1, $2)',
      [charterPartyA, charterPartyB],
    )) as Array<{ id: string }>;
    assert(
      visibleParents.length === 1 && visibleParents[0].id === charterPartyA,
      'parent/helper policy path remains tenant-scoped',
    );

    await expectPolicyRejection(
      runner,
      'SET LOCAL ROLE demurrage_defender_authenticator',
      [],
      'restricted application role cannot SET ROLE authenticator',
    );

    await runner.rollbackTransaction();
    await runner.query('SET ROLE demurrage_defender_app');
    const rolledBack = (await runner.query(
      'SELECT * FROM app.resolve_authenticated_user($1::text)',
      [firebaseUidA],
    )) as ResolverRow[];
    assert(
      rolledBack.length === 0,
      'verification fixtures are fully rolled back',
    );
    await runner.query('RESET ROLE');

    process.stdout.write(
      `${JSON.stringify(
        {
          owner_identity: ownerIdentity,
          runtime_identity: runtimeIdentity,
          transaction_rolled_back: true,
          checks_passed: checks.length,
          checks,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    if (runner.isTransactionActive) {
      await runner.rollbackTransaction();
    }
    throw error;
  } finally {
    await runner.release();
    await dataSource.destroy();
  }
}

void verifyPostgresRls().catch((error: unknown) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(
    `PostgreSQL RLS verification failed (${code}): ${message}\n`,
  );
  process.exitCode = 1;
});
