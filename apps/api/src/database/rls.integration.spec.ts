import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, EntityManager } from 'typeorm';
import { AppModule } from '../app.module';
import { databaseEntities } from './entities';
import {
  AUTH_IDENTITY_VERIFIER,
  AuthIdentityVerifier,
} from '../modules/cross-cutting/auth/auth-identity-verifier';

const databaseUrl = process.env.RLS_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

const ORGANIZATION_A = '10000000-0000-4000-8000-000000000001';
const ORGANIZATION_B = '20000000-0000-4000-8000-000000000002';
const USER_A = '10000000-0000-4000-8000-000000000011';
const USER_B = '20000000-0000-4000-8000-000000000022';
const VESSEL_A = '10000000-0000-4000-8000-000000000101';
const VESSEL_B = '20000000-0000-4000-8000-000000000202';
const VOYAGE_A = '10000000-0000-4000-8000-000000001001';
const VOYAGE_B = '20000000-0000-4000-8000-000000002002';
const COUNTERPARTY_A = '10000000-0000-4000-8000-000000003001';
const COUNTERPARTY_B = '20000000-0000-4000-8000-000000003002';
const CHARTER_PARTY_A = '10000000-0000-4000-8000-000000004001';
const CHARTER_PARTY_B = '20000000-0000-4000-8000-000000004002';
const CLAUSE_A = '10000000-0000-4000-8000-000000005001';
const SOF_A = '10000000-0000-4000-8000-000000006001';
const SOF_EVENT_A = '10000000-0000-4000-8000-000000007001';
const NOR_A = '10000000-0000-4000-8000-000000008001';
const CALCULATION_A = '10000000-0000-4000-8000-000000009001';
const PERIOD_A = '10000000-0000-4000-8000-000000010001';
const DISPUTE_A = '10000000-0000-4000-8000-000000011001';
const LINK_A = '10000000-0000-4000-8000-000000012001';
const LOCATION_EVIDENCE_A = '10000000-0000-4000-8000-000000013001';

const PROTECTED_TABLES = [
  'organizations',
  'users',
  'voyages',
  'vessels',
  'counterparties',
  'charter_parties',
  'cp_clauses',
  'voyage_counterparties',
  'sof_documents',
  'sof_events',
  'nor_documents',
  'nor_tender_location_evidence',
  'laytime_calculations',
  'calculation_periods',
  'dispute_cases_bulk',
] as const;

function createOwnerDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [...databaseEntities],
    synchronize: false,
  });
}

function createApplicationDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [...databaseEntities],
    synchronize: false,
    extra: {
      max: 1,
      options: '-c role=demurrage_defender_app',
    },
  });
}

async function establishTenant(
  manager: EntityManager,
  organizationId: string,
  userId: string,
): Promise<void> {
  await manager.query(
    `SELECT
       set_config('app.current_tenant_id', $1, true),
       set_config('app.current_user_id', $2, true)`,
    [organizationId, userId],
  );
}

