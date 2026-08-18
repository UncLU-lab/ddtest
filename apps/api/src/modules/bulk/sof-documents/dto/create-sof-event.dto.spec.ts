import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSofEventDto } from './create-sof-event.dto';
import { UpdateSofEventDto } from './update-sof-event.dto';

const baseDto = {
  eventTime: '2026-08-17T10:00:00.000Z',
  eventType: 'NOR_TENDERED',
};

describe('CreateSofEventDto', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'accepts operation = %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(CreateSofEventDto, { ...baseDto, operation }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('accepts omitted operation', () => {
    const errors = validateSync(plainToInstance(CreateSofEventDto, baseDto));

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid operation values', () => {
    const errors = validateSync(
      plainToInstance(CreateSofEventDto, {
        ...baseDto,
        operation: 'Both',
      }),
    );
    const operationError = errors.find((error) => error.property === 'operation');

    expect(operationError).toBeDefined();
  });
});

describe('UpdateSofEventDto', () => {
  it('accepts omitted operation', () => {
    const errors = validateSync(
      plainToInstance(UpdateSofEventDto, { eventTime: baseDto.eventTime }),
      {
        skipMissingProperties: true,
      },
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['Loading', 'Discharge'] as const)(
    'accepts operation = %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(UpdateSofEventDto, { ...baseDto, operation }),
        { skipMissingProperties: true },
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects invalid operation values', () => {
    const errors = validateSync(
      plainToInstance(UpdateSofEventDto, {
        ...baseDto,
        operation: 'Invalid',
      }),
      { skipMissingProperties: true },
    );
    const operationError = errors.find((error) => error.property === 'operation');

    expect(operationError).toBeDefined();
  });
});
