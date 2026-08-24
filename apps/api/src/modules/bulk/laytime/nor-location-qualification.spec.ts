import {
  type NorLocationEvidenceInput,
  resolveNorLocationQualification,
} from './nor-location-qualification';

const candidate = {
  source: 'nor-document' as const,
  id: 'nor-1',
  voyageId: 'voyage-a',
  operation: 'Loading' as const,
  tenderTime: new Date('2026-03-06T12:00:00Z'),
};
const clause = (id: string, enabled: boolean) => ({
  id,
  parameters: { enabled },
});
const evidence = (
  overrides: Partial<NorLocationEvidenceInput> = {},
): NorLocationEvidenceInput => ({
  id: 'evidence-1',
  voyageId: 'voyage-a',
  operation: 'Loading',
  evidenceTime: new Date('2026-03-06T11:00:00Z'),
  portRelation: 'INSIDE_PORT_LIMITS',
  berthRelation: 'AT_BERTH',
  waitingPlace: 'NONE',
  source: 'MANUAL',
  norDocumentId: 'nor-1',
  norTenderedEventId: null,
  createdAt: new Date('2026-03-06T13:00:00Z'),
  ...overrides,
});

describe('resolveNorLocationQualification', () => {
  it.each([
    ['AT_BERTH without WIBON', 'AT_BERTH', undefined, 'PASS', false],
    ['NOT_AT_BERTH without WIBON', 'NOT_AT_BERTH', undefined, 'INVALID', false],
    [
      'NOT_AT_BERTH with disabled WIBON',
      'NOT_AT_BERTH',
      clause('wibon', false),
      'INVALID',
      false,
    ],
    [
      'NOT_AT_BERTH with enabled WIBON',
      'NOT_AT_BERTH',
      clause('wibon', true),
      'PASS',
      true,
    ],
    [
      'AT_BERTH with enabled WIBON',
      'AT_BERTH',
      clause('wibon', true),
      'PASS',
      false,
    ],
    ['UNKNOWN berth', 'UNKNOWN', clause('wibon', true), 'UNAVAILABLE', false],
  ] as const)('%s', (_label, berthRelation, wibonClause, status, applied) => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [evidence({ berthRelation })],
      wibonClause,
    });

    expect(result.berth.status).toBe(status);
    expect(result.berth.waiverApplied).toBe(applied);
  });

  it.each([
    [
      'INSIDE without WIPON',
      'INSIDE_PORT_LIMITS',
      'NONE',
      undefined,
      'PASS',
      false,
    ],
    [
      'OUTSIDE without WIPON',
      'OUTSIDE_PORT_LIMITS',
      'ANCHORAGE',
      undefined,
      'INVALID',
      false,
    ],
    [
      'OUTSIDE with disabled WIPON',
      'OUTSIDE_PORT_LIMITS',
      'ANCHORAGE',
      clause('wipon', false),
      'INVALID',
      false,
    ],
    [
      'OUTSIDE anchorage with WIPON',
      'OUTSIDE_PORT_LIMITS',
      'ANCHORAGE',
      clause('wipon', true),
      'PASS',
      true,
    ],
    [
      'OUTSIDE pilot station with WIPON',
      'OUTSIDE_PORT_LIMITS',
      'PILOT_STATION',
      clause('wipon', true),
      'PASS',
      true,
    ],
    [
      'OUTSIDE customary place with WIPON',
      'OUTSIDE_PORT_LIMITS',
      'CUSTOMARY_WAITING_PLACE',
      clause('wipon', true),
      'PASS',
      true,
    ],
    [
      'OUTSIDE other with WIPON',
      'OUTSIDE_PORT_LIMITS',
      'OTHER',
      clause('wipon', true),
      'INVALID',
      false,
    ],
    [
      'OUTSIDE none with WIPON',
      'OUTSIDE_PORT_LIMITS',
      'NONE',
      clause('wipon', true),
      'INVALID',
      false,
    ],
    [
      'OUTSIDE unknown place with WIPON',
      'OUTSIDE_PORT_LIMITS',
      'UNKNOWN',
      clause('wipon', true),
      'UNAVAILABLE',
      false,
    ],
    [
      'UNKNOWN port',
      'UNKNOWN',
      'ANCHORAGE',
      clause('wipon', true),
      'UNAVAILABLE',
      false,
    ],
  ] as const)(
    '%s',
    (_label, portRelation, waitingPlace, wiponClause, status, applied) => {
      const result = resolveNorLocationQualification({
        candidate,
        evidence: [evidence({ portRelation, waitingPlace })],
        wiponClause,
      });

      expect(result.port.status).toBe(status);
      expect(result.port.waiverApplied).toBe(applied);
    },
  );

  it('combines independent berth and port requirements', () => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [
        evidence({
          portRelation: 'OUTSIDE_PORT_LIMITS',
          berthRelation: 'NOT_AT_BERTH',
          waitingPlace: 'PILOT_STATION',
        }),
      ],
      wibonClause: clause('wibon', true),
      wiponClause: clause('wipon', true),
    });

    expect(result.overallStatus).toBe('PASS');
    expect(result.berth.waiverApplied).toBe(true);
    expect(result.port.waiverApplied).toBe(true);
  });

  it('gives definite invalidity precedence over an unavailable dimension', () => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [
        evidence({
          portRelation: 'UNKNOWN',
          berthRelation: 'NOT_AT_BERTH',
        }),
      ],
    });

    expect(result.berth.status).toBe('INVALID');
    expect(result.port.status).toBe('UNAVAILABLE');
    expect(result.overallStatus).toBe('INVALID');
  });

  it('uses only same-voyage, same-operation, directly associated evidence', () => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [
        evidence({ id: 'unassociated', norDocumentId: null }),
        evidence({ id: 'other-voyage', voyageId: 'voyage-b' }),
        evidence({ id: 'other-operation', operation: 'Discharge' }),
      ],
      wibonClause: clause('wibon', true),
      wiponClause: clause('wipon', true),
    });

    expect(result.overallStatus).toBe('UNAVAILABLE');
    expect(result.selectedEvidence).toBeNull();
    expect(result.ignoredUnassociatedEvidenceIds).toEqual([
      'unassociated',
      'other-voyage',
      'other-operation',
    ]);
  });

  it('does not treat unassociated evidence as linked to an unidentified candidate', () => {
    const result = resolveNorLocationQualification({
      candidate: { ...candidate, id: null },
      evidence: [evidence({ norDocumentId: null })],
    });

    expect(result.overallStatus).toBe('UNAVAILABLE');
    expect(result.selectedEvidence).toBeNull();
  });

  it.each([
    ['before', '2026-03-06T11:59:59Z', true],
    ['at tender', '2026-03-06T12:00:00Z', true],
    ['after', '2026-03-06T12:00:01Z', false],
  ])(
    'treats evidence %s tender as eligible=%s',
    (_label, evidenceTime, eligible) => {
      const result = resolveNorLocationQualification({
        candidate,
        evidence: [evidence({ evidenceTime: new Date(evidenceTime) })],
      });

      expect(result.selectedEvidence !== null).toBe(eligible);
      expect(result.overallStatus).toBe(eligible ? 'PASS' : 'UNAVAILABLE');
    },
  );

  it('selects the latest eligible factual observation', () => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [
        evidence({
          id: 'earlier',
          evidenceTime: new Date('2026-03-06T10:00:00Z'),
          portRelation: 'OUTSIDE_PORT_LIMITS',
        }),
        evidence({
          id: 'later',
          evidenceTime: new Date('2026-03-06T11:00:00Z'),
          portRelation: 'INSIDE_PORT_LIMITS',
        }),
      ],
    });

    expect(result.selectedEvidence?.id).toBe('later');
    expect(result.overallStatus).toBe('PASS');
  });

  it('uses createdAt then id only when equally timed facts agree', () => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [
        evidence({ id: 'a', createdAt: new Date('2026-03-06T13:00:00Z') }),
        evidence({ id: 'b', createdAt: new Date('2026-03-06T14:00:00Z') }),
      ],
    });

    expect(result.selectedEvidence?.id).toBe('b');
    expect(result.overallStatus).toBe('PASS');
  });

  it('returns unavailable instead of choosing equally timed conflicting facts', () => {
    const result = resolveNorLocationQualification({
      candidate,
      evidence: [
        evidence({ id: 'inside' }),
        evidence({ id: 'outside', portRelation: 'OUTSIDE_PORT_LIMITS' }),
      ],
      wiponClause: clause('wipon', true),
    });

    expect(result.overallStatus).toBe('UNAVAILABLE');
    expect(result.selectedEvidence).toBeNull();
    expect(result.conflictingEvidenceIds).toEqual(['inside', 'outside']);
    expect(result.port.reason).toBe('LOCATION_EVIDENCE_CONFLICT');
  });

  it('matches SOF NOR candidates only through the event association', () => {
    const result = resolveNorLocationQualification({
      candidate: { ...candidate, source: 'sof-event', id: 'event-nor' },
      evidence: [
        evidence({ norDocumentId: null, norTenderedEventId: 'event-nor' }),
      ],
    });

    expect(result.overallStatus).toBe('PASS');
    expect(result.associationBasis).toBe('explicit-sof-nor-tendered-event');
  });
});
