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

const STAGE_REV_001 = `${STAGE_BASIC_001.replace('STAGE-BASIC-001', 'STAGE-REV-001')}
SETTLEMENT CURRENCY: USD
LAYTIME APPLIES TO: LOADING AND DISCHARGE
REVERSIBLE LAYTIME: ENABLED
REVERSIBLE SETTLEMENT VERSION: 1
REVERSIBLE ALLOWANCE MODE: SUM_OPERATION_ALLOWANCES
LOADING LAYTIME ALLOWED: 72 HOURS
DISCHARGE LAYTIME ALLOWED: 72 HOURS`;

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

  it('extracts the supported STAGE-REV-001 creation contract without inferring scope', async () => {
    const result = await service.parseText(STAGE_REV_001);

    expect(result.fields.settlementCurrency).toMatchObject({ status: 'FOUND', normalizedValue: 'USD' });
    expect(result.fields.laytimeOperationScope).toMatchObject({ status: 'FOUND', normalizedValue: 'LoadingAndDischarge' });
    expect(result.fields.reversibleLaytime).toMatchObject({ status: 'FOUND', normalizedValue: 'Enabled' });
    expect(result.fields.reversibleSettlementVersion).toMatchObject({ normalizedValue: 1 });
    expect(result.fields.reversibleAllowanceMode).toMatchObject({ normalizedValue: 'sum_operation_allowances' });
    expect(result.fields.loadingLaytimeAllowed).toMatchObject({ status: 'FOUND', normalizedValue: 72 });
    expect(result.fields.dischargeLaytimeAllowed).toMatchObject({ status: 'FOUND', normalizedValue: 72 });
  });

  it('flags unsupported currency and incomplete or unsupported reversible terms for review', async () => {
    const result = await service.parseText(`SETTLEMENT CURRENCY: XYZ
LAYTIME APPLIES TO: LOADING AND DISCHARGE
REVERSIBLE LAYTIME: ENABLED
REVERSIBLE SETTLEMENT VERSION: 2
REVERSIBLE ALLOWANCE MODE: OTHER`);

    expect(result.fields.settlementCurrency.status).toBe('INVALID');
    expect(result.fields.laytimeOperationScope.status).toBe('FOUND');
    expect(result.fields.reversibleLaytime).toMatchObject({ status: 'INVALID' });
    expect(result.fields.reversibleSettlementVersion.status).toBe('UNSUPPORTED');
    expect(result.fields.reversibleAllowanceMode.status).toBe('UNSUPPORTED');
  });

  it('leaves absent scope as NOT_FOUND and does not enable reversible laytime from scope', async () => {
    const result = await service.parseText('LAYTIME APPLIES TO: LOADING AND DISCHARGE');
    expect(result.fields.laytimeOperationScope.status).toBe('FOUND');
    expect(result.fields.reversibleLaytime.status).toBe('NOT_FOUND');

    const missingScope = await service.parseText('REVERSIBLE LAYTIME: DISABLED');
    expect(missingScope.fields.laytimeOperationScope.status).toBe('NOT_FOUND');
  });
});
