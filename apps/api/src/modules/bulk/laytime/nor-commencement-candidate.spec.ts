import { resolveNorCommencementCandidate } from './nor-commencement-candidate';
import type { NorLocationEvidenceInput } from './nor-location-qualification';

const READY = 'VESSEL_READY_IN_ALL_RESPECTS';
const NOR = 'NOR_TENDERED';
const FREE_PRATIQUE = 'FREE_PRATIQUE_GRANTED';
const wifpon = (enabled: boolean) => ({
  id: 'wifpon-clause',
  clauseType: 'wifpon' as const,
  parameters: { enabled },
});

const event = (
  id: string,
  eventType: string,
  eventTime: string,
  operation?: 'Loading' | 'Discharge' | null,
) => ({ id, eventType, eventTime: new Date(eventTime), operation });

const document = (id: string, tenderTime: string, acceptedTime?: string) => ({
  id,
  tenderTime: new Date(tenderTime),
  acceptedTime: acceptedTime ? new Date(acceptedTime) : null,
});
const locationEvidence = (
  id: string,
  norDocumentId: string,
  evidenceTime: string,
  overrides: Partial<NorLocationEvidenceInput> = {},
): NorLocationEvidenceInput => ({
  id,
  voyageId: 'voyage-1',
  operation: 'Loading',
  evidenceTime: new Date(evidenceTime),
  portRelation: 'INSIDE_PORT_LIMITS',
  berthRelation: 'AT_BERTH',
  waitingPlace: 'NONE',
  source: 'MANUAL',
  norDocumentId,
  norTenderedEventId: null,
  createdAt: new Date('2026-03-05T00:00:00Z'),
  ...overrides,
});

