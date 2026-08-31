import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LaytimeStatementsController } from './laytime-statements.controller';
import { LaytimeStatementsService } from './laytime-statements.service';

describe('LaytimeStatementsController', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findForVoyage: jest.fn(),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LaytimeStatementsController],
      providers: [{ provide: LaytimeStatementsService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('posts only a calculation source reference', async () => {
    service.create.mockResolvedValue({
      id: 'statement-1',
      version: 1,
      sourceCalculationId: '11111111-1111-4111-8111-111111111111',
    });

    await request(app.getHttpServer())
      .post('/laytime-statements')
      .send({
        calculationId: '11111111-1111-4111-8111-111111111111',
        currency: 'EUR',
        amount: 999999,
      })
      .expect(201);

    expect(service.create).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('reads a voyage statement history', async () => {
    service.findForVoyage.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/voyages/11111111-1111-4111-8111-111111111111/laytime-statements')
      .expect(200)
      .expect([]);
    expect(service.findForVoyage).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
