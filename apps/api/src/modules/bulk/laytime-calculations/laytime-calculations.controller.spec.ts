import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LaytimeCalculationsController } from './laytime-calculations.controller';
import { LaytimeCalculationsService } from './laytime-calculations.service';

describe('LaytimeCalculationsController', () => {
  let app: INestApplication;
  const service = {
    findOperationChildren: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LaytimeCalculationsController],
      providers: [
        {
          provide: LaytimeCalculationsService,
          useValue: service,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps GET /api/v1/laytime-calculations/:calculationId/operation-results', async () => {
    service.findOperationChildren.mockResolvedValue([
      {
        id: 'loading-child',
        parentCalculationId: 'parent-calculation',
        operation: 'Loading',
        voyageId: '11111111-1111-4111-8111-111111111111',
        version: 3,
        allowedLaytime: '1 days 00:00:00',
        usedLaytime: '12:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '100.00',
        status: 'Draft',
        calculatedAt: new Date('2026-03-05T06:00:00Z'),
        engineVersion: 'laytime-engine-v1',
        inputSnapshot: { child: true },
        decisionSnapshot: { child: true },
        warnings: ['warning'],
      },
      {
        id: 'discharge-child',
        parentCalculationId: 'parent-calculation',
        operation: 'Discharge',
        voyageId: '11111111-1111-4111-8111-111111111111',
        version: 3,
        allowedLaytime: '1 days 00:00:00',
        usedLaytime: '12:00:00',
        demurrageAmount: '0.00',
        despatchAmount: '100.00',
        status: 'Draft',
        calculatedAt: new Date('2026-03-05T12:00:00Z'),
        engineVersion: 'laytime-engine-v1',
        inputSnapshot: { child: true },
        decisionSnapshot: { child: true },
        warnings: ['warning'],
      },
    ]);

    await request(app.getHttpServer())
      .get(
        '/api/v1/laytime-calculations/11111111-1111-4111-8111-111111111111/operation-results',
      )
      .expect(200)
      .expect([
        {
          id: 'loading-child',
          parentCalculationId: 'parent-calculation',
          operation: 'Loading',
          voyageId: '11111111-1111-4111-8111-111111111111',
          version: 3,
          allowedLaytime: '1 days 00:00:00',
          usedLaytime: '12:00:00',
          demurrageAmount: '0.00',
          despatchAmount: '100.00',
          status: 'Draft',
          calculatedAt: '2026-03-05T06:00:00.000Z',
          engineVersion: 'laytime-engine-v1',
          inputSnapshot: { child: true },
          decisionSnapshot: { child: true },
          warnings: ['warning'],
        },
        {
          id: 'discharge-child',
          parentCalculationId: 'parent-calculation',
          operation: 'Discharge',
          voyageId: '11111111-1111-4111-8111-111111111111',
          version: 3,
          allowedLaytime: '1 days 00:00:00',
          usedLaytime: '12:00:00',
          demurrageAmount: '0.00',
          despatchAmount: '100.00',
          status: 'Draft',
          calculatedAt: '2026-03-05T12:00:00.000Z',
          engineVersion: 'laytime-engine-v1',
          inputSnapshot: { child: true },
          decisionSnapshot: { child: true },
          warnings: ['warning'],
        },
      ]);

    expect(service.findOperationChildren).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
