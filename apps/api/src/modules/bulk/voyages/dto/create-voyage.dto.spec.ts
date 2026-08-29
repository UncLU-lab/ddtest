import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateVoyageDto } from './create-voyage.dto';

const baseDto = {
  vesselId: '11111111-1111-4111-8111-111111111111',
  cargoQuantity: 65000,
  cargoType: 'LNG',
  loadPort: 'USNOL',
  dischargePort: 'SGSIN',
  laycanStart: '2026-09-01',
  laycanEnd: '2026-09-05',
};

function validate(dto: object) {
  return validateSync(plainToInstance(CreateVoyageDto, dto), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateVoyageDto', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'accepts laytimeOperation = %s',
    (laytimeOperation) => {
      const errors = validate({ ...baseDto, laytimeOperation });

      expect(errors).toHaveLength(0);
    },
  );

  it.each(['dry_bulk', 'tanker', null] as const)(
    'accepts bulkOperationType = %s',
    (bulkOperationType) => {
      const errors = validate({
        ...baseDto,
        bulkOperationType,
      });

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects invalid laytimeOperation values', () => {
    const errors = validate({ ...baseDto, laytimeOperation: 'Both' });
    const laytimeOperationError = errors.find(
      (error) => error.property === 'laytimeOperation',
    );

    expect(laytimeOperationError).toBeDefined();
  });

  it('rejects invalid bulkOperationType values', () => {
    const errors = validate({
      ...baseDto,
      bulkOperationType: 'LNG',
    });
    const bulkOperationTypeError = errors.find(
      (error) => error.property === 'bulkOperationType',
    );

    expect(bulkOperationTypeError).toBeDefined();
  });

  it('accepts optional Charter Party creation fields and the reversible V1 contract', () => {
    const errors = validate({
      ...baseDto,
      settlementCurrency: 'USD',
      laytimeOperationScope: 'LoadingAndDischarge',
      reversibleLaytime: {
        enabled: true,
        settlementVersion: 1,
        allowanceMode: 'sum_operation_allowances',
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported creation currency and reversible V1 values', () => {
    const errors = validate({
      ...baseDto,
      settlementCurrency: 'XYZ',
      reversibleLaytime: { enabled: true, settlementVersion: 2, allowanceMode: 'other' },
    });
    expect(JSON.stringify(errors)).toContain('settlementCurrency');
    expect(JSON.stringify(errors)).toContain('reversibleLaytime');
  });

  it('accepts nested commercial terms blocks for initial clause persistence', () => {
    const errors = validate({
      ...baseDto,
      loadingTerms: {
        laytimeAllowed: 24,
        demurrageRate: 5000,
        dispatchRate: 2500,
        timeCountingBasis: 'SHEX',
        shexCalendar: {
          calendarVersion: 1,
          timeZone: 'Australia/Sydney',
          holidayDates: ['2026-12-25'],
          saturdayExcepted: false,
        },
        norNoticePeriod: '12 hours',
        weatherWorking: true,
        wibon: false,
        wipon: true,
      },
      dischargeTerms: {
        laytimeAllowed: 18,
        weatherWorking: false,
      },
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an unsupported nested SHEX calendar version', () => {
    const errors = validate({
      ...baseDto,
      timeCountingBasis: 'SHEX',
      shexCalendar: {
        calendarVersion: 2,
        timeZone: 'UTC',
        holidayDates: [],
        saturdayExcepted: false,
      },
    });

    expect(JSON.stringify(errors)).toContain('calendarVersion');
  });

  it('rejects unknown fields inside nested commercial terms blocks', () => {
    const errors = validate({
      ...baseDto,
      loadingTerms: {
        weatherWorking: true,
        invalidClause: 'yes',
      },
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('invalidClause');
  });
});
