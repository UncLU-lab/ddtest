import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateNorTenderLocationEvidenceDto } from './create-nor-tender-location-evidence.dto';
import { FindNorTenderLocationEvidenceQueryDto } from './find-nor-tender-location-evidence-query.dto';

const baseDto = {
  evidenceTime: '2026-03-04T08:00:00Z',
  operation: 'Loading',
  portRelation: 'INSIDE_PORT_LIMITS',
  berthRelation: 'NOT_AT_BERTH',
  waitingPlace: 'ANCHORAGE',
  source: 'MANUAL',
};

describe('CreateNorTenderLocationEvidenceDto', () => {
  it.each(['INSIDE_PORT_LIMITS', 'OUTSIDE_PORT_LIMITS', 'UNKNOWN'])(
    'accepts portRelation %s',
    (portRelation) => {
      expect(
        validateSync(
          plainToInstance(CreateNorTenderLocationEvidenceDto, {
            ...baseDto,
            portRelation,
          }),
        ),
      ).toHaveLength(0);
    },
  );

  it.each(['AT_BERTH', 'NOT_AT_BERTH', 'UNKNOWN'])(
    'accepts berthRelation %s',
    (berthRelation) => {
      expect(
        validateSync(
          plainToInstance(CreateNorTenderLocationEvidenceDto, {
            ...baseDto,
            berthRelation,
          }),
        ),
      ).toHaveLength(0);
    },
  );

  it.each([
    'ANCHORAGE',
    'PILOT_STATION',
    'CUSTOMARY_WAITING_PLACE',
    'OTHER',
    'NONE',
    'UNKNOWN',
  ])('accepts waitingPlace %s', (waitingPlace) => {
    expect(
      validateSync(
        plainToInstance(CreateNorTenderLocationEvidenceDto, {
          ...baseDto,
          waitingPlace,
        }),
      ),
    ).toHaveLength(0);
  });

  it.each([
    ['portRelation', 'AT_SEA'],
    ['berthRelation', 'ALONGSIDE'],
    ['waitingPlace', 'ROADS'],
    ['operation', 'Container'],
    ['source', 'AIS'],
  ])('rejects invalid request value %s=%s', (field, value) => {
    const errors = validateSync(
      plainToInstance(CreateNorTenderLocationEvidenceDto, {
        ...baseDto,
        [field]: value,
      }),
    );

    expect(errors.find((error) => error.property === field)).toBeDefined();
  });

  it('requires an explicit evidence timestamp', () => {
    const dto: Partial<typeof baseDto> = { ...baseDto };
    delete dto.evidenceTime;
    const errors = validateSync(
      plainToInstance(CreateNorTenderLocationEvidenceDto, dto),
    );

    expect(
      errors.find((error) => error.property === 'evidenceTime'),
    ).toBeDefined();
  });

  it('accepts SOF provenance and explicit candidate references', () => {
    const errors = validateSync(
      plainToInstance(CreateNorTenderLocationEvidenceDto, {
        ...baseDto,
        source: 'SOF',
        sofDocumentId: '10000000-0000-4000-8000-000000000001',
        norDocumentId: '10000000-0000-4000-8000-000000000002',
        sourceReference: 'SOF page 2, line 14',
        note: 'Master tendered NOR at pilot station',
      }),
    );

    expect(errors).toHaveLength(0);
  });
});

describe('FindNorTenderLocationEvidenceQueryDto', () => {
  it.each(['Loading', 'Discharge'])(
    'accepts operation filter %s',
    (operation) => {
      expect(
        validateSync(
          plainToInstance(FindNorTenderLocationEvidenceQueryDto, {
            operation,
          }),
        ),
      ).toHaveLength(0);
    },
  );

  it('rejects an unsupported operation filter', () => {
    const errors = validateSync(
      plainToInstance(FindNorTenderLocationEvidenceQueryDto, {
        operation: 'Both',
      }),
    );

    expect(
      errors.find((error) => error.property === 'operation'),
    ).toBeDefined();
  });
});
