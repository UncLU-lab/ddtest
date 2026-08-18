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

      expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
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

      expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
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
        parameters: { enabled: true },
      }),
    );

    expect(errors).toHaveLength(0);
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

  it.each(['yes', 1])('rejects atutc clauses with enabled=%s', (enabled) => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'atutc',
        rawText: 'ATUTC enabled',
        parameters: { enabled },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
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
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, baseDto),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid parameters.operation values', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        ...baseDto,
        parameters: { ...baseDto.parameters, operation: 'Both' },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it('rejects reversible_laytime clauses with a non-boolean enabled flag', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime enabled',
        parameters: { enabled: 'yes' },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it('rejects reversible_laytime clauses with an operation scope', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime enabled',
        parameters: { enabled: true, operation: 'Loading' },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });

  it('rejects atutc clauses with an operation scope', () => {
    const errors = validateSync(
      plainToInstance(CreateCpClauseDto, {
        clauseType: 'atutc',
        rawText: 'ATUTC enabled',
        parameters: { enabled: true, operation: 'Loading' },
      }),
    );

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });
});

describe('UpdateCpClauseDto', () => {
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

    expect(errors.find((error) => error.property === 'parameters')).toBeDefined();
  });
});