describeWithPostgres('PostgreSQL bulk row-level security', () => {
  let owner: DataSource;
  let application: DataSource;
  let api: INestApplication;

  const asTenant = <T>(
    organizationId: string,
    userId: string,
    work: (manager: EntityManager) => Promise<T>,
  ) =>
    application.transaction(async (manager) => {
      await establishTenant(manager, organizationId, userId);
      return work(manager);
    });

  beforeAll(async () => {
    owner = await createOwnerDataSource().initialize();
    application = await createApplicationDataSource().initialize();

    await owner.query(`TRUNCATE TABLE organizations CASCADE`);
    await seedTenantFixtures(owner);

    const identityVerifier: AuthIdentityVerifier = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'user-a-token') {
          return { subject: 'firebase-user-a', provider: 'firebase' };
        }
        if (token === 'user-b-token') {
          return { subject: 'firebase-user-b', provider: 'firebase' };
        }
        throw new Error('invalid test token');
      }),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_IDENTITY_VERIFIER)
      .useValue(identityVerifier)
      .compile();

    api = moduleRef.createNestApplication();
    api.setGlobalPrefix('api/v1');
    api.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await api.init();
  });

  afterAll(async () => {
    await api?.close();
    await application?.destroy();
    await owner?.destroy();
  });

  it('runs as a non-owner, non-superuser role with RLS forced on every protected table', async () => {
    const [role] = await application.query<
      Array<{
        current_user: string;
        session_user: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
      }>
    >(`
      SELECT
        current_user,
        session_user,
        role.rolsuper,
        role.rolbypassrls
      FROM pg_roles role
      WHERE role.rolname = current_user
    `);
    expect(role).toEqual({
      current_user: 'demurrage_defender_app',
      session_user: 'demurrage-defender-user',
      rolsuper: false,
      rolbypassrls: false,
    });

    const tables = await owner.query<
      Array<{
        tablename: string;
        rowsecurity: boolean;
        forcerowsecurity: boolean;
      }>
    >(
      `
      SELECT
        class.relname AS tablename,
        class.relrowsecurity AS rowsecurity,
        class.relforcerowsecurity AS forcerowsecurity
      FROM pg_class class
      JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public'
        AND class.relname = ANY($1::text[])
      ORDER BY class.relname
    `,
      [PROTECTED_TABLES],
    );

    expect(tables).toHaveLength(PROTECTED_TABLES.length);
    expect(tables).toEqual(
      expect.arrayContaining(
        PROTECTED_TABLES.map((tablename) => ({
          tablename,
          rowsecurity: true,
          forcerowsecurity: true,
        })),
      ),
    );
  });

  it('has one explicit application-role policy per protected table and all required ownership indexes', async () => {
    const policies = await owner.query<
      Array<{ tablename: string; policyname: string }>
    >(
      `SELECT tablename, policyname
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [PROTECTED_TABLES],
    );
    expect(policies).toHaveLength(PROTECTED_TABLES.length);

    const requiredIndexes = [
      'idx_users_organization',
      'idx_vessels_organization',
      'idx_voyages_organization',
      'idx_counterparties_organization_name',
      'idx_charter_parties_voyage',
      'idx_cp_clauses_cp',
      'idx_voyage_counterparties_voyage',
      'idx_voyage_counterparties_counterparty',
      'idx_sof_documents_voyage',
      'idx_sof_events_sof_time',
      'idx_nor_voyage',
      'idx_nor_location_voyage_operation_time',
      'idx_nor_location_nor_document',
      'idx_nor_location_nor_event',
      'idx_nor_location_sof_document',
      'idx_laytime_calc_voyage',
      'idx_calc_periods_calc',
      'idx_disputes_voyage',
    ];
    const indexes = await owner.query<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])`,
      [requiredIndexes],
    );
    expect(indexes.map(({ indexname }) => indexname).sort()).toEqual(
      [...requiredIndexes].sort(),
    );
  });

  it.each([
    ['voyages', VOYAGE_A],
    ['vessels', VESSEL_A],
    ['counterparties', COUNTERPARTY_A],
  ])(
    'blocks cross-tenant SELECT, UPDATE and DELETE directly on %s',
    async (table, id) => {
      const ownRows = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
        manager.query(`SELECT id FROM ${table} WHERE id = $1`, [id]),
      );
      expect(ownRows).toEqual([{ id }]);

      const otherRows = await asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(`SELECT id FROM ${table} WHERE id = $1`, [id]),
      );
      expect(otherRows).toEqual([]);

      const updated = await asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(
          `UPDATE ${table} SET id = id WHERE id = $1 RETURNING id`,
          [id],
        ),
      );
      expect(updated).toEqual([[], 0]);

      const deleted = await asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]),
      );
      expect(deleted).toEqual([[], 0]);
    },
  );

  it('blocks direct cross-tenant INSERTs and ownership changes on tenant roots', async () => {
    await expect(
      asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(
          `INSERT INTO vessels
            (id, organization_id, imo, name, flag, type, dwt)
           VALUES ($1, $2, '9000099', 'Forged Vessel', 'AU', 'Bulk Carrier', 1)`,
          ['90000000-0000-4000-8000-000000000099', ORGANIZATION_A],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(
          `INSERT INTO counterparties
            (id, organization_id, name, type, status)
           VALUES ($1, $2, 'Forged Counterparty', 'owner', 'Active')`,
          ['90000000-0000-4000-8000-000000000199', ORGANIZATION_A],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(
          `INSERT INTO voyages
            (id, organization_id, reference, vessel_id, cargo_quantity,
             cargo_type, load_port, discharge_port, laycan_start, laycan_end)
           VALUES ($1, $2, 'FORGED-VOYAGE', $3, 1, 'Ore', 'AUSYD', 'SGSIN',
                   '2026-01-01', '2026-01-02')`,
          ['90000000-0000-4000-8000-000000000299', ORGANIZATION_A, VESSEL_A],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      asTenant(ORGANIZATION_A, USER_A, (manager) =>
        manager.query(
          `UPDATE voyages SET organization_id = $1 WHERE id = $2 RETURNING id`,
          [ORGANIZATION_B, VOYAGE_A],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it.each([
    ['charter_parties', CHARTER_PARTY_A],
    ['cp_clauses', CLAUSE_A],
    ['voyage_counterparties', LINK_A],
    ['sof_documents', SOF_A],
    ['sof_events', SOF_EVENT_A],
    ['nor_documents', NOR_A],
    ['nor_tender_location_evidence', LOCATION_EVIDENCE_A],
    ['laytime_calculations', CALCULATION_A],
    ['calculation_periods', PERIOD_A],
    ['dispute_cases_bulk', DISPUTE_A],
  ])(
    'protects inherited child table %s without service filters',
    async (table, id) => {
      const ownRows = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
        manager.query(`SELECT id FROM ${table} WHERE id = $1`, [id]),
      );
      expect(ownRows).toEqual([{ id }]);

      const crossTenantRows = await asTenant(
        ORGANIZATION_B,
        USER_B,
        (manager) =>
          manager.query(`SELECT id FROM ${table} WHERE id = $1`, [id]),
      );
      expect(crossTenantRows).toEqual([]);

      const crossTenantMutation = await asTenant(
        ORGANIZATION_B,
        USER_B,
        (manager) =>
          manager.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [
            id,
          ]),
      );
      expect(crossTenantMutation).toEqual([[], 0]);
    },
  );

  it('blocks cross-tenant location evidence mutation and forged relationships at the database boundary', async () => {
    const ownRows = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(
        `SELECT id FROM nor_tender_location_evidence WHERE id = $1`,
        [LOCATION_EVIDENCE_A],
      ),
    );
    expect(ownRows).toEqual([{ id: LOCATION_EVIDENCE_A }]);

    const crossTenantUpdate = await asTenant(
      ORGANIZATION_B,
      USER_B,
      (manager) =>
        manager.query(
          `UPDATE nor_tender_location_evidence
           SET note = 'forged' WHERE id = $1 RETURNING id`,
          [LOCATION_EVIDENCE_A],
        ),
    );
    expect(crossTenantUpdate).toEqual([[], 0]);

    await expect(
      asTenant(ORGANIZATION_B, USER_B, (manager) =>
        manager.query(
          `INSERT INTO nor_tender_location_evidence
             (voyage_id, operation, evidence_time, port_relation,
              berth_relation, waiting_place, source, created_by_user_id)
           VALUES ($1, 'Loading', now(), 'UNKNOWN', 'UNKNOWN', 'UNKNOWN',
                   'MANUAL', $2)`,
          [VOYAGE_A, USER_B],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('prevents cross-tenant relationships at the database policy boundary', async () => {
    await expect(
      asTenant(ORGANIZATION_A, USER_A, (manager) =>
        manager.query(
          `INSERT INTO voyage_counterparties (voyage_id, counterparty_id, role)
           VALUES ($1, $2, 'Owner')`,
          [VOYAGE_A, COUNTERPARTY_B],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      asTenant(ORGANIZATION_A, USER_A, (manager) =>
        manager.query(`UPDATE voyages SET vessel_id = $1 WHERE id = $2`, [
          VESSEL_B,
          VOYAGE_A,
        ]),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      asTenant(ORGANIZATION_A, USER_A, (manager) =>
        manager.query(
          `INSERT INTO calculation_periods
            (calculation_id, start_time, end_time, period_type, applied_clause_id)
           VALUES ($1, now(), now() + interval '1 hour', 'laytime', $2)`,
          [CALCULATION_A, '20000000-0000-4000-8000-000000005002'],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('fails closed with missing, empty or invalid database tenant context', async () => {
    expect(await application.query(`SELECT id FROM voyages`)).toEqual([]);

    const emptyContext = await application.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.current_tenant_id', '', true)`,
      );
      return manager.query(`SELECT id FROM voyages`);
    });
    expect(emptyContext).toEqual([]);

    await expect(
      application.transaction(async (manager) => {
        await manager.query(
          `SELECT set_config('app.current_tenant_id', 'not-a-uuid', true)`,
        );
        return manager.query(`SELECT id FROM voyages`);
      }),
    ).rejects.toMatchObject({ code: '22P02' });
  });

  it('does not leak tenant state through a one-connection pool or after rollback', async () => {
    const aFirst = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(`SELECT id FROM voyages ORDER BY id`),
    );
    expect(aFirst).toEqual([{ id: VOYAGE_A }]);

    const bSecond = await asTenant(ORGANIZATION_B, USER_B, (manager) =>
      manager.query(`SELECT id FROM voyages ORDER BY id`),
    );
    expect(bSecond).toEqual([{ id: VOYAGE_B }]);

    const aThird = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(`SELECT id FROM voyages ORDER BY id`),
    );
    expect(aThird).toEqual([{ id: VOYAGE_A }]);

    await expect(
      asTenant(ORGANIZATION_A, USER_A, async (manager) => {
        expect(await manager.query(`SELECT id FROM voyages`)).toEqual([
          { id: VOYAGE_A },
        ]);
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const bAfterRollback = await asTenant(ORGANIZATION_B, USER_B, (manager) =>
      manager.query(`SELECT id FROM voyages ORDER BY id`),
    );
    expect(bAfterRollback).toEqual([{ id: VOYAGE_B }]);
    expect(await application.query(`SELECT id FROM voyages`)).toEqual([]);
  });

  it('resolves authenticated identities through the isolated pre-tenant function', async () => {
    expect(
      await application.query(
        `SELECT * FROM app.resolve_authenticated_user($1)`,
        ['firebase-user-a'],
      ),
    ).toEqual([
      {
        user_id: USER_A,
        organization_id: ORGANIZATION_A,
        organization_exists: true,
      },
    ]);
    expect(
      await application.query(
        `SELECT * FROM app.resolve_authenticated_user($1)`,
        ['unknown-user'],
      ),
    ).toEqual([]);
  });

  it('protects organizations and users while leaving the transitional user constraint unvalidated', async () => {
    const ownIdentityRows = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(
        `SELECT organization.id AS organization_id, app_user.id AS user_id
           FROM organizations organization
           JOIN users app_user ON app_user.organization_id = organization.id`,
      ),
    );
    expect(ownIdentityRows).toEqual([
      { organization_id: ORGANIZATION_A, user_id: USER_A },
    ]);

    const crossTenantUser = await asTenant(ORGANIZATION_B, USER_B, (manager) =>
      manager.query(`SELECT id FROM users WHERE id = $1`, [USER_A]),
    );
    expect(crossTenantUser).toEqual([]);

    const [constraint] = await owner.query<
      Array<{ convalidated: boolean; unassigned_users: number }>
    >(`
      SELECT
        database_constraint.convalidated,
        (SELECT COUNT(*)::int FROM users WHERE organization_id IS NULL)
          AS unassigned_users
      FROM pg_constraint database_constraint
      WHERE database_constraint.conname = 'chk_users_organization_required'
    `);
    expect(constraint).toEqual({
      convalidated: false,
      unassigned_users: 0,
    });
  });

  it('keeps HTTP voyage reads and updates scoped through authenticated identity plus RLS', async () => {
    const orgAList = await request(api.getHttpServer())
      .get('/api/v1/voyages')
      .set('Authorization', 'Bearer user-a-token')
      .expect(200);
    expect(orgAList.body.data.map(({ id }: { id: string }) => id)).toEqual([
      VOYAGE_A,
    ]);

    await request(api.getHttpServer())
      .get(`/api/v1/voyages/${VOYAGE_A}`)
      .set('Authorization', 'Bearer user-b-token')
      .set('x-organization-id', ORGANIZATION_A)
      .expect(404);

    await request(api.getHttpServer())
      .patch(`/api/v1/voyages/${VOYAGE_A}`)
      .set('Authorization', 'Bearer user-b-token')
      .send({ cargoType: 'Forged Cargo' })
      .expect(404);

    const orgARecord = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(`SELECT cargo_type FROM voyages WHERE id = $1`, [VOYAGE_A]),
    );
    expect(orgARecord).toEqual([{ cargo_type: 'Iron Ore' }]);

    await request(api.getHttpServer())
      .patch(`/api/v1/voyages/${VOYAGE_A}`)
      .set('Authorization', 'Bearer user-a-token')
      .send({ cargoType: 'Persisted Iron Ore' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.cargoType).toBe('Persisted Iron Ore');
      });

    const persistedUpdate = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(`SELECT cargo_type FROM voyages WHERE id = $1`, [VOYAGE_A]),
    );
    expect(persistedUpdate).toEqual([{ cargo_type: 'Persisted Iron Ore' }]);
  });

  it('derives location-evidence attribution from authenticated identity and blocks cross-tenant API access', async () => {
    const created = await request(api.getHttpServer())
      .post(`/api/v1/voyages/${VOYAGE_A}/nor-tender-location-evidence`)
      .set('Authorization', 'Bearer user-a-token')
      .send({
        evidenceTime: '2026-01-02T01:00:00Z',
        operation: 'Discharge',
        portRelation: 'INSIDE_PORT_LIMITS',
        berthRelation: 'NOT_AT_BERTH',
        waitingPlace: 'ANCHORAGE',
        source: 'MANUAL',
        note: 'Agent observation',
      })
      .expect(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        voyageId: VOYAGE_A,
        createdByUserId: USER_A,
        source: 'MANUAL',
      }),
    );

    const ownList = await request(api.getHttpServer())
      .get(`/api/v1/voyages/${VOYAGE_A}/nor-tender-location-evidence`)
      .set('Authorization', 'Bearer user-a-token')
      .expect(200);
    expect(ownList.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: LOCATION_EVIDENCE_A }),
        expect.objectContaining({ id: created.body.id }),
      ]),
    );

    await request(api.getHttpServer())
      .get(`/api/v1/voyages/${VOYAGE_A}/nor-tender-location-evidence`)
      .set('Authorization', 'Bearer user-b-token')
      .expect(404);

    await request(api.getHttpServer())
      .post(`/api/v1/voyages/${VOYAGE_A}/nor-tender-location-evidence`)
      .set('Authorization', 'Bearer user-a-token')
      .send({
        evidenceTime: '2026-01-02T02:00:00Z',
        operation: 'Discharge',
        portRelation: 'UNKNOWN',
        berthRelation: 'UNKNOWN',
        waitingPlace: 'UNKNOWN',
        source: 'MANUAL',
        createdByUserId: USER_B,
      })
      .expect(400);
  });

  it('keeps atomic Voyage, CharterParty, clause and counterparty creation inside one tenant transaction', async () => {
    const response = await request(api.getHttpServer())
      .post('/api/v1/voyages')
      .set('Authorization', 'Bearer user-a-token')
      .send({
        vesselId: VESSEL_A,
        cargoQuantity: 45000,
        cargoType: 'Bauxite',
        reference: 'RLS-ATOMIC-001',
        supplier: 'RLS Supplier',
        receiver: 'RLS Receiver',
        loadPort: 'AUSYD',
        dischargePort: 'SGSIN',
        laycanStart: '2026-09-01',
        laycanEnd: '2026-09-05',
        laytimeAllowed: 48,
        demurrageRate: 12000,
        dispatchRate: 6000,
        timeCountingBasis: 'SHINC',
        norNoticePeriod: '6 hours',
      })
      .expect(201);

    const aggregate = await asTenant(ORGANIZATION_A, USER_A, (manager) =>
      manager.query(
        `SELECT
           voyage.id,
           charter_party.id AS charter_party_id,
           COUNT(DISTINCT clause.id)::int AS clause_count,
           COUNT(DISTINCT link.id)::int AS counterparty_count
         FROM voyages voyage
         JOIN charter_parties charter_party ON charter_party.voyage_id = voyage.id
         JOIN cp_clauses clause ON clause.charter_party_id = charter_party.id
         JOIN voyage_counterparties link ON link.voyage_id = voyage.id
         WHERE voyage.id = $1
         GROUP BY voyage.id, charter_party.id`,
        [response.body.id],
      ),
    );
    expect(aggregate).toEqual([
      expect.objectContaining({
        id: response.body.id,
        clause_count: expect.any(Number),
        counterparty_count: 2,
      }),
    ]);
    expect(aggregate[0].clause_count).toBeGreaterThan(0);
  });

  it('rolls back the complete initialized aggregate when a clause write fails', async () => {
    await owner.query(`
      CREATE OR REPLACE FUNCTION public.rls_test_reject_clause()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        RAISE EXCEPTION 'forced clause persistence failure';
      END
      $function$;

      CREATE TRIGGER rls_test_reject_clause
      BEFORE INSERT ON cp_clauses
      FOR EACH ROW EXECUTE FUNCTION public.rls_test_reject_clause();
    `);

    try {
      await request(api.getHttpServer())
        .post('/api/v1/voyages')
        .set('Authorization', 'Bearer user-a-token')
        .send({
          vesselId: VESSEL_A,
          cargoQuantity: 1000,
          cargoType: 'Rollback Cargo',
          reference: 'RLS-ROLLBACK-001',
          supplier: 'Rollback Supplier',
          receiver: 'Rollback Receiver',
          loadPort: 'AUSYD',
          dischargePort: 'SGSIN',
          laycanStart: '2026-10-01',
          laycanEnd: '2026-10-05',
          laytimeAllowed: 24,
        })
        .expect(500);
    } finally {
      await owner.query(`
        DROP TRIGGER IF EXISTS rls_test_reject_clause ON cp_clauses;
        DROP FUNCTION IF EXISTS public.rls_test_reject_clause();
      `);
    }

    const [remaining] = await owner.query<
      Array<{
        voyages: number;
        counterparties: number;
        charter_parties: number;
      }>
    >(`
      SELECT
        (SELECT COUNT(*)::int FROM voyages WHERE reference = 'RLS-ROLLBACK-001')
          AS voyages,
        (SELECT COUNT(*)::int FROM counterparties
         WHERE name IN ('Rollback Supplier', 'Rollback Receiver'))
          AS counterparties,
        (SELECT COUNT(*)::int
         FROM charter_parties charter_party
         JOIN voyages voyage ON voyage.id = charter_party.voyage_id
         WHERE voyage.reference = 'RLS-ROLLBACK-001')
          AS charter_parties
    `);
    expect(remaining).toEqual({
      voyages: 0,
      counterparties: 0,
      charter_parties: 0,
    });
  });
});

async function seedTenantFixtures(owner: DataSource): Promise<void> {
  await owner.query(
    `INSERT INTO organizations (id, name, slug)
     VALUES ($1, 'Organization A', 'organization-a'),
            ($2, 'Organization B', 'organization-b')`,
    [ORGANIZATION_A, ORGANIZATION_B],
  );
  await owner.query(
    `INSERT INTO users (id, firebase_uid, email, full_name, organization_id)
     VALUES ($1, 'firebase-user-a', 'a@example.test', 'User A', $2),
            ($3, 'firebase-user-b', 'b@example.test', 'User B', $4)`,
    [USER_A, ORGANIZATION_A, USER_B, ORGANIZATION_B],
  );
  await owner.query(
    `INSERT INTO vessels (id, organization_id, imo, name, flag, type, dwt)
     VALUES ($1, $2, '9000001', 'Vessel A', 'AU', 'Bulk Carrier', 75000),
            ($3, $4, '9000002', 'Vessel B', 'SG', 'Bulk Carrier', 76000)`,
    [VESSEL_A, ORGANIZATION_A, VESSEL_B, ORGANIZATION_B],
  );
  await owner.query(
    `INSERT INTO voyages
       (id, organization_id, reference, vessel_id, cargo_quantity, cargo_type,
        load_port, discharge_port, laycan_start, laycan_end)
     VALUES
       ($1, $2, 'RLS-A', $3, 10000, 'Iron Ore', 'AUSYD', 'SGSIN', '2026-01-01', '2026-01-05'),
       ($4, $5, 'RLS-B', $6, 20000, 'Coal', 'SGSIN', 'AUSYD', '2026-02-01', '2026-02-05')`,
    [VOYAGE_A, ORGANIZATION_A, VESSEL_A, VOYAGE_B, ORGANIZATION_B, VESSEL_B],
  );
  await owner.query(
    `INSERT INTO counterparties (id, organization_id, name, type, status)
     VALUES ($1, $2, 'Counterparty A', 'owner', 'Active'),
            ($3, $4, 'Counterparty B', 'owner', 'Active')`,
    [COUNTERPARTY_A, ORGANIZATION_A, COUNTERPARTY_B, ORGANIZATION_B],
  );
  await owner.query(
    `INSERT INTO voyage_counterparties (id, voyage_id, counterparty_id, role)
     VALUES ($1, $2, $3, 'Owner')`,
    [LINK_A, VOYAGE_A, COUNTERPARTY_A],
  );
  await owner.query(
    `INSERT INTO charter_parties
       (id, voyage_id, form_type, full_text, effective_date)
     VALUES ($1, $2, 'GENCON', 'Org A terms', '2026-01-01'),
            ($3, $4, 'GENCON', 'Org B terms', '2026-02-01')`,
    [CHARTER_PARTY_A, VOYAGE_A, CHARTER_PARTY_B, VOYAGE_B],
  );
  await owner.query(
    `UPDATE voyages
     SET charter_party_id = CASE id WHEN $1::uuid THEN $2::uuid ELSE $3::uuid END
     WHERE id IN ($1, $4)`,
    [VOYAGE_A, CHARTER_PARTY_A, CHARTER_PARTY_B, VOYAGE_B],
  );
  await owner.query(
    `INSERT INTO cp_clauses (id, charter_party_id, clause_type, raw_text, parameters)
     VALUES ($1, $2, 'time_counting_basis', 'SHINC', '{"basis":"SHINC"}'),
            ($3, $4, 'time_counting_basis', 'SHEX', '{"basis":"SHEX"}')`,
    [
      CLAUSE_A,
      CHARTER_PARTY_A,
      '20000000-0000-4000-8000-000000005002',
      CHARTER_PARTY_B,
    ],
  );
  await owner.query(
    `INSERT INTO sof_documents (id, voyage_id, file_path, status, operation)
     VALUES ($1, $2, 'org-a/sof.pdf', 'Final', 'Discharge')`,
    [SOF_A, VOYAGE_A],
  );
  await owner.query(
    `INSERT INTO sof_events (id, sof_id, event_time, event_type, operation)
     VALUES ($1, $2, '2026-01-03T00:00:00Z', 'CARGO_COMPLETED', 'Discharge')`,
    [SOF_EVENT_A, SOF_A],
  );
  await owner.query(
    `INSERT INTO nor_documents (id, voyage_id, file_path, tender_time)
     VALUES ($1, $2, 'org-a/nor.pdf', '2026-01-02T00:00:00Z')`,
    [NOR_A, VOYAGE_A],
  );
  await owner.query(
    `INSERT INTO nor_tender_location_evidence
       (id, voyage_id, operation, evidence_time, port_relation,
        berth_relation, waiting_place, source, sof_document_id,
        nor_document_id, created_by_user_id, note)
     VALUES ($1, $2, 'Discharge', '2026-01-02T00:00:00Z',
             'INSIDE_PORT_LIMITS', 'NOT_AT_BERTH', 'ANCHORAGE',
             'SOF', $3, $4, $5, 'Fixture location evidence')`,
    [LOCATION_EVIDENCE_A, VOYAGE_A, SOF_A, NOR_A, USER_A],
  );
  await owner.query(
    `INSERT INTO laytime_calculations
       (id, voyage_id, allowed_laytime, used_laytime, status)
     VALUES ($1, $2, interval '48 hours', interval '24 hours', 'Draft')`,
    [CALCULATION_A, VOYAGE_A],
  );
  await owner.query(
    `INSERT INTO calculation_periods
       (id, calculation_id, start_time, end_time, period_type, applied_clause_id)
     VALUES ($1, $2, '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z', 'laytime', $3)`,
    [PERIOD_A, CALCULATION_A, CLAUSE_A],
  );
  await owner.query(
    `INSERT INTO dispute_cases_bulk
       (id, voyage_id, type, amount_disputed, status)
     VALUES ($1, $2, 'demurrage_counter', 1000, 'Open')`,
    [DISPUTE_A, VOYAGE_A],
  );
}
