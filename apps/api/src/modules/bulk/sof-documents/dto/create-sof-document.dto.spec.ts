import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSofDocumentDto } from './create-sof-document.dto';
import { UpdateSofDocumentDto } from './update-sof-document.dto';

const baseDto = {
  filePath: 'voyages/VOY-2311/statement-of-facts.pdf',
};

describe('CreateSofDocumentDto', () => {
  it.each(['Loading', 'Discharge'] as const)(
    'accepts operation = %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(CreateSofDocumentDto, { ...baseDto, operation }),
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('accepts omitted operation', () => {
    const errors = validateSync(plainToInstance(CreateSofDocumentDto, baseDto));

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid operation values', () => {
    const errors = validateSync(
      plainToInstance(CreateSofDocumentDto, {
        ...baseDto,
        operation: 'Both',
      }),
    );

    expect(errors.find((error) => error.property === 'operation')).toBeDefined();
  });
});

describe('UpdateSofDocumentDto', () => {
  it('accepts omitted operation', () => {
    const errors = validateSync(
      plainToInstance(UpdateSofDocumentDto, { filePath: baseDto.filePath }),
      { skipMissingProperties: true },
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['Loading', 'Discharge'] as const)(
    'accepts operation = %s',
    (operation) => {
      const errors = validateSync(
        plainToInstance(UpdateSofDocumentDto, { ...baseDto, operation }),
        { skipMissingProperties: true },
      );

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects invalid operation values', () => {
    const errors = validateSync(
      plainToInstance(UpdateSofDocumentDto, {
        ...baseDto,
        operation: 'Invalid',
      }),
      { skipMissingProperties: true },
    );

    expect(errors.find((error) => error.property === 'operation')).toBeDefined();
  });
});
