import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateVoyageDto } from './create-voyage.dto';
import { UpdateVoyageDto } from './update-voyage.dto';

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
  return validateSync(plainToInstance(CreateVoyageDto, dto));
}

describe('CreateVoyageDto', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'accepts laytimeOperation = %s',
    (laytimeOperation) => {
      const errors = validate({ ...baseDto, laytimeOperation });

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
});

describe('UpdateVoyageDto', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'accepts laytimeOperation = %s',
    (laytimeOperation) => {
      const errors = validateSync(
        plainToInstance(UpdateVoyageDto, { laytimeOperation }),
        { skipMissingProperties: true },
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects invalid laytimeOperation values', () => {
    const errors = validateSync(
      plainToInstance(UpdateVoyageDto, { laytimeOperation: 'Both' }),
      { skipMissingProperties: true },
    );
    const laytimeOperationError = errors.find(
      (error) => error.property === 'laytimeOperation',
    );

    expect(laytimeOperationError).toBeDefined();
  });
});
