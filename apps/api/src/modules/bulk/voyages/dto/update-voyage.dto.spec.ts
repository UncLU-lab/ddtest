import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateVoyageDto } from './update-voyage.dto';

describe('UpdateVoyageDto', () => {
  it.each([
    { cargoQuantity: 65000 },
    { cargoType: 'LNG' },
    { dischargePort: 'SGSIN' },
    { eta: '2026-09-01T12:00:00.000Z' },
  ])('accepts %p', (dto) => {
    const errors = validateSync(
      plainToInstance(UpdateVoyageDto, dto),
      { skipMissingProperties: true, whitelist: true },
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid quantity values', () => {
    const errors = validateSync(
      plainToInstance(UpdateVoyageDto, { cargoQuantity: -1 }),
      { skipMissingProperties: true, whitelist: true },
    );

    expect(
      errors.find((error) => error.property === 'cargoQuantity'),
    ).toBeDefined();
  });

  it('rejects non-whitelisted aggregate fields', () => {
    const errors = validateSync(
      plainToInstance(UpdateVoyageDto, {
        supplier: 'Vitol Asia',
        receiver: 'PetroChina',
        laytimeAllowed: 72,
        organizationId: '00000000-0000-0000-0000-000000000002',
      } as Record<string, unknown>),
      {
        skipMissingProperties: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      },
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'supplier' }),
        expect.objectContaining({ property: 'receiver' }),
        expect.objectContaining({ property: 'laytimeAllowed' }),
        expect.objectContaining({ property: 'organizationId' }),
      ]),
    );
  });
});
