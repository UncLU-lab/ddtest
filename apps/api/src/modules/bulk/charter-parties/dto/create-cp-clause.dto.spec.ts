import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCpClauseDto } from './create-cp-clause.dto';
import { UpdateCpClauseDto } from './update-cp-clause.dto';

const baseDto = {
  clauseType: 'laytime_rate',
  rawText: 'Laytime allowed: 72h',
  parameters: { hours: 72 },
};

describe('CreateCpClauseDto', () => {
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
