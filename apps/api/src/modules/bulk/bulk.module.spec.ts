import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantDatabaseContextService } from '../../database/tenant-database-context.service';
import { BulkModule } from './bulk.module';
import { CalculationPeriod } from './entities/calculation-period.entity';
import { CharterParty } from './entities/charter-party.entity';
import { Counterparty } from './entities/counterparty.entity';
import { CpClause } from './entities/cp-clause.entity';
import { DisputeCaseBulk } from './entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from './entities/laytime-calculation.entity';
import { LaytimeStatement } from './entities/laytime-statement.entity';
import { NorDocument } from './entities/nor-document.entity';
import { NorTenderLocationEvidence } from './entities/nor-tender-location-evidence.entity';
import { SofDocument } from './entities/sof-document.entity';
import { SofEvent } from './entities/sof-event.entity';
import { Vessel } from './entities/vessel.entity';
import { VoyageCounterparty } from './entities/voyage-counterparty.entity';
import { Voyage } from './entities/voyage.entity';

const ENTITIES = [
  CalculationPeriod,
  CharterParty,
  Counterparty,
  CpClause,
  DisputeCaseBulk,
  LaytimeCalculation,
  LaytimeStatement,
  NorDocument,
  NorTenderLocationEvidence,
  SofDocument,
  SofEvent,
  Vessel,
  VoyageCounterparty,
  Voyage,
];

/** Every endpoint listed for the bulk / tramp shipping domain. */
const EXPECTED_ROUTES = [
  'POST /contract-extractions/parse-text',
  'GET /vessels',
  'POST /vessels',
  'GET /vessels/:vesselId',
  'PATCH /vessels/:vesselId',
  'DELETE /vessels/:vesselId',
  'GET /vessels/:vesselId/voyages',
  'GET /voyages',
  'POST /voyages',
  'GET /voyages/:voyageId',
  'PATCH /voyages/:voyageId',
  'GET /voyages/:voyageId/summary',
  'GET /voyages/:voyageId/charter-party',
  'POST /voyages/:voyageId/charter-party',
  'GET /charter-parties/:charterPartyId',
  'PATCH /charter-parties/:charterPartyId',
  'GET /charter-parties/:charterPartyId/clauses',
  'POST /charter-parties/:charterPartyId/clauses',
  'PATCH /cp-clauses/:clauseId',
  'DELETE /cp-clauses/:clauseId',
  'GET /voyages/:voyageId/sof-documents',
  'POST /voyages/:voyageId/sof-documents',
  'GET /sof-documents/:sofId',
  'PATCH /sof-documents/:sofId',
  'GET /sof-documents/:sofId/events',
  'POST /sof-documents/:sofId/events',
  'PATCH /sof-events/:eventId',
  'GET /voyages/:voyageId/nor-documents',
  'POST /voyages/:voyageId/nor-documents',
  'PATCH /nor-documents/:norId',
  'GET /voyages/:voyageId/nor-tender-location-evidence',
  'POST /voyages/:voyageId/nor-tender-location-evidence',
  'GET /voyages/:voyageId/laytime-calculations',
  'POST /voyages/:voyageId/laytime-calculations',
  'GET /laytime-calculations/:calculationId',
  'GET /laytime-calculations/:calculationId/operation-results',
  'GET /laytime-calculations/:calculationId/audit',
  'GET /laytime-calculations/:calculationId/periods',
  'POST /laytime-calculations/:calculationId/finalize',
  'POST /laytime-statements',
  'GET /laytime-statements/:statementId',
  'GET /voyages/:voyageId/laytime-statements',
  'GET /bulk-disputes',
  'POST /bulk-disputes',
  'GET /bulk-disputes/:disputeId',
  'PATCH /bulk-disputes/:disputeId',
  'GET /counterparties',
  'POST /counterparties',
  'GET /counterparties/:counterpartyId',
  'PATCH /counterparties/:counterpartyId',
];

/** Stands in for the connection the global DatabaseModule would provide. */
@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: { transaction: jest.fn() } },
    {
      provide: TenantDatabaseContextService,
      useValue: { transaction: jest.fn(), createRepositoryProxy: jest.fn() },
    },
  ],
  exports: [DataSource, TenantDatabaseContextService],
})
class FakeDataSourceModule {}

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

function listRoutes(app: INestApplication): string[] {
  const server = app.getHttpAdapter().getInstance() as {
    router: { stack: ExpressLayer[] };
  };

  return server.router.stack
    .filter((layer): layer is Required<ExpressLayer> => Boolean(layer.route))
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map(
        (method) => `${method.toUpperCase()} ${layer.route.path}`,
      ),
    );
}

describe('BulkModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      imports: [FakeDataSourceModule, BulkModule],
    });

    for (const entity of ENTITIES) {
      builder.overrideProvider(getRepositoryToken(entity)).useValue({});
    }

    app = (await builder.compile()).createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes every endpoint in the bulk / tramp shipping API surface', () => {
    expect(listRoutes(app).sort()).toEqual([...EXPECTED_ROUTES].sort());
  });
});
