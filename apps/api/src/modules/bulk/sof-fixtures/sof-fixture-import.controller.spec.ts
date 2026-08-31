import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SofFixtureImportController } from './sof-fixture-import.controller';
import { SofFixtureImportService } from './sof-fixture-import.service';

describe('SofFixtureImportController', () => {
  let app: INestApplication;
  const service = { importFixture: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SofFixtureImportController],
      providers: [{ provide: SofFixtureImportService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    service.importFixture.mockReset();
  });

  it('validates the fixture envelope before invoking the service', async () => {
    await request(app.getHttpServer())
      .post(
        '/api/v1/voyages/11111111-1111-4111-8111-111111111111/sof-fixtures/import',
      )
      .send({
        version: 1,
        operation: 'Loading',
        sourceTimeZone: 'Australia/Sydney',
        events: [],
      })
      .expect(400);

    expect(service.importFixture).not.toHaveBeenCalled();
  });

  it('passes a valid fixture to the authenticated import service', async () => {
    service.importFixture.mockResolvedValue({
      sofDocumentId: '33333333-3333-4333-8333-333333333333',
      operation: 'Loading',
      eventCount: 1,
      createdDocument: true,
    });

    const fixture = {
      version: 1,
      operation: 'Loading',
      sourceTimeZone: 'Australia/Sydney',
      events: [
        {
          eventTime: '2026-09-07T00:00',
          eventType: 'NOR_TENDERED',
          exceptionCandidate: false,
        },
      ],
    };

    await request(app.getHttpServer())
      .post(
        '/api/v1/voyages/11111111-1111-4111-8111-111111111111/sof-fixtures/import',
      )
      .send(fixture)
      .expect(201)
      .expect(({ body }) => {
        expect(body.eventCount).toBe(1);
      });

    expect(service.importFixture).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        version: 1,
        operation: 'Loading',
        events: [expect.objectContaining({ eventType: 'NOR_TENDERED' })],
      }),
    );
  });
});