describe('resolveNorCommencementCandidate', () => {
  it('preserves legacy NOR document selection when readiness is missing', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document('later', '2026-03-04T10:00:00Z'),
        document('earlier', '2026-03-04T08:00:00Z', '2026-03-04T09:00:00Z'),
      ],
      sofEvents: [event('sof-nor', NOR, '2026-03-04T07:00:00Z')],
      operation: 'Loading',
    });

    expect(result.selectedCandidate).toEqual(
      expect.objectContaining({
        source: 'nor-document',
        norDocumentId: 'earlier',
        effectiveTime: new Date('2026-03-04T09:00:00Z'),
        validityBasis: null,
      }),
    );
    expect(result.validityStatus).toBe('unavailable');
    expect(result.warnings).toContain(
      'NOR validity was not evaluated because vessel-readiness evidence is missing.',
    );
  });

  it('uses legacy SOF fallback when readiness and NOR documents are missing', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [],
      sofEvents: [
        event('later', NOR, '2026-03-04T10:00:00Z'),
        event('earlier', NOR, '2026-03-04T08:00:00Z'),
      ],
    });

    expect(result.selectedCandidate).toEqual(
      expect.objectContaining({
        source: 'sof-event',
        norTenderedEventId: 'earlier',
        effectiveTime: new Date('2026-03-04T08:00:00Z'),
      }),
    );
    expect(result.validityStatus).toBe('unavailable');
  });

  it('selects the first NOR when readiness precedes it', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('nor-1', '2026-03-04T08:00:00Z')],
      sofEvents: [event('ready', READY, '2026-03-04T07:00:00Z', 'Loading')],
      operation: 'Loading',
    });

    expect(result.validityStatus).toBe('valid');
    expect(result.selectedCandidate).toEqual(
      expect.objectContaining({
        norDocumentId: 'nor-1',
        validityBasis: 'tendered-ready',
        effectiveTime: new Date('2026-03-04T08:00:00Z'),
      }),
    );
  });

  it('rejects a pre-readiness NOR and selects a later valid NOR', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document('nor-1', '2026-03-04T06:00:00Z'),
        document('nor-2', '2026-03-04T09:00:00Z'),
      ],
      sofEvents: [event('ready', READY, '2026-03-04T08:00:00Z', 'Loading')],
      operation: 'Loading',
    });

    expect(result.selectedCandidate?.norDocumentId).toBe('nor-2');
    expect(result.rejectedCandidates).toEqual([
      expect.objectContaining({ norDocumentId: 'nor-1' }),
    ]);
  });

  it('selects a later valid SOF NOR after rejecting a document NOR', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('document-nor', '2026-03-04T06:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T08:00:00Z', 'Loading'),
        event('sof-nor', NOR, '2026-03-04T09:00:00Z'),
      ],
      operation: 'Loading',
    });

    expect(result.selectedCandidate).toEqual(
      expect.objectContaining({
        source: 'sof-event',
        norTenderedEventId: 'sof-nor',
      }),
    );
  });

  it('prefers a NOR document over a SOF NOR at the same timestamp', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('document-nor', '2026-03-04T08:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T07:00:00Z', 'Loading'),
        event('sof-nor', NOR, '2026-03-04T08:00:00Z'),
      ],
      operation: 'Loading',
    });

    expect(result.selectedCandidate?.source).toBe('nor-document');
  });

  it('uses accepted basis for a readiness-valid tender', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document(
          'accepted-nor',
          '2026-03-04T08:00:00Z',
          '2026-03-04T09:00:00Z',
        ),
      ],
      sofEvents: [event('ready', READY, '2026-03-04T07:00:00Z', 'Loading')],
      operation: 'Loading',
    });

    expect(result.selectedCandidate).toEqual(
      expect.objectContaining({
        validityBasis: 'accepted',
        effectiveTime: new Date('2026-03-04T09:00:00Z'),
      }),
    );
  });

  it('does not let acceptance cure a tender before readiness', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document(
          'accepted-late',
          '2026-03-04T06:00:00Z',
          '2026-03-04T09:00:00Z',
        ),
      ],
      sofEvents: [event('ready', READY, '2026-03-04T08:00:00Z', 'Loading')],
      operation: 'Loading',
    });

    expect(result.selectedCandidate).toBeNull();
    expect(result.rejectedCandidates[0]).toEqual(
      expect.objectContaining({ norDocumentId: 'accepted-late' }),
    );
  });

  it('returns no-valid-candidate when every NOR predates readiness', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('nor-1', '2026-03-04T06:00:00Z')],
      sofEvents: [
        event('sof-nor', NOR, '2026-03-04T07:00:00Z'),
        event('ready', READY, '2026-03-04T08:00:00Z', 'Loading'),
      ],
      operation: 'Loading',
    });

    expect(result.selectedCandidate).toBeNull();
    expect(result.validityStatus).toBe('no-valid-candidate');
    expect(result.rejectedCandidates).toHaveLength(2);
    expect(result.warnings).toContain(
      'No valid NOR candidate remained after NOR qualification.',
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'uses %s readiness selection',
    (operation) => {
      const opposite = operation === 'Loading' ? 'Discharge' : 'Loading';
      const result = resolveNorCommencementCandidate({
        norDocuments: [document('nor', '2026-03-04T08:00:00Z')],
        sofEvents: [
          event('matching-ready', READY, '2026-03-04T07:00:00Z', operation),
          event('opposite-ready', READY, '2026-03-04T09:00:00Z', opposite),
        ],
        operation,
      });

      expect(result.readiness).toEqual({
        selectedEventId: 'matching-ready',
        readinessTime: new Date('2026-03-04T07:00:00Z'),
        source: 'operation-specific',
      });
      expect(result.validityStatus).toBe('valid');
    },
  );

  it('does not mutate inputs and returns cloned dates', () => {
    const norDocuments = [
      document('nor', '2026-03-04T08:00:00Z', '2026-03-04T09:00:00Z'),
    ];
    const sofEvents = [
      event('ready', READY, '2026-03-04T07:00:00Z', 'Loading'),
    ];
    const tenderTime = norDocuments[0].tenderTime.getTime();
    const readinessTime = sofEvents[0].eventTime.getTime();

    const result = resolveNorCommencementCandidate({
      norDocuments,
      sofEvents,
      operation: 'Loading',
    });

    expect(norDocuments[0].tenderTime.getTime()).toBe(tenderTime);
    expect(sofEvents[0].eventTime.getTime()).toBe(readinessTime);
    expect(result.selectedCandidate?.tenderTime).not.toBe(
      norDocuments[0].tenderTime,
    );
    expect(result.readiness.readinessTime).not.toBe(sofEvents[0].eventTime);
  });

  it('returns deterministic results for repeated calls', () => {
    const input = {
      norDocuments: [
        document('nor-z', '2026-03-04T08:00:00Z'),
        document('nor-a', '2026-03-04T08:00:00Z'),
      ],
      sofEvents: [event('ready', READY, '2026-03-04T07:00:00Z', 'Loading')],
      operation: 'Loading' as const,
    };

    expect(resolveNorCommencementCandidate(input)).toEqual(
      resolveNorCommencementCandidate(input),
    );
    expect(
      resolveNorCommencementCandidate(input).selectedCandidate?.norDocumentId,
    ).toBe('nor-a');
  });

  it.each([
    ['before', '2026-03-04T07:30:00Z'],
    ['exactly at', '2026-03-04T08:00:00Z'],
  ])(
    'selects a candidate when free pratique is granted %s NOR',
    (_label, grantTime) => {
      const result = resolveNorCommencementCandidate({
        norDocuments: [document('nor', '2026-03-04T08:00:00Z')],
        sofEvents: [
          event('ready', READY, '2026-03-04T07:00:00Z', 'Loading'),
          event('grant', FREE_PRATIQUE, grantTime, 'Loading'),
        ],
        operation: 'Loading',
        wifponClause: null,
      });

      expect(result.selectedCandidate?.freePratique).toEqual(
        expect.objectContaining({
          valid: true,
          status: 'granted-before-nor',
          eventId: 'grant',
          grantedTime: new Date(grantTime),
          source: 'operation-specific',
          wifponApplied: false,
        }),
      );
    },
  );

  it('rejects a NOR tendered before free pratique without WIFPON', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('nor', '2026-03-04T08:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T07:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T09:00:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: null,
    });

    expect(result.selectedCandidate).toBeNull();
    expect(result.validityStatus).toBe('no-valid-candidate');
    expect(result.freePratiqueRejectedCandidates).toEqual([
      expect.objectContaining({
        norDocumentId: 'nor',
        freePratique: expect.objectContaining({
          valid: false,
          status: 'granted-after-nor',
          eventId: 'grant',
          grantedTime: new Date('2026-03-04T09:00:00Z'),
        }),
      }),
    ]);
  });

  it.each([
    [
      'late grant',
      [event('grant', FREE_PRATIQUE, '2026-03-04T09:00:00Z', 'Loading')],
    ],
    ['missing grant', []],
  ])(
    'selects a candidate with WIFPON enabled and %s',
    (_label, grantEvents) => {
      const result = resolveNorCommencementCandidate({
        norDocuments: [document('nor', '2026-03-04T08:00:00Z')],
        sofEvents: [
          event('ready', READY, '2026-03-04T07:00:00Z', 'Loading'),
          ...grantEvents,
        ],
        operation: 'Loading',
        wifponClause: wifpon(true),
      });

      expect(result.selectedCandidate?.tenderTime).toEqual(
        new Date('2026-03-04T08:00:00Z'),
      );
      expect(result.selectedCandidate?.freePratique).toEqual(
        expect.objectContaining({
          valid: true,
          status: 'waived-by-wifpon',
          wifponClauseId: 'wifpon-clause',
          wifponEnabled: true,
          wifponApplied: true,
          grantedTime:
            grantEvents.length > 0 ? new Date('2026-03-04T09:00:00Z') : null,
        }),
      );
    },
  );

  it.each([
    ['no clause', undefined],
    ['disabled WIFPON', wifpon(false)],
  ])(
    'keeps a candidate eligible with unavailable free-pratique qualification: %s',
    (_label, clause) => {
      const result = resolveNorCommencementCandidate({
        norDocuments: [document('nor', '2026-03-04T08:00:00Z')],
        sofEvents: [event('ready', READY, '2026-03-04T07:00:00Z', 'Loading')],
        operation: 'Loading',
        wifponClause: clause,
      });

      expect(result.selectedCandidate?.freePratique).toEqual(
        expect.objectContaining({
          valid: null,
          status: 'unavailable',
          wifponEnabled: false,
          wifponApplied: false,
        }),
      );
      expect(result.warnings).toContain(
        clause
          ? 'Free-pratique qualification was not evaluated because WIFPON is disabled and free-pratique grant evidence is missing.'
          : 'Free-pratique qualification was not evaluated because grant evidence and an applicable WIFPON clause are missing.',
      );
    },
  );

  it('does not let WIFPON cure a pre-readiness NOR', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('nor', '2026-03-04T08:00:00Z')],
      sofEvents: [event('ready', READY, '2026-03-04T09:00:00Z', 'Loading')],
      operation: 'Loading',
      wifponClause: wifpon(true),
    });

    expect(result.selectedCandidate).toBeNull();
    expect(result.rejectedCandidates[0]).toEqual(
      expect.objectContaining({
        norDocumentId: 'nor',
        validityBasis: 'not-ready',
        freePratique: expect.objectContaining({
          status: 'waived-by-wifpon',
          wifponApplied: true,
        }),
      }),
    );
  });

  it('rejects an early NOR and selects a re-tender after free pratique', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document('nor-before-grant', '2026-03-04T10:00:00Z'),
        document('nor-after-grant', '2026-03-04T13:00:00Z'),
      ],
      sofEvents: [
        event('ready', READY, '2026-03-04T09:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T12:00:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: null,
    });

    expect(result.selectedCandidate?.norDocumentId).toBe('nor-after-grant');
    expect(result.freePratiqueRejectedCandidates).toEqual([
      expect.objectContaining({ norDocumentId: 'nor-before-grant' }),
    ]);
  });

  it('returns no-valid-candidate when every NOR predates free pratique', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document('nor-1', '2026-03-04T10:00:00Z'),
        document('nor-2', '2026-03-04T12:00:00Z'),
      ],
      sofEvents: [
        event('ready', READY, '2026-03-04T09:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T15:00:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: null,
    });

    expect(result.selectedCandidate).toBeNull();
    expect(result.validityStatus).toBe('no-valid-candidate');
    expect(result.freePratiqueRejectedCandidates).toHaveLength(2);
  });

  it('does not let later acceptance cure late free pratique', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [
        document(
          'accepted-nor',
          '2026-03-04T10:00:00Z',
          '2026-03-04T12:00:00Z',
        ),
      ],
      sofEvents: [
        event('ready', READY, '2026-03-04T09:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T11:00:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: null,
    });

    expect(result.selectedCandidate).toBeNull();
    expect(result.freePratiqueRejectedCandidates[0].freePratique.status).toBe(
      'granted-after-nor',
    );
  });

  it('rejects a location-invalid accepted NOR and selects a valid retender', () => {
    const result = resolveNorCommencementCandidate({
      voyageId: 'voyage-1',
      norDocuments: [
        document(
          'invalid-accepted',
          '2026-03-04T10:00:00Z',
          '2026-03-04T11:00:00Z',
        ),
        document('valid-retender', '2026-03-04T13:00:00Z'),
      ],
      sofEvents: [
        event('ready', READY, '2026-03-04T09:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T09:30:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: null,
      locationEvidence: [
        locationEvidence(
          'invalid-location',
          'invalid-accepted',
          '2026-03-04T10:00:00Z',
          { berthRelation: 'NOT_AT_BERTH' },
        ),
        locationEvidence(
          'valid-location',
          'valid-retender',
          '2026-03-04T13:00:00Z',
        ),
      ],
    });

    expect(result.selectedCandidate?.norDocumentId).toBe('valid-retender');
    expect(result.locationRejectedCandidates).toEqual([
      expect.objectContaining({
        norDocumentId: 'invalid-accepted',
        rejectionReasons: ['NOR_LOCATION_NOT_AT_BERTH'],
      }),
    ]);
  });

  it('keeps a candidate eligible when location evidence is unavailable', () => {
    const result = resolveNorCommencementCandidate({
      voyageId: 'voyage-1',
      norDocuments: [document('nor', '2026-03-04T10:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T09:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T09:30:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: null,
      locationEvidence: [
        locationEvidence('future-location', 'nor', '2026-03-04T10:30:00Z'),
      ],
      wibonClause: wifpon(true),
      wiponClause: wifpon(true),
    });

    expect(result.selectedCandidate?.location.overallStatus).toBe(
      'UNAVAILABLE',
    );
    expect(
      result.selectedCandidate?.location.ineligibleAfterTenderEvidenceIds,
    ).toEqual(['future-location']);
    expect(result.selectedCandidate?.location.berth.waiverApplied).toBe(false);
    expect(result.selectedCandidate?.location.port.waiverApplied).toBe(false);
  });

  it('records enabled WIFPON as unnecessary when grant precedes NOR', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('nor', '2026-03-04T10:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T08:00:00Z', 'Loading'),
        event('grant', FREE_PRATIQUE, '2026-03-04T09:00:00Z', 'Loading'),
      ],
      operation: 'Loading',
      wifponClause: wifpon(true),
    });

    expect(result.selectedCandidate?.freePratique).toEqual(
      expect.objectContaining({
        status: 'granted-before-nor',
        wifponEnabled: true,
        wifponApplied: false,
      }),
    );
  });

  it.each(['Loading', 'Discharge'] as const)(
    'isolates %s free-pratique evidence and excludes the opposite operation',
    (operation) => {
      const opposite = operation === 'Loading' ? 'Discharge' : 'Loading';
      const result = resolveNorCommencementCandidate({
        norDocuments: [document('nor', '2026-03-04T10:00:00Z')],
        sofEvents: [
          event('ready', READY, '2026-03-04T08:00:00Z', operation),
          event(
            'matching-grant',
            FREE_PRATIQUE,
            '2026-03-04T09:00:00Z',
            operation,
          ),
          event(
            'opposite-grant',
            FREE_PRATIQUE,
            '2026-03-04T07:00:00Z',
            opposite,
          ),
        ],
        operation,
        wifponClause: null,
      });

      expect(result.selectedCandidate?.freePratique.eventId).toBe(
        'matching-grant',
      );
      expect(
        result.freePratiqueEvidence.excludedOppositeOperationEventIds,
      ).toEqual(['opposite-grant']);
    },
  );

  it('uses null free-pratique evidence as operation fallback', () => {
    const result = resolveNorCommencementCandidate({
      norDocuments: [document('nor', '2026-03-04T10:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T08:00:00Z', 'Loading'),
        event('null-grant', FREE_PRATIQUE, '2026-03-04T09:00:00Z', null),
      ],
      operation: 'Loading',
      wifponClause: null,
    });

    expect(result.selectedCandidate?.freePratique).toEqual(
      expect.objectContaining({
        eventId: 'null-grant',
        source: 'legacy-null',
      }),
    );
  });

  it('deduplicates duplicate free-pratique evidence warnings', () => {
    const input = {
      norDocuments: [document('nor', '2026-03-04T10:00:00Z')],
      sofEvents: [
        event('ready', READY, '2026-03-04T08:00:00Z', 'Loading'),
        event('grant-1', FREE_PRATIQUE, '2026-03-04T09:00:00Z', 'Loading'),
        event('grant-2', FREE_PRATIQUE, '2026-03-04T09:30:00Z', 'Loading'),
      ],
      operation: 'Loading' as const,
      wifponClause: null,
    };

    const first = resolveNorCommencementCandidate(input);
    const second = resolveNorCommencementCandidate(input);
    const duplicateWarning =
      'Multiple free-pratique grant events were eligible; the earliest deterministic event was selected and 1 additional event(s) were treated as duplicates.';

    expect(
      first.warnings.filter((warning) => warning === duplicateWarning),
    ).toHaveLength(1);
    expect(first.selectedCandidate?.freePratique.warnings).toContain(
      duplicateWarning,
    );
    expect(first).toEqual(second);
    expect(input.sofEvents[1].eventTime).toEqual(
      new Date('2026-03-04T09:00:00Z'),
    );
  });
});
