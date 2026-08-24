import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCpClauseDto } from './create-cp-clause.dto';
import { UpdateCpClauseDto } from './update-cp-clause.dto';

const baseDto = {
  clauseType: 'laytime_rate',
  rawText: 'Laytime allowed: 72h',
  parameters: { hours: 72 },
};

const despatchDto = {
  clauseType: 'despatch',
  rawText: 'Dispatch: $7,500/day',
  parameters: { rate: 7500 },
};

describe('CreateCpClauseDto', () => {
  const norScheduleDto = {
    clauseType: 'nor_commencement_schedule',
    rawText: 'NOR commencement schedule',
    parameters: {
      cutoffReference: 'tenderTime',
      tenderCutoffTime: '12:00',
      sameDayCommencementTime: '13:00',
      nextWorkingDayCommencementTime: '08:00',
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      timeZone: 'Europe/London',
    },
  };

  it.each([
    norScheduleDto.parameters,
    {
      tenderCutoffTime: '00:00',
      cutoffReference: 'acceptedTime',
      sameDayCommencementTime: '13:30',
      nextWorkingDayCommencementTime: '23:59',
      workingDays: ['TUE', 'THU', 'SUN'],
      timeZone: 'Asia/Singapore',
    },
  ])(
    'accepts a global NOR commencement schedule with strict clock times',
    (parameters) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, { ...norScheduleDto, parameters }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it.each([
    'cutoffReference',
    'tenderCutoffTime',
    'sameDayCommencementTime',
    'nextWorkingDayCommencementTime',
    'workingDays',
    'timeZone',
  ] as const)('requires NOR schedule parameter %s', (missingField) => {
    const parameters = { ...norScheduleDto.parameters };
    delete parameters[missingField];

    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, { ...norScheduleDto, parameters }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it.each([
    'Europe/London',
    'Australia/Sydney',
    'Asia/Singapore',
    'America/New_York',
    'UTC',
  ])('accepts contractual IANA timezone %s', (timeZone) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...norScheduleDto,
        parameters: { ...norScheduleDto.parameters, timeZone },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['tenderTime', 'acceptedTime'] as const)(
    'accepts cutoffReference=%s',
    (cutoffReference) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, cutoffReference },
        }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it.each(['effectiveTime', 'tenderedAt', '', 1, null])(
    'rejects invalid cutoffReference=%j',
    (cutoffReference) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, cutoffReference },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each([
    'Not/AZone',
    'London',
    'Sydney',
    'GMT+10',
    '+10:00',
    'arbitrary string',
    '',
    '   ',
    10,
    true,
    null,
  ])('rejects invalid contractual timezone %j', (timeZone) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...norScheduleDto,
        parameters: { ...norScheduleDto.parameters, timeZone },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it.each([
    { workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
    { workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
    { workingDays: ['MON', 'WED', 'SUN'] },
    { workingDays: ['TUE', 'THU'] },
    { workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
  ])('accepts contractual working weekdays $workingDays', ({ workingDays }) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...norScheduleDto,
        parameters: { ...norScheduleDto.parameters, workingDays },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each([
    { workingDays: [] },
    { workingDays: ['MON', 'MON', 'TUE'] },
    { workingDays: ['MON', 'FUNDAY'] },
    { workingDays: ['mon', 'TUE'] },
    { workingDays: ['MON', 2] },
    { workingDays: ['MON', true] },
    { workingDays: ['MON', null] },
  ])(
    'rejects invalid contractual working weekdays $workingDays',
    ({ workingDays }) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, workingDays },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each(['MON', 5, true, null])(
    'rejects non-array workingDays=%j',
    (workingDays) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, workingDays },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each(['8:00', '24:00', '12:60', 'not-a-time'])(
    'rejects invalid NOR schedule time %s',
    (tenderCutoffTime) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, tenderCutoffTime },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each([8, true])(
    'rejects non-string NOR schedule time %s',
    (sameDayCommencementTime) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, sameDayCommencementTime },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each(['Loading', 'Discharge'] as const)(
    'rejects operation=%s for a global NOR commencement schedule',
    (operation) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...norScheduleDto,
          parameters: { ...norScheduleDto.parameters, operation },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each(['all_time_saved', 'working_time_saved'] as const)(
    'accepts despatch clauses with timeBasis=%s',
    (timeBasis) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...despatchDto,
          parameters: { ...despatchDto.parameters, timeBasis },
        }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it.each(['invalid', '', 'half_time_saved'] as const)(
    'rejects despatch clauses with invalid timeBasis=%s',
    (timeBasis) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...despatchDto,
          parameters: { ...despatchDto.parameters, timeBasis },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each([1, true] as const)(
    'rejects despatch clauses with non-string timeBasis=%s',
    (timeBasis) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...despatchDto,
          parameters: { ...despatchDto.parameters, timeBasis },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it('accepts a despatch clause without a timeBasis', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, despatchDto),
    );

    expect(errors).toHaveLength(0);
  });

  it('accepts a despatch clause with operation scope and timeBasis', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...despatchDto,
        parameters: {
          ...despatchDto.parameters,
          operation: 'Loading',
          timeBasis: 'working_time_saved',
        },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('keeps existing despatch multiplier validation working', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...despatchDto,
        parameters: { multiplier: 0.5 },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('accepts reversible_laytime clauses with a boolean enabled flag', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime enabled',
        parameters: {
          enabled: true,
          settlementVersion: 1,
          allowanceMode: 'sum_operation_allowances',
        },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects a new enabled reversible clause without the V1 contract', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Legacy reversible laytime',
        parameters: { enabled: true },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it('accepts a disabled reversible clause without V1 settlement fields', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime disabled',
        parameters: { enabled: false },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects an operation-scoped reversible clause', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Loading reversible laytime',
        parameters: {
          enabled: true,
          settlementVersion: 1,
          allowanceMode: 'sum_operation_allowances',
          operation: 'Loading',
        },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it.each([
    { enabled: true, settlementVersion: 2, allowanceMode: 'sum_operation_allowances' },
    { enabled: true, settlementVersion: 1, allowanceMode: 'all_purposes' },
  ])('rejects unsupported reversible contracts %#', (parameters) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Unsupported reversible laytime',
        parameters,
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it.each([
    { hours: 24, days: 1, operation: 'Loading' },
    { hours: -1, operation: 'Loading' },
    { days: 0, operation: 'Discharge' },
    { rate: '10000', operation: 'Loading' },
    { rate: Number.NaN, operation: 'Loading' },
    { rate: Number.POSITIVE_INFINITY, operation: 'Loading' },
  ])('rejects unsafe laytime allowance parameters %#', (parameters) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'laytime_rate',
        rawText: 'Invalid allowance',
        parameters,
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it.each([
    { clauseType: 'demurrage_rate', parameters: { rate: -1 } },
    { clauseType: 'demurrage_rate', parameters: { rate: '12000' } },
    { clauseType: 'despatch', parameters: { rate: -1 } },
    { clauseType: 'despatch', parameters: { multiplier: -0.5 } },
    { clauseType: 'demurrage_rate', parameters: { rate: Number.NaN } },
    { clauseType: 'despatch', parameters: { rate: Number.POSITIVE_INFINITY } },
  ])('rejects unsafe pricing parameters %#', ({ clauseType, parameters }) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType,
        rawText: 'Invalid pricing',
        parameters,
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it.each([true, false])('accepts atutc clauses with enabled=%s', (enabled) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'atutc',
        rawText: 'ATUTC enabled',
        parameters: { enabled },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each([true, false])('accepts global wifpon with enabled=%s', (enabled) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'wifpon',
        rawText: `WIFPON ${enabled ? 'enabled' : 'disabled'}`,
        parameters: { enabled },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['Loading', 'Discharge'] as const)(
    'accepts operation-scoped wifpon for %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          clauseType: 'wifpon',
          rawText: `${operation} WIFPON enabled`,
          parameters: { enabled: true, operation },
        }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it.each([undefined, 'true', 'false', 1, 0, null, [], {}])(
    'rejects wifpon with enabled=%j',
    (enabled) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          clauseType: 'wifpon',
          rawText: 'WIFPON',
          parameters: enabled === undefined ? {} : { enabled },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it('rejects wifpon with an invalid operation', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'wifpon',
        rawText: 'WIFPON enabled',
        parameters: { enabled: true, operation: 'Both' },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it.each(['yes', 1])('rejects atutc clauses with enabled=%s', (enabled) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'atutc',
        rawText: 'ATUTC enabled',
        parameters: { enabled },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it.each(['Loading', 'Discharge'] as const)(
    'accepts parameters.operation = %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...baseDto,
          parameters: { ...baseDto.parameters, operation },
        }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('accepts omitted parameters.operation', () => {
    const errors = validateSync(plainToInstance(CreateCpClauseDto, baseDto));

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid parameters.operation values', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...baseDto,
        parameters: { ...baseDto.parameters, operation: 'Both' },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it('rejects reversible_laytime clauses with a non-boolean enabled flag', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime enabled',
        parameters: { enabled: 'yes' },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it('rejects reversible_laytime clauses with an operation scope', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime enabled',
        parameters: { enabled: true, operation: 'Loading' },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it('rejects atutc clauses with an operation scope', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'atutc',
        rawText: 'ATUTC enabled',
        parameters: { enabled: true, operation: 'Loading' },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });
});

describe('SHEX/SHINC versioned calendar validation', () => {
  const versionedShex = {
    clauseType: 'shex_shinc',
    rawText: 'Sydney SHEX calendar',
    parameters: {
      shex: true,
      calendarVersion: 1,
      timeZone: 'Australia/Sydney',
      holidayDates: ['2026-12-25', '2026-12-26'],
      saturdayExcepted: false,
      operation: 'Loading',
    },
  };

  it('accepts a complete version 1 SHEX calendar', () => {
    expect(
      validateSync(plainToInstance(CreateCpClauseDto, versionedShex)),
    ).toHaveLength(0);
  });

  it('accepts explicit SHINC without calendar fields', () => {
    expect(
      validateSync(
        plainToInstance(CreateCpClauseDto, {
          clauseType: 'shex_shinc',
          rawText: 'SHINC',
          parameters: { shex: false, operation: 'Discharge' },
        }),
      ),
    ).toHaveLength(0);
  });

  it.each(['true', 'false', 1, 0, null, undefined])(
    'rejects non-boolean shex=%j',
    (shex) => {
      const parameters = { ...versionedShex.parameters, shex };
      if (shex === undefined) {
        delete (parameters as Record<string, unknown>).shex;
      }
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          ...versionedShex,
          parameters,
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it.each([
    'calendarVersion',
    'timeZone',
    'holidayDates',
    'saturdayExcepted',
  ] as const)('requires versioned SHEX field %s', (field) => {
    const parameters = { ...versionedShex.parameters };
    delete parameters[field];
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, { ...versionedShex, parameters }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it.each([
    ['unsupported version', { calendarVersion: 2 }],
    ['invalid timezone', { timeZone: 'Sydney' }],
    ['invalid date', { holidayDates: ['2026-02-30'] }],
    ['duplicate date', { holidayDates: ['2026-12-25', '2026-12-25'] }],
    ['legacy camel alias', { satShex: true }],
    ['legacy snake alias', { saturday_excepted: true }],
  ])('rejects %s', (_label, override) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...versionedShex,
        parameters: { ...versionedShex.parameters, ...override },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });

  it.each(['calendarVersion', 'timeZone', 'holidayDates', 'saturdayExcepted'])(
    'rejects SHEX-only field %s on SHINC',
    (field) => {
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          clauseType: 'shex_shinc',
          rawText: 'Invalid SHINC calendar',
          parameters: { shex: false, [field]: versionedShex.parameters[field] },
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );

  it('rejects a newly written legacy SHEX clause', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'shex_shinc',
        rawText: 'Legacy SHEX',
        parameters: { shex: true },
      }),
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });
});

describe('UpdateCpClauseDto', () => {
  it('cannot validate schedule parameters without the persisted clause type', () => {
    const errors = validateSync(
      plainToInstance(UpdateCpClauseDto, {
        parameters: {
          cutoffReference: 'invalid',
          tenderCutoffTime: '12:00',
          sameDayCommencementTime: '13:00',
          nextWorkingDayCommencementTime: '08:00',
          workingDays: ['MON'],
          timeZone: 'UTC',
        },
      }),
      { skipMissingProperties: true },
    );

    // The service must validate the merged complete clause using its persisted type.
    expect(errors).toHaveLength(0);
  });
  it.each(['Loading', 'Discharge'] as const)(
    'accepts parameters.operation = %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(UpdateCpClauseDto, {
          parameters: { ...baseDto.parameters, operation },
        }),
        { skipMissingProperties: true },
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects invalid parameters.operation values', () => {
    const errors = validateSync(
      plainToInstance(UpdateCpClauseDto, {
        parameters: { ...baseDto.parameters, operation: 'Invalid' },
      }),
      { skipMissingProperties: true },
    );

    expect(
      errors.find((error) => error.property === 'parameters'),
    ).toBeDefined();
  });
});

describe.each(['wibon', 'wipon'] as const)('%s Boolean contract', (clauseType) => {
  it.each([true, false])('accepts enabled=%s', (enabled) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType,
        rawText: clauseType.toUpperCase(),
        parameters: { enabled, operation: 'Loading' },
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each([undefined, 'true', 'false', 1, 0, null])(
    'rejects enabled=%j',
    (enabled) => {
      const parameters =
        enabled === undefined ? { operation: 'Loading' } : { enabled };
      const errors = validateSync(
        plainToInstance(CreateCpClauseDto, {
          clauseType,
          rawText: clauseType.toUpperCase(),
          parameters,
        }),
      );

      expect(
        errors.find((error) => error.property === 'parameters'),
      ).toBeDefined();
    },
  );
});
