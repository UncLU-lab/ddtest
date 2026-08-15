import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DisputeCaseBulk } from '../entities/dispute-case-bulk.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { BulkDisputesService } from './bulk-disputes.service';

const VOYAGE_ID = 'b66f8c53-5e31-4f5c-803e-387763ea95ba';
const DEMURRAGE_TYPE = 'demurrage_counter';
const DESPATCH_TYPE = 'despatch_claim';

function buildService(existingActiveDispute: Partial<DisputeCaseBulk> | null) {
  const disputes = {
    findOne: jest.fn().mockResolvedValue(existingActiveDispute),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new BulkDisputesService(
      disputes as unknown as Repository<DisputeCaseBulk>,
      voyagesService as unknown as VoyagesService,
    ),
    disputes,
    voyagesService,
  };
}

describe('BulkDisputesService.create duplicate protection', () => {
  it('rejects a second active claim for the same voyage and claim type', async () => {
    const { service, disputes, voyagesService } = buildService({
      id: 'existing-active-claim',
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE,
      status: 'Open',
    });

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE as 'demurrage_counter' | 'despatch_claim',
        amountDisputed: 2086.81,
        status: 'Open',
      }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.create({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE as 'demurrage_counter' | 'despatch_claim',
        amountDisputed: 2086.81,
        status: 'Open',
      }),
    ).rejects.toThrow(
      'An active claim already exists for this voyage and claim type.',
    );

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(disputes.findOne).toHaveBeenCalledWith({
      where: [
        { voyageId: VOYAGE_ID, type: DEMURRAGE_TYPE, status: 'Open' },
        {
          voyageId: VOYAGE_ID,
          type: DEMURRAGE_TYPE,
          status: 'Evidence Submitted',
        },
        {
          voyageId: VOYAGE_ID,
          type: DEMURRAGE_TYPE,
          status: 'In Negotiation',
        },
      ],
    });
    expect(disputes.save).not.toHaveBeenCalled();
  });

  it('allows creating a new claim when only a resolved claim exists', async () => {
    const { service, disputes, voyagesService } = buildService(null);

    disputes.findOne.mockResolvedValueOnce(null);

    const result = await service.create({
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE as 'demurrage_counter' | 'despatch_claim',
      amountDisputed: 2086.81,
      status: 'Open',
    });

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(disputes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DEMURRAGE_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
  });

  it('allows a different claim type for the same voyage', async () => {
    const { service, disputes, voyagesService } = buildService({
      id: 'existing-active-claim',
      voyageId: VOYAGE_ID,
      type: DEMURRAGE_TYPE,
      status: 'Open',
    });

    disputes.findOne.mockResolvedValueOnce(null);

    const result = await service.create({
      voyageId: VOYAGE_ID,
      type: DESPATCH_TYPE as 'demurrage_counter' | 'despatch_claim',
      amountDisputed: 2086.81,
      status: 'Open',
    });

    expect(voyagesService.ensureExists).toHaveBeenCalledWith(VOYAGE_ID);
    expect(disputes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DESPATCH_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        voyageId: VOYAGE_ID,
        type: DESPATCH_TYPE,
        amountDisputed: '2086.81',
        status: 'Open',
      }),
    );
  });
});
