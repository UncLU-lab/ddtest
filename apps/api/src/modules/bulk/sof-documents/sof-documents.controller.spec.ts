import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SofDocumentsController } from './sof-documents.controller';
import { SofDocumentsService } from './sof-documents.service';

describe('SofDocumentsController', () => {
  let app: INestApplication;
  const service = {
    addEvent: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SofDocumentsController],
      providers: [
        {
          provide: SofDocumentsService,
          useValue: service,
        },
      ],
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

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.addEvent.mockReset();
  });

  it('rejects missing sourceTimeZone on POST /api/v1/sof-documents/:sofId/events', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sof-documents/11111111-1111-4111-8111-111111111111/events')
      .send({
        eventTime: '2026-10-10T00:00:00.000Z',
        eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toEqual(
          expect.arrayContaining([expect.stringContaining('sourceTimeZone')]),
        );
      });

    expect(service.addEvent).not.toHaveBeenCalled();
  });

  it('accepts a valid sourceTimeZone on POST /api/v1/sof-documents/:sofId/events', async () => {
    service.addEvent.mockResolvedValue({
      id: 'event-1',
      sofId: '11111111-1111-4111-8111-111111111111',
      eventTime: new Date('2026-10-10T00:00:00.000Z'),
      sourceTimeZone: 'Australia/Perth',
      eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      operation: null,
      remarks: null,
      confidenceScore: null,
      isManualOverride: true,
      overrideReason: null,
      createdAt: new Date('2026-10-10T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/api/v1/sof-documents/11111111-1111-4111-8111-111111111111/events')
      .send({
        eventTime: '2026-10-10T00:00:00.000Z',
        sourceTimeZone: 'Australia/Perth',
        eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.sourceTimeZone).toBe('Australia/Perth');
      });

    expect(service.addEvent).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        sourceTimeZone: 'Australia/Perth',
      }),
    );
  });

  it('rejects an invalid sourceTimeZone through service validation', async () => {
    service.addEvent.mockRejectedValue(
      new BadRequestException('sourceTimeZone must be a valid IANA timezone identifier'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/sof-documents/11111111-1111-4111-8111-111111111111/events')
      .send({
        eventTime: '2026-10-10T00:00:00.000Z',
        sourceTimeZone: 'Australia/Nowhere',
        eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('sourceTimeZone must be a valid IANA timezone identifier');
      });
  });
});
