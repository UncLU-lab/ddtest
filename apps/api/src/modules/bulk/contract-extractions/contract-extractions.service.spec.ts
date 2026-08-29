import { ContractExtractionsService } from './contract-extractions.service';

const STAGE_BASIC_001 = `VESSEL: MV Staging Explorer
VOYAGE REFERENCE: STAGE-BASIC-001
PRODUCT: Products
QUANTITY: 50000 MT
ETA: 2026-10-01
LOAD PORT: AUPHE
DISCHARGE PORT: CNQDG
SUPPLIER: Vitol Asia
RECEIVER: PetroChina
LAYCAN OPEN: 2026-09-28
LAYCAN CLOSE: 2026-09-30
LAYTIME ALLOWED: 72 HOURS
DEMURRAGE RATE: 20000
DESPATCH RATE: 10000
COUNTING BASIS: SHINC
NOR NOTICE: 6 HOURS
LAYTIME OPERATION: DISCHARGE
BULK OPERATION TYPE: TANKER`;

describe('ContractExtractionsService', () => {
  const vessels = { findAll: jest.fn() };
  const service = new ContractExtractionsService(vessels as any);

  beforeEach(() => {
    vessels.findAll.mockResolvedValue({ data: [{ id: 'tenant-vessel-1', name: 'MV Staging Explorer' }] });
  });

  it('deterministically extracts and normalizes the STAGE-BASIC-001 fixture', async () => {
    const result = await service.parseText(STAGE_BASIC_001);

    expect(vessels.findAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 200 }));
    expect(result.fields.vessel).toMatchObject({ status: 'FOUND', normalizedValue: 'MV Staging Explorer', vesselId: 'tenant-vessel-1' });
    expect(result.fields.quantity).toMatchObject({ normalizedValue: 50000, status: 'FOUND' });
    expect(result.fields.eta).toMatchObject({ normalizedValue: '2026-10-01' });
    expect(result.fields.timeCountingBasis).toMatchObject({ normalizedValue: 'SHINC' });
    expect(result.fields.bulkOperationType).toMatchObject({ normalizedValue: 'tanker' });
  });

  it('does not invent fields and flags invalid or unsupported source values', async () => {
    const result = await service.parseText(`VESSEL: MV Staging Explorer
LOAD PORT: Port Hedland
PRODUCT: Ammonia`);

    expect(result.fields.voyageRef.status).toBe('NOT_FOUND');
    expect(result.fields.loadPort).toMatchObject({ status: 'INVALID', warning: expect.stringContaining('port code') });
    expect(result.fields.productType).toMatchObject({ status: 'UNSUPPORTED' });
  });

  it('does not resolve a vessel outside the current tenant result set', async () => {
    vessels.findAll.mockResolvedValue({ data: [] });
    const result = await service.parseText('VESSEL: MV Staging Explorer');
    expect(result.fields.vessel).toMatchObject({ status: 'INVALID', normalizedValue: null });
  });
});
