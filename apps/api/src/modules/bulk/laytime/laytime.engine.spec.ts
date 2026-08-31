import { runLaytimeEngine } from './laytime.engine';
import {
  EngineClause,
  LaytimeEngineError,
  LaytimeEngineInput,
} from './laytime.types';
import { secondsToInterval } from './interval.util';

const laytimeRate: EngineClause = {
  id: 'clause-laytime',
  clauseType: 'laytime_rate',
  // 10 000 MT/day against 20 000 MT of cargo = 2 days allowed.
  parameters: { rate: 10_000, unit: 'MT', noticeHours: 6 },
};

const extendedLaytimeRate: EngineClause = {
  id: 'clause-laytime-fixed',
  clauseType: 'laytime_rate',
  parameters: { hours: 120, noticeHours: 6 },
};

const demurrageRate: EngineClause = {
  id: 'clause-demurrage',
  clauseType: 'demurrage_rate',
  parameters: { rate: 12_000 },
};

const despatch: EngineClause = {
  id: 'clause-despatch',
  clauseType: 'despatch',
  parameters: { halfDemurrage: true },
};

const atutcEnabled: EngineClause = {
  id: 'clause-atutc',
  clauseType: 'atutc',
  parameters: { enabled: true },
};

const atutcDisabled: EngineClause = {
  id: 'clause-atutc-disabled',
  clauseType: 'atutc',
  parameters: { enabled: false },
};

const shexEnabled: EngineClause = {
  id: 'clause-shex',
  clauseType: 'shex_shinc',
  parameters: { shex: true },
};

const shinc: EngineClause = {
  id: 'clause-shinc',
  clauseType: 'shex_shinc',
  parameters: { shex: false },
};

const weatherWorking: EngineClause = {
  id: 'clause-weather-working',
  clauseType: 'weather_working',
  parameters: { enabled: true },
};

/** Wednesday, so the default window never crosses a weekend. */
const NOR_TENDERED = new Date('2026-03-04T00:00:00Z');
const FRIDAY_NOR = new Date('2026-03-06T00:00:00Z');
const SATURDAY_20 = new Date('2026-03-07T20:00:00Z');
const SUNDAY_00 = new Date('2026-03-08T00:00:00Z');
const SUNDAY_08 = new Date('2026-03-08T08:00:00Z');
const SUNDAY_10 = new Date('2026-03-08T10:00:00Z');
const SUNDAY_12 = new Date('2026-03-08T12:00:00Z');
const SUNDAY_14 = new Date('2026-03-08T14:00:00Z');
const SUNDAY_END = new Date('2026-03-09T00:00:00Z');
const MONDAY_00 = new Date('2026-03-09T00:00:00Z');
const MONDAY_06 = new Date('2026-03-09T06:00:00Z');

function buildInput(overrides: Partial<LaytimeEngineInput> = {}) {
  return {
    cargoQuantity: 20_000,
    clauses: [laytimeRate, demurrageRate, despatch],
    norDocuments: [{ tenderTime: NOR_TENDERED, acceptedTime: NOR_TENDERED }],
    operation: 'Loading' as const,
    sofEvents: [
      { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
      {
        eventTime: new Date('2026-03-06T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
      },
    ],
    ...overrides,
  };
}

describe('runLaytimeEngine', () => {
  it('starts the clock a notice period after NOR and counts to completion', () => {
    const result = runLaytimeEngine(buildInput());

    // NOR 00:00 + 6h notice = 06:00 on the 4th; completion 06:00 on the 6th.
    expect(result.commencedAt.toISOString()).toBe('2026-03-04T06:00:00.000Z');
    expect(secondsToInterval(result.allowedSeconds)).toBe('2 days 00:00:00');
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.demurrageAmount).toBe(0);
    expect(result.despatchAmount).toBe(0);
    expect(result.periods).toEqual([
      {
        startTime: new Date('2026-03-04T06:00:00Z'),
        endTime: new Date('2026-03-06T06:00:00Z'),
        periodType: 'laytime',
        appliedClauseId: null,
      },
    ]);
    expect(result.commencement.validityStatus).toBe('unavailable');
    expect(result.warnings).toContain(
      'NOR validity was not evaluated because vessel-readiness evidence is missing.',
    );
  });

  describe('WIBON/WIPON NOR location validity', () => {
    const ready = {
      id: 'ready-location',
      eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      eventTime: new Date('2026-03-04T08:00:00Z'),
      operation: 'Loading' as const,
    };
    const completed = {
      id: 'completed-location',
      eventType: 'CARGO_COMPLETED',
      eventTime: new Date('2026-03-05T18:00:00Z'),
      operation: 'Loading' as const,
    };
    const location = (
      id: string,
      norDocumentId: string,
      evidenceTime: string,
      portRelation: 'INSIDE_PORT_LIMITS' | 'OUTSIDE_PORT_LIMITS',
      berthRelation: 'AT_BERTH' | 'NOT_AT_BERTH',
      waitingPlace: 'ANCHORAGE' | 'PILOT_STATION' | 'NONE',
    ) => ({
      id,
      voyageId: 'voyage-location',
      operation: 'Loading' as const,
      evidenceTime: new Date(evidenceTime),
      portRelation,
      berthRelation,
      waitingPlace,
      source: 'MANUAL' as const,
      norDocumentId,
      norTenderedEventId: null,
      createdAt: new Date('2026-03-06T00:00:00Z'),
    });
    const wibon: EngineClause = {
      id: 'wibon-loading',
      clauseType: 'wibon',
      parameters: { enabled: true, operation: 'Loading' },
    };
    const wipon: EngineClause = {
      id: 'wipon-loading',
      clauseType: 'wipon',
      parameters: { enabled: true, operation: 'Loading' },
    };

    it('applies WIBON to an inside-port NOR tendered away from berth', () => {
      const tenderTime = '2026-03-04T09:00:00Z';
      const result = runLaytimeEngine(
        buildInput({
          voyageId: 'voyage-location',
          clauses: [laytimeRate, demurrageRate, despatch, wibon],
          norDocuments: [{ id: 'nor-wibon', tenderTime: new Date(tenderTime) }],
          norTenderLocationEvidence: [
            location(
              'evidence-wibon',
              'nor-wibon',
              tenderTime,
              'INSIDE_PORT_LIMITS',
              'NOT_AT_BERTH',
              'ANCHORAGE',
            ),
          ],
          sofEvents: [ready, completed],
        }),
      );

      expect(result.commencement.location.overallStatus).toBe('PASS');
      expect(result.commencement.location.berth.waiverApplied).toBe(true);
      expect(result.commencement.location.port.waiverApplied).toBe(false);
      expect(result.commencedAt).toEqual(new Date('2026-03-04T15:00:00Z'));
    });

    it('rejects the same away-from-berth NOR when WIBON is absent', () => {
      const tenderTime = '2026-03-04T09:00:00Z';
      expect(() =>
        runLaytimeEngine(
          buildInput({
            voyageId: 'voyage-location',
            norDocuments: [
              { id: 'nor-no-wibon', tenderTime: new Date(tenderTime) },
            ],
            norTenderLocationEvidence: [
              location(
                'evidence-no-wibon',
                'nor-no-wibon',
                tenderTime,
                'INSIDE_PORT_LIMITS',
                'NOT_AT_BERTH',
                'ANCHORAGE',
              ),
            ],
            sofEvents: [ready, completed],
          }),
        ),
      ).toThrow(
        'No valid NOR exists after applying NOR qualification requirements.',
      );
    });

    it('applies independent WIBON and WIPON waivers outside port at a pilot station', () => {
      const tenderTime = '2026-03-04T09:00:00Z';
      const result = runLaytimeEngine(
        buildInput({
          voyageId: 'voyage-location',
          clauses: [laytimeRate, demurrageRate, despatch, wibon, wipon],
          norDocuments: [{ id: 'nor-both', tenderTime: new Date(tenderTime) }],
          norTenderLocationEvidence: [
            location(
              'evidence-both',
              'nor-both',
              tenderTime,
              'OUTSIDE_PORT_LIMITS',
              'NOT_AT_BERTH',
              'PILOT_STATION',
            ),
          ],
          sofEvents: [ready, completed],
        }),
      );

      expect(result.commencement.location.overallStatus).toBe('PASS');
      expect(result.commencement.location.berth.waiverApplied).toBe(true);
      expect(result.commencement.location.port.waiverApplied).toBe(true);
    });

    it('does not let WIPON waive the independent berth requirement', () => {
      const tenderTime = '2026-03-04T09:00:00Z';
      expect(() =>
        runLaytimeEngine(
          buildInput({
            voyageId: 'voyage-location',
            clauses: [laytimeRate, demurrageRate, despatch, wipon],
            norDocuments: [
              { id: 'nor-wipon-only', tenderTime: new Date(tenderTime) },
            ],
            norTenderLocationEvidence: [
              location(
                'evidence-wipon-only',
                'nor-wipon-only',
                tenderTime,
                'OUTSIDE_PORT_LIMITS',
                'NOT_AT_BERTH',
                'PILOT_STATION',
              ),
            ],
            sofEvents: [ready, completed],
          }),
        ),
      ).toThrow(
        'No valid NOR exists after applying NOR qualification requirements.',
      );
    });

    it('rejects the first location-invalid NOR and selects a valid retender', () => {
      const result = runLaytimeEngine(
        buildInput({
          voyageId: 'voyage-location',
          norDocuments: [
            { id: 'nor-invalid', tenderTime: new Date('2026-03-04T09:00:00Z') },
            {
              id: 'nor-retender',
              tenderTime: new Date('2026-03-04T11:00:00Z'),
            },
          ],
          norTenderLocationEvidence: [
            location(
              'evidence-invalid',
              'nor-invalid',
              '2026-03-04T09:00:00Z',
              'OUTSIDE_PORT_LIMITS',
              'NOT_AT_BERTH',
              'NONE',
            ),
            location(
              'evidence-retender',
              'nor-retender',
              '2026-03-04T11:00:00Z',
              'INSIDE_PORT_LIMITS',
              'AT_BERTH',
              'NONE',
            ),
          ],
          sofEvents: [ready, completed],
        }),
      );

      expect(result.commencement.norDocumentId).toBe('nor-retender');
      expect(result.commencement.locationRejectedCandidates[0]).toEqual(
        expect.objectContaining({
          norDocumentId: 'nor-invalid',
          rejectionReasons: [
            'NOR_LOCATION_NOT_AT_BERTH',
            'NOR_LOCATION_OUTSIDE_PORT',
          ],
        }),
      );
    });

    it('uses the operation-specific WIBON clause instead of the global fallback', () => {
      const tenderTime = '2026-03-04T09:00:00Z';
      const result = runLaytimeEngine(
        buildInput({
          voyageId: 'voyage-location',
          clauses: [
            laytimeRate,
            demurrageRate,
            despatch,
            {
              id: 'wibon-global-disabled',
              clauseType: 'wibon',
              parameters: { enabled: false },
            },
            wibon,
          ],
          norDocuments: [
            { id: 'nor-scoped', tenderTime: new Date(tenderTime) },
          ],
          norTenderLocationEvidence: [
            location(
              'evidence-scoped',
              'nor-scoped',
              tenderTime,
              'INSIDE_PORT_LIMITS',
              'NOT_AT_BERTH',
              'ANCHORAGE',
            ),
          ],
          sofEvents: [ready, completed],
        }),
      );

      expect(result.commencement.location.berth).toEqual(
        expect.objectContaining({
          clauseId: 'wibon-loading',
          enabled: true,
          waiverApplied: true,
        }),
      );
    });

    it('excludes an opposite-operation WIBON and uses a global fallback', () => {
      const tenderTime = '2026-03-04T09:00:00Z';
      const result = runLaytimeEngine(
        buildInput({
          voyageId: 'voyage-location',
          clauses: [
            laytimeRate,
            demurrageRate,
            despatch,
            {
              id: 'wibon-discharge-disabled',
              clauseType: 'wibon',
              parameters: { enabled: false, operation: 'Discharge' },
            },
            {
              id: 'wibon-global-enabled',
              clauseType: 'wibon',
              parameters: { enabled: true },
            },
          ],
          norDocuments: [
            { id: 'nor-global', tenderTime: new Date(tenderTime) },
          ],
          norTenderLocationEvidence: [
            location(
              'evidence-global',
              'nor-global',
              tenderTime,
              'INSIDE_PORT_LIMITS',
              'NOT_AT_BERTH',
              'ANCHORAGE',
            ),
          ],
          sofEvents: [ready, completed],
        }),
      );

      expect(result.commencement.location.berth.clauseId).toBe(
        'wibon-global-enabled',
      );
      expect(result.commencement.location.berth.waiverApplied).toBe(true);
    });
  });

  describe('vessel-readiness NOR validity', () => {
    const readiness = {
      id: 'ready-loading',
      eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      eventTime: new Date('2026-03-04T01:00:00Z'),
      operation: 'Loading' as const,
    };

    it('uses a readiness-valid NOR before applying the existing notice period', () => {
      const result = runLaytimeEngine(
        buildInput({
          norDocuments: [
            { id: 'nor-valid', tenderTime: new Date('2026-03-04T02:00:00Z') },
          ],
          sofEvents: [
            readiness,
            {
              eventType: 'CARGO_COMPLETED',
              eventTime: new Date('2026-03-06T08:00:00Z'),
            },
          ],
        }),
      );

      expect(result.commencement).toEqual(
        expect.objectContaining({
          norDocumentId: 'nor-valid',
          readinessEventId: 'ready-loading',
          readinessSource: 'operation-specific',
          validityStatus: 'valid',
          validityBasis: 'tendered-ready',
          noticeHours: 6,
          commencedAt: new Date('2026-03-04T08:00:00Z'),
        }),
      );
    });

    it('rejects an early NOR and selects the next readiness-valid NOR', () => {
      const result = runLaytimeEngine(
        buildInput({
          norDocuments: [
            { id: 'nor-early', tenderTime: new Date('2026-03-04T00:00:00Z') },
            { id: 'nor-later', tenderTime: new Date('2026-03-04T02:00:00Z') },
          ],
          sofEvents: [
            readiness,
            {
              eventType: 'CARGO_COMPLETED',
              eventTime: new Date('2026-03-06T08:00:00Z'),
            },
          ],
        }),
      );

      expect(result.commencement.norDocumentId).toBe('nor-later');
      expect(result.commencement.rejectedNorCandidates).toEqual([
        expect.objectContaining({
          norDocumentId: 'nor-early',
          validityBasis: 'not-ready',
        }),
      ]);
    });

    it('selects a later valid SOF NOR after rejecting an invalid document NOR', () => {
      const result = runLaytimeEngine(
        buildInput({
          norDocuments: [
            { id: 'nor-early', tenderTime: new Date('2026-03-04T00:00:00Z') },
          ],
          sofEvents: [
            readiness,
            {
              id: 'sof-nor-valid',
              eventType: 'NOR_TENDERED',
              eventTime: new Date('2026-03-04T03:00:00Z'),
              operation: 'Loading',
            },
            {
              eventType: 'CARGO_COMPLETED',
              eventTime: new Date('2026-03-06T09:00:00Z'),
            },
          ],
        }),
      );

      expect(result.commencement).toEqual(
        expect.objectContaining({
          basis: 'sof_nor_tendered',
          norTenderedEventId: 'sof-nor-valid',
          baseTime: new Date('2026-03-04T03:00:00Z'),
        }),
      );
    });

    it('uses acceptance only for a tender that was already readiness-valid', () => {
      const result = runLaytimeEngine(
        buildInput({
          norDocuments: [
            {
              id: 'nor-accepted',
              tenderTime: new Date('2026-03-04T02:00:00Z'),
              acceptedTime: new Date('2026-03-04T04:00:00Z'),
            },
          ],
          sofEvents: [
            readiness,
            {
              eventType: 'CARGO_COMPLETED',
              eventTime: new Date('2026-03-06T10:00:00Z'),
            },
          ],
        }),
      );

      expect(result.commencement.validityBasis).toBe('accepted');
      expect(result.commencement.baseTime).toEqual(
        new Date('2026-03-04T04:00:00Z'),
      );
      expect(result.commencedAt).toEqual(new Date('2026-03-04T10:00:00Z'));
    });

    it('fails when acceptance cannot cure a tender before readiness', () => {
      expect(() =>
        runLaytimeEngine(
          buildInput({
            norDocuments: [
              {
                id: 'nor-invalid',
                tenderTime: new Date('2026-03-04T00:00:00Z'),
                acceptedTime: new Date('2026-03-04T02:00:00Z'),
              },
            ],
            sofEvents: [
              readiness,
              {
                eventType: 'CARGO_COMPLETED',
                eventTime: new Date('2026-03-06T10:00:00Z'),
              },
            ],
          }),
        ),
      ).toThrow(
        'No valid NOR exists after applying NOR qualification requirements.',
      );
    });

    it('preserves the existing fatal error when no NOR evidence exists', () => {
      expect(() =>
        runLaytimeEngine(
          buildInput({
            norDocuments: [],
            sofEvents: [
              {
                eventType: 'CARGO_COMPLETED',
                eventTime: new Date('2026-03-06T06:00:00Z'),
              },
            ],
          }),
        ),
      ).toThrow(LaytimeEngineError);
    });
  });

  describe('WIFPON free-pratique qualification', () => {
    const ready = (operation: 'Loading' | 'Discharge' = 'Loading') => ({
      id: `ready-${operation.toLowerCase()}`,
      eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
      eventTime: new Date('2026-03-04T09:00:00Z'),
      operation,
    });
    const completion = {
      id: 'completion',
      eventType: 'CARGO_COMPLETED',
      eventTime: new Date('2026-03-06T16:00:00Z'),
    };
    const wifpon = (
      id: string,
      enabled: boolean,
      operation?: 'Loading' | 'Discharge',
    ): EngineClause => ({
      id,
      clauseType: 'wifpon',
      parameters: { enabled, ...(operation ? { operation } : {}) },
    });
    const grant = (
      eventTime: string,
      operation: 'Loading' | 'Discharge' | null = 'Loading',
      id = 'free-pratique',
    ) => ({
      id,
      eventType: 'FREE_PRATIQUE_GRANTED',
      eventTime: new Date(eventTime),
      operation,
    });
    const qualifiedInput = (
      overrides: Partial<LaytimeEngineInput> = {},
    ): LaytimeEngineInput =>
      buildInput({
        norDocuments: [
          { id: 'nor', tenderTime: new Date('2026-03-04T10:00:00Z') },
        ],
        sofEvents: [ready(), completion],
        ...overrides,
      });

    it.each([
      ['before', '2026-03-04T09:30:00Z'],
      ['exactly at', '2026-03-04T10:00:00Z'],
    ])('accepts free pratique granted %s NOR', (_label, grantTime) => {
      const result = runLaytimeEngine(
        qualifiedInput({ sofEvents: [ready(), grant(grantTime), completion] }),
      );

      expect(result.commencement.freePratique).toEqual(
        expect.objectContaining({
          eventId: 'free-pratique',
          grantedTime: new Date(grantTime),
          status: 'granted-before-nor',
          valid: true,
          wifponEnabled: false,
          wifponApplied: false,
        }),
      );
    });

    it('rejects late free pratique and selects a valid post-grant re-tender', () => {
      const result = runLaytimeEngine(
        qualifiedInput({
          norDocuments: [
            {
              id: 'nor-before-grant',
              tenderTime: new Date('2026-03-04T10:00:00Z'),
            },
            {
              id: 'nor-after-grant',
              tenderTime: new Date('2026-03-04T13:00:00Z'),
            },
          ],
          sofEvents: [ready(), grant('2026-03-04T12:00:00Z'), completion],
        }),
      );

      expect(result.commencement.norDocumentId).toBe('nor-after-grant');
      expect(result.commencement.freePratique.status).toBe(
        'granted-before-nor',
      );
      expect(result.commencement.freePratiqueRejectedCandidates).toEqual([
        expect.objectContaining({
          norDocumentId: 'nor-before-grant',
          tenderTime: new Date('2026-03-04T10:00:00Z'),
          freePratique: expect.objectContaining({
            status: 'granted-after-nor',
            valid: false,
            eventId: 'free-pratique',
          }),
        }),
      ]);
    });

    it('fails when every NOR precedes free pratique without enabled WIFPON', () => {
      expect(() =>
        runLaytimeEngine(
          qualifiedInput({
            norDocuments: [
              { id: 'nor-1', tenderTime: new Date('2026-03-04T10:00:00Z') },
              { id: 'nor-2', tenderTime: new Date('2026-03-04T11:00:00Z') },
            ],
            sofEvents: [ready(), grant('2026-03-04T12:00:00Z'), completion],
          }),
        ),
      ).toThrow(
        'No valid NOR exists after applying NOR qualification requirements.',
      );
    });

    it.each([
      ['late grant', [grant('2026-03-04T12:00:00Z')]],
      ['missing grant', []],
    ] as const)(
      'applies enabled WIFPON for %s without moving tender time',
      (_label, evidence) => {
        const result = runLaytimeEngine(
          qualifiedInput({
            clauses: [
              laytimeRate,
              demurrageRate,
              despatch,
              wifpon('wifpon-loading', true, 'Loading'),
            ],
            sofEvents: [ready(), ...evidence, completion],
          }),
        );

        expect(result.commencement.tenderTime).toEqual(
          new Date('2026-03-04T10:00:00Z'),
        );
        expect(result.commencement.freePratique).toEqual(
          expect.objectContaining({
            status: 'waived-by-wifpon',
            valid: true,
            wifponClauseId: 'wifpon-loading',
            wifponEnabled: true,
            wifponApplied: true,
          }),
        );
        expect(result.commencement.freePratique.grantedTime).toEqual(
          evidence.length ? new Date('2026-03-04T12:00:00Z') : null,
        );
      },
    );

    it('does not apply enabled WIFPON when grant already precedes NOR', () => {
      const result = runLaytimeEngine(
        qualifiedInput({
          clauses: [
            laytimeRate,
            demurrageRate,
            despatch,
            wifpon('wifpon-loading', true, 'Loading'),
          ],
          sofEvents: [ready(), grant('2026-03-04T09:30:00Z'), completion],
        }),
      );

      expect(result.commencement.freePratique).toEqual(
        expect.objectContaining({
          status: 'granted-before-nor',
          wifponEnabled: true,
          wifponApplied: false,
        }),
      );
    });

    it('does not let acceptance cure late free pratique', () => {
      expect(() =>
        runLaytimeEngine(
          qualifiedInput({
            norDocuments: [
              {
                id: 'accepted-nor',
                tenderTime: new Date('2026-03-04T10:00:00Z'),
                acceptedTime: new Date('2026-03-04T12:00:00Z'),
              },
            ],
            sofEvents: [ready(), grant('2026-03-04T11:00:00Z'), completion],
          }),
        ),
      ).toThrow(
        'No valid NOR exists after applying NOR qualification requirements.',
      );
    });

    it('does not let WIFPON cure a pre-readiness NOR', () => {
      expect(() =>
        runLaytimeEngine(
          qualifiedInput({
            clauses: [
              laytimeRate,
              demurrageRate,
              despatch,
              wifpon('wifpon-loading', true, 'Loading'),
            ],
            norDocuments: [
              { id: 'early-nor', tenderTime: new Date('2026-03-04T08:00:00Z') },
            ],
            sofEvents: [ready(), grant('2026-03-04T07:00:00Z'), completion],
          }),
        ),
      ).toThrow(
        'No valid NOR exists after applying NOR qualification requirements.',
      );
    });

    it('preserves legacy results when grant evidence and WIFPON are missing', () => {
      const baseline = runLaytimeEngine(buildInput());
      const result = runLaytimeEngine(qualifiedInput());

      expect(result.commencement.freePratique).toEqual(
        expect.objectContaining({
          status: 'unavailable',
          valid: null,
          wifponClauseId: null,
          wifponEnabled: false,
          wifponApplied: false,
        }),
      );
      expect(result.warnings).toContain(
        'Free-pratique qualification was not evaluated because grant evidence and an applicable WIFPON clause are missing.',
      );
      expect(baseline.commencement.commencedAt).toEqual(
        new Date('2026-03-04T06:00:00Z'),
      );
    });

    it('retains explicit WIFPON false without inferring missing grant as invalid', () => {
      const result = runLaytimeEngine(
        qualifiedInput({
          clauses: [
            laytimeRate,
            demurrageRate,
            despatch,
            wifpon('wifpon-disabled', false, 'Loading'),
          ],
        }),
      );

      expect(result.commencement.freePratique).toEqual(
        expect.objectContaining({
          status: 'unavailable',
          valid: null,
          wifponClauseId: 'wifpon-disabled',
          wifponEnabled: false,
          wifponApplied: false,
        }),
      );
    });

    it.each(['Loading', 'Discharge'] as const)(
      'uses %s-specific WIFPON and free-pratique evidence',
      (operation) => {
        const opposite = operation === 'Loading' ? 'Discharge' : 'Loading';
        const result = runLaytimeEngine(
          qualifiedInput({
            operation,
            clauses: [
              laytimeRate,
              demurrageRate,
              despatch,
              wifpon('wifpon-global', true),
              wifpon(`wifpon-${operation.toLowerCase()}`, false, operation),
              wifpon(`wifpon-${opposite.toLowerCase()}`, true, opposite),
            ],
            sofEvents: [
              ready(operation),
              grant('2026-03-04T09:00:00Z', null, 'grant-null'),
              grant('2026-03-04T09:30:00Z', operation, 'grant-matching'),
              grant('2026-03-04T08:00:00Z', opposite, 'grant-opposite'),
              completion,
            ],
          }),
        );

        expect(result.commencement.freePratique).toEqual(
          expect.objectContaining({
            eventId: 'grant-matching',
            source: 'operation-specific',
            wifponClauseId: `wifpon-${operation.toLowerCase()}`,
            wifponEnabled: false,
          }),
        );
      },
    );

    it('uses global WIFPON and null grant fallbacks when matching evidence is absent', () => {
      const result = runLaytimeEngine(
        qualifiedInput({
          clauses: [
            laytimeRate,
            demurrageRate,
            despatch,
            wifpon('wifpon-global', true),
          ],
          sofEvents: [
            ready(),
            grant('2026-03-04T12:00:00Z', null, 'grant-null'),
            completion,
          ],
        }),
      );

      expect(result.commencement.freePratique).toEqual(
        expect.objectContaining({
          eventId: 'grant-null',
          source: 'legacy-null',
          wifponClauseId: 'wifpon-global',
          status: 'waived-by-wifpon',
        }),
      );
    });
  });

  describe('NOR commencement rule integration', () => {
    const laytimeWithoutNotice: EngineClause = {
      ...laytimeRate,
      parameters: { rate: 10_000, unit: 'MT' },
    };
    const scheduleClause = (
      parameters: Record<string, unknown> = {},
    ): EngineClause => ({
      id: 'nor-office-schedule',
      clauseType: 'nor_commencement_schedule',
      parameters: {
        cutoffReference: 'tenderTime',
        tenderCutoffTime: '12:00',
        sameDayCommencementTime: '13:00',
        nextWorkingDayCommencementTime: '08:00',
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        timeZone: 'UTC',
        ...parameters,
      },
    });

    it.each([
      ['noticeHours', 12],
      ['notice_hours', 8],
      ['turnTimeHours', 4],
    ] as const)('preserves explicit %s commencement', (source, hours) => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            {
              ...laytimeWithoutNotice,
              parameters: { hours: 48, [source]: hours },
            },
            demurrageRate,
            despatch,
          ],
          sofEvents: [
            { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
            {
              eventTime: new Date('2026-03-07T00:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.commencement).toEqual(
        expect.objectContaining({
          commencementRule: 'notice-hours',
          noticeHours: hours,
          noticeSource: source,
          commencedAt: new Date(NOR_TENDERED.getTime() + hours * 3_600_000),
          scheduleClauseId: null,
        }),
      );
    });

    it('preserves the legacy six-hour default without a schedule', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [laytimeWithoutNotice, demurrageRate, despatch],
        }),
      );

      expect(result.commencement).toEqual(
        expect.objectContaining({
          commencementRule: 'notice-hours',
          noticeHours: 6,
          noticeSource: 'default',
          commencedAt: new Date('2026-03-04T06:00:00Z'),
        }),
      );
    });

    it.each([
      [
        'before cutoff',
        '2026-03-02T11:59:59Z',
        '2026-03-02T13:00:00Z',
        'same-day',
      ],
      [
        'at cutoff',
        '2026-03-02T12:00:00Z',
        '2026-03-03T08:00:00Z',
        'next-working-day',
      ],
      [
        'after cutoff',
        '2026-03-02T12:00:01Z',
        '2026-03-03T08:00:00Z',
        'next-working-day',
      ],
      [
        'non-working Saturday',
        '2026-03-07T10:00:00Z',
        '2026-03-09T08:00:00Z',
        'next-working-day',
      ],
    ] as const)(
      'applies the office schedule %s without the six-hour default',
      (_case, effectiveNorTime, expected, scheduleBasis) => {
        const result = runLaytimeEngine(
          buildInput({
            clauses: [
              laytimeWithoutNotice,
              demurrageRate,
              despatch,
              scheduleClause(),
            ],
            norDocuments: [
              {
                id: 'scheduled-nor',
                tenderTime: new Date(effectiveNorTime),
                acceptedTime: new Date(effectiveNorTime),
              },
            ],
            sofEvents: [
              {
                eventTime: new Date('2026-03-12T00:00:00Z'),
                eventType: 'CARGO_COMPLETED',
              },
            ],
          }),
        );

        expect(result.commencedAt).toEqual(new Date(expected));
        expect(result.commencement).toEqual(
          expect.objectContaining({
            commencementRule: 'office-schedule',
            noticeHours: null,
            noticeSource: null,
            scheduleClauseId: 'nor-office-schedule',
            scheduleBasis,
            scheduleTimeZone: 'UTC',
            scheduleCutoffReference: 'tenderTime',
            scheduleGoverningTime: new Date(effectiveNorTime),
          }),
        );
      },
    );

    it('uses the explicitly selected NOR timestamp for the cutoff decision', () => {
      const input = {
        clauses: [laytimeWithoutNotice, demurrageRate, despatch],
        norDocuments: [
          {
            id: 'scheduled-nor',
            tenderTime: new Date('2026-03-02T11:30:00Z'),
            acceptedTime: new Date('2026-03-02T12:30:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-12T00:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      };

      const tenderReference = runLaytimeEngine(
        buildInput({
          ...input,
          clauses: [
            ...input.clauses,
            scheduleClause({ cutoffReference: 'tenderTime' }),
          ],
        }),
      );
      const acceptedReference = runLaytimeEngine(
        buildInput({
          ...input,
          clauses: [
            ...input.clauses,
            scheduleClause({ cutoffReference: 'acceptedTime' }),
          ],
        }),
      );

      expect(tenderReference.commencement).toEqual(
        expect.objectContaining({
          scheduleBasis: 'same-day',
          scheduleCutoffReference: 'tenderTime',
          scheduleGoverningTime: new Date('2026-03-02T11:30:00Z'),
          commencedAt: new Date('2026-03-02T13:00:00Z'),
        }),
      );
      expect(acceptedReference.commencement).toEqual(
        expect.objectContaining({
          scheduleBasis: 'next-working-day',
          scheduleCutoffReference: 'acceptedTime',
          scheduleGoverningTime: new Date('2026-03-02T12:30:00Z'),
          commencedAt: new Date('2026-03-03T08:00:00Z'),
        }),
      );
    });

    it.each([
      ['before cutoff', '2026-03-02T11:30:00Z', '2026-03-02T13:00:00Z'],
      ['at cutoff', '2026-03-02T12:00:00Z', '2026-03-03T08:00:00Z'],
      ['after cutoff', '2026-03-02T12:30:00Z', '2026-03-03T08:00:00Z'],
    ] as const)(
      'uses acceptedTime %s when it is the cutoff reference',
      (_case, acceptedTime, expected) => {
        const result = runLaytimeEngine(
          buildInput({
            clauses: [
              laytimeWithoutNotice,
              demurrageRate,
              despatch,
              scheduleClause({ cutoffReference: 'acceptedTime' }),
            ],
            norDocuments: [
              {
                id: 'scheduled-nor',
                tenderTime: new Date('2026-03-02T11:00:00Z'),
                acceptedTime: new Date(acceptedTime),
              },
            ],
            sofEvents: [
              {
                eventTime: new Date('2026-03-12T00:00:00Z'),
                eventType: 'CARGO_COMPLETED',
              },
            ],
          }),
        );

        expect(result.commencedAt).toEqual(new Date(expected));
        expect(result.commencement.scheduleGoverningTime).toEqual(
          new Date(acceptedTime),
        );
      },
    );

    it('rejects acceptedTime cutoff reference when the selected NOR has no acceptance', () => {
      expect(() =>
        runLaytimeEngine(
          buildInput({
            clauses: [
              laytimeWithoutNotice,
              demurrageRate,
              despatch,
              scheduleClause({ cutoffReference: 'acceptedTime' }),
            ],
            norDocuments: [
              {
                id: 'scheduled-nor',
                tenderTime: new Date('2026-03-02T11:00:00Z'),
              },
            ],
          }),
        ),
      ).toThrow('requires an acceptedTime');
    });

    it('respects custom working days and the contractual timezone', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            laytimeWithoutNotice,
            demurrageRate,
            despatch,
            scheduleClause({
              workingDays: ['THU'],
              timeZone: 'Australia/Sydney',
            }),
          ],
          norDocuments: [
            {
              tenderTime: new Date('2026-03-02T01:01:00Z'),
              acceptedTime: new Date('2026-03-02T01:01:00Z'),
            },
          ],
          sofEvents: [
            {
              eventTime: new Date('2026-03-06T12:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.commencedAt).toEqual(new Date('2026-03-04T21:00:00Z'));
      expect(result.commencement).toEqual(
        expect.objectContaining({
          scheduleTimeZone: 'Australia/Sydney',
          scheduleWorkingDays: ['THU'],
          scheduleSelectedWorkingDate: '2026-03-05',
        }),
      );
    });

    it.each(['noticeHours', 'notice_hours', 'turnTimeHours'] as const)(
      'fails for an office schedule combined with explicit %s',
      (source) => {
        expect(() =>
          runLaytimeEngine(
            buildInput({
              clauses: [
                {
                  ...laytimeWithoutNotice,
                  parameters: { hours: 48, [source]: 6 },
                },
                demurrageRate,
                despatch,
                scheduleClause(),
              ],
            }),
          ),
        ).toThrow('both explicit notice hours and a NOR commencement schedule');
      },
    );

    it('applies the schedule to the later authoritative readiness-valid NOR', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            laytimeWithoutNotice,
            demurrageRate,
            despatch,
            scheduleClause({ cutoffReference: 'acceptedTime' }),
          ],
          norDocuments: [
            { id: 'invalid-nor', tenderTime: new Date('2026-03-02T09:00:00Z') },
            {
              id: 'valid-nor',
              tenderTime: new Date('2026-03-02T11:00:00Z'),
              acceptedTime: new Date('2026-03-02T11:30:00Z'),
            },
          ],
          sofEvents: [
            {
              id: 'ready',
              eventType: 'VESSEL_READY_IN_ALL_RESPECTS',
              eventTime: new Date('2026-03-02T10:00:00Z'),
              operation: 'Loading',
            },
            {
              eventType: 'CARGO_COMPLETED',
              eventTime: new Date('2026-03-05T00:00:00Z'),
            },
          ],
        }),
      );

      expect(result.commencement).toEqual(
        expect.objectContaining({
          norDocumentId: 'valid-nor',
          validityBasis: 'accepted',
          baseTime: new Date('2026-03-02T11:30:00Z'),
          scheduleLocalNorTime: '11:30:00',
          commencedAt: new Date('2026-03-02T13:00:00Z'),
        }),
      );
    });

    it('preserves legacy effective-time cutoff behavior with an explicit warning', () => {
      const legacySchedule = scheduleClause();
      delete legacySchedule.parameters.cutoffReference;

      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            laytimeWithoutNotice,
            demurrageRate,
            despatch,
            legacySchedule,
          ],
          norDocuments: [
            {
              id: 'legacy-nor',
              tenderTime: new Date('2026-03-02T11:30:00Z'),
              acceptedTime: new Date('2026-03-02T12:30:00Z'),
            },
          ],
          sofEvents: [
            {
              eventTime: new Date('2026-03-12T00:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.commencement).toEqual(
        expect.objectContaining({
          scheduleBasis: 'next-working-day',
          scheduleCutoffReference: 'legacy-effectiveTime',
          scheduleGoverningTime: new Date('2026-03-02T12:30:00Z'),
          scheduleLegacyCompatibilityUsed: true,
          commencedAt: new Date('2026-03-03T08:00:00Z'),
        }),
      );
      expect(result.warnings).toContain(
        'NOR commencement schedule has no cutoffReference; legacy effective-time cutoff behavior was preserved.',
      );
    });

    it('fails clearly for incomplete legacy schedule data', () => {
      expect(() =>
        runLaytimeEngine(
          buildInput({
            clauses: [
              laytimeWithoutNotice,
              demurrageRate,
              despatch,
              {
                id: 'legacy-schedule',
                clauseType: 'nor_commencement_schedule',
                parameters: { tenderCutoffTime: '12:00' },
              },
            ],
          }),
        ),
      ).toThrow('schedule is incomplete and cannot be applied safely');
    });
  });

  it('prices demurrage on the time counted beyond the allowed laytime', () => {
    const result = runLaytimeEngine(
      buildInput({
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            // Half a day past the 2-day allowance.
            eventTime: new Date('2026-03-06T18:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 12:00:00');
    expect(result.demurrageAmount).toBe(6000); // 0.5 days x 12 000
    expect(result.despatchAmount).toBe(0);
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'demurrage',
    ]);
  });

  it('pays despatch at half the demurrage rate when laytime is saved', () => {
    const result = runLaytimeEngine(
      buildInput({
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            // A full day inside the 2-day allowance.
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.demurrageAmount).toBe(0);
    expect(result.despatchAmount).toBe(6000); // 1 day x (12 000 / 2)
    expect(result.warnings).toContain(
      'The despatch clause has no rate; half the demurrage rate was applied.',
    );
  });

  it('uses an explicit despatch rate when laytime is saved', () => {
    const explicitDespatch: EngineClause = {
      id: 'clause-despatch-explicit-rate',
      clauseType: 'despatch',
      parameters: { rate: 4_000 },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, explicitDespatch],
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.despatchAmount).toBe(4000); // 1 saved day x 4,000/day
    expect(result.warnings).not.toContain(
      'The despatch clause has no rate; half the demurrage rate was applied.',
    );
  });

  it('audits explicit all-time-saved without changing the despatch result', () => {
    const explicitAllTimeSaved: EngineClause = {
      ...despatch,
      parameters: { ...despatch.parameters, timeBasis: 'all_time_saved' },
    };
    const input = buildInput({
      sofEvents: [
        { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
        {
          eventTime: new Date('2026-03-05T06:00:00Z'),
          eventType: 'CARGO_COMPLETED',
        },
      ],
    });
    const baseline = runLaytimeEngine(input);
    const result = runLaytimeEngine({
      ...input,
      clauses: [laytimeRate, demurrageRate, explicitAllTimeSaved],
    });

    expect(result.despatchTimeBasis).toEqual({
      requestedTimeBasis: 'all_time_saved',
      effectiveTimeBasis: 'all_time_saved',
      source: 'explicit',
      workingTimeSavedSeconds: 86_400,
      selectedSavedSeconds: 86_400,
      theoreticalExpiry: new Date('2026-03-06T06:00:00Z'),
      projectedExceptedIntervals: [],
    });
    expect(result.despatchAmount).toBe(baseline.despatchAmount);
  });

  it('recognizes working-time-saved without applying different despatch math', () => {
    const explicitWorkingTimeSaved: EngineClause = {
      ...despatch,
      parameters: { ...despatch.parameters, timeBasis: 'working_time_saved' },
    };
    const input = buildInput({
      sofEvents: [
        { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
        {
          eventTime: new Date('2026-03-05T06:00:00Z'),
          eventType: 'CARGO_COMPLETED',
        },
      ],
    });
    const baseline = runLaytimeEngine(input);
    const result = runLaytimeEngine({
      ...input,
      clauses: [laytimeRate, demurrageRate, explicitWorkingTimeSaved],
    });

    expect(result.despatchTimeBasis).toEqual({
      requestedTimeBasis: 'working_time_saved',
      effectiveTimeBasis: 'working_time_saved',
      source: 'explicit',
      workingTimeSavedSeconds: 86_400,
      selectedSavedSeconds: 86_400,
      theoreticalExpiry: null,
      projectedExceptedIntervals: [],
    });
    expect(result.despatchAmount).toBe(baseline.despatchAmount);
  });

  it('defaults legacy despatch clauses to all-time-saved in the audit', () => {
    const result = runLaytimeEngine(buildInput());

    expect(result.despatchTimeBasis).toEqual({
      requestedTimeBasis: null,
      effectiveTimeBasis: 'all_time_saved',
      source: 'legacy-default',
      workingTimeSavedSeconds: 0,
      selectedSavedSeconds: 0,
      theoreticalExpiry: new Date('2026-03-06T06:00:00Z'),
      projectedExceptedIntervals: [],
    });
  });

  describe('despatch time-basis semantics', () => {
    const completion = new Date('2026-03-07T18:00:00Z');
    const fixedFortyEightHours: EngineClause = {
      id: 'clause-laytime-48-hours',
      clauseType: 'laytime_rate',
      parameters: { hours: 48, noticeHours: 6 },
    };
    const workingTimeSavedDespatch: EngineClause = {
      ...despatch,
      parameters: {
        ...despatch.parameters,
        timeBasis: 'working_time_saved',
      },
    };

    it('defines working-time-saved as the unused countable laytime allowance', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            fixedFortyEightHours,
            demurrageRate,
            workingTimeSavedDespatch,
          ],
          norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
          sofEvents: [{ eventTime: completion, eventType: 'CARGO_COMPLETED' }],
        }),
      );
      const savedSeconds = Math.max(
        result.allowedSeconds - result.usedSeconds,
        0,
      );

      expect(result.allowedSeconds).toBe(48 * 60 * 60);
      expect(result.usedSeconds).toBe(36 * 60 * 60);
      expect(savedSeconds).toBe(12 * 60 * 60);
    });

    it('locks the future SHEX projection contract for all-time-saved', () => {
      const allTimeSavedDespatch: EngineClause = {
        ...despatch,
        parameters: { ...despatch.parameters, timeBasis: 'all_time_saved' },
      };
      const commonInput = {
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [{ eventTime: completion, eventType: 'CARGO_COMPLETED' }],
      };
      const workingResult = runLaytimeEngine(
        buildInput({
          ...commonInput,
          clauses: [
            fixedFortyEightHours,
            demurrageRate,
            workingTimeSavedDespatch,
            shexEnabled,
          ],
        }),
      );
      const allTimeResult = runLaytimeEngine(
        buildInput({
          ...commonInput,
          clauses: [
            fixedFortyEightHours,
            demurrageRate,
            allTimeSavedDespatch,
            shexEnabled,
          ],
        }),
      );

      expect(workingResult.despatchTimeBasis).toEqual({
        requestedTimeBasis: 'working_time_saved',
        effectiveTimeBasis: 'working_time_saved',
        source: 'explicit',
        workingTimeSavedSeconds: 12 * 60 * 60,
        selectedSavedSeconds: 12 * 60 * 60,
        theoreticalExpiry: null,
        projectedExceptedIntervals: [],
      });
      expect(allTimeResult.despatchTimeBasis).toEqual({
        requestedTimeBasis: 'all_time_saved',
        effectiveTimeBasis: 'all_time_saved',
        source: 'explicit',
        workingTimeSavedSeconds: 12 * 60 * 60,
        selectedSavedSeconds: 36 * 60 * 60,
        theoreticalExpiry: new Date('2026-03-09T06:00:00Z'),
        projectedExceptedIntervals: [
          {
            startTime: new Date('2026-03-08T00:00:00Z'),
            endTime: new Date('2026-03-09T00:00:00Z'),
            localDate: '2026-03-08',
            reasons: ['sunday'],
          },
        ],
      });
      expect(workingResult.despatchAmount).toBe(3_000);
      expect(allTimeResult.despatchAmount).toBe(9_000);
    });

    it('defines SHINC all-time-saved and working-time-saved as equal', () => {
      const allTimeSavedDespatch: EngineClause = {
        ...despatch,
        parameters: { ...despatch.parameters, timeBasis: 'all_time_saved' },
      };
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            fixedFortyEightHours,
            demurrageRate,
            allTimeSavedDespatch,
            shinc,
          ],
          norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
          sofEvents: [{ eventTime: completion, eventType: 'CARGO_COMPLETED' }],
        }),
      );
      const workingTimeSavedSeconds = Math.max(
        result.allowedSeconds - result.usedSeconds,
        0,
      );
      const expectedAllTimeSavedSeconds = 12 * 60 * 60;

      expect(workingTimeSavedSeconds).toBe(12 * 60 * 60);
      expect(expectedAllTimeSavedSeconds).toBe(workingTimeSavedSeconds);
      expect(result.despatchTimeBasis.effectiveTimeBasis).toBe(
        'all_time_saved',
      );
      expect(result.despatchTimeBasis.selectedSavedSeconds).toBe(
        workingTimeSavedSeconds,
      );
      const workingResult = runLaytimeEngine(
        buildInput({
          clauses: [
            fixedFortyEightHours,
            demurrageRate,
            workingTimeSavedDespatch,
            shinc,
          ],
          norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
          sofEvents: [{ eventTime: completion, eventType: 'CARGO_COMPLETED' }],
        }),
      );
      expect(result.despatchAmount).toBe(workingResult.despatchAmount);
    });

    it.each([
      ['explicit rate', { rate: 6_000 }],
      ['multiplier', { multiplier: 0.5 }],
      ['half-demurrage fallback', {}],
    ])(
      'prices both SHEX bases using the existing %s behavior',
      (_rateMode, rateParameters) => {
        const runForBasis = (
          timeBasis: 'all_time_saved' | 'working_time_saved',
        ) =>
          runLaytimeEngine(
            buildInput({
              clauses: [
                fixedFortyEightHours,
                demurrageRate,
                {
                  id: `despatch-${timeBasis}`,
                  clauseType: 'despatch',
                  parameters: { ...rateParameters, timeBasis },
                },
                shexEnabled,
              ],
              norDocuments: [
                { tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR },
              ],
              sofEvents: [
                { eventTime: completion, eventType: 'CARGO_COMPLETED' },
              ],
            }),
          );

        expect(runForBasis('working_time_saved').despatchAmount).toBe(3_000);
        expect(runForBasis('all_time_saved').despatchAmount).toBe(9_000);
      },
    );

    it('prices a legacy despatch clause using corrected all-time-saved', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            fixedFortyEightHours,
            demurrageRate,
            { ...despatch, parameters: { rate: 6_000 } },
            shexEnabled,
          ],
          norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
          sofEvents: [{ eventTime: completion, eventType: 'CARGO_COMPLETED' }],
        }),
      );

      expect(result.despatchTimeBasis).toEqual(
        expect.objectContaining({
          requestedTimeBasis: null,
          effectiveTimeBasis: 'all_time_saved',
          selectedSavedSeconds: 36 * 60 * 60,
        }),
      );
      expect(result.despatchAmount).toBe(9_000);
    });

    it('lets ATUTC change historical remaining working time without projecting post-completion evidence', () => {
      const clauses = [
        extendedLaytimeRate,
        demurrageRate,
        workingTimeSavedDespatch,
        shexEnabled,
      ];
      const sofEvents = [
        { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
        { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
        { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        // Future weather and stoppage evidence is outside the completed calculation.
        {
          eventTime: new Date('2026-03-09T08:00:00Z'),
          eventType: 'RAIN_STOPPAGE',
        },
        {
          eventTime: new Date('2026-03-09T10:00:00Z'),
          eventType: 'WORK_STOPPED',
        },
      ];
      const withoutAtutc = runLaytimeEngine(
        buildInput({
          clauses,
          norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
          sofEvents,
        }),
      );
      const withAtutc = runLaytimeEngine(
        buildInput({
          clauses: [...clauses, atutcEnabled],
          norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
          sofEvents,
        }),
      );

      const remainingWithoutAtutc =
        withoutAtutc.allowedSeconds - withoutAtutc.usedSeconds;
      const remainingWithAtutc =
        withAtutc.allowedSeconds - withAtutc.usedSeconds;

      expect(withAtutc.atutc.restoredSeconds).toBe(16 * 60 * 60);
      expect(withAtutc.usedSeconds - withoutAtutc.usedSeconds).toBe(
        16 * 60 * 60,
      );
      expect(remainingWithoutAtutc - remainingWithAtutc).toBe(16 * 60 * 60);
      expect(withAtutc.completedAt).toEqual(MONDAY_06);
      expect(
        withAtutc.periods.every(
          (period) => period.endTime.getTime() <= MONDAY_06.getTime(),
        ),
      ).toBe(true);
    });
  });

  it.each([
    [0.5, 6_000],
    [0.25, 3_000],
    [0, 0],
  ])('honours despatch.multiplier of %s', (multiplier, expectedDespatch) => {
    const multiplierDespatch: EngineClause = {
      id: `clause-despatch-multiplier-${multiplier}`,
      clauseType: 'despatch',
      parameters: { multiplier },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, multiplierDespatch],
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.despatchAmount).toBe(expectedDespatch);
  });

  it('suspends the clock for non-weather stoppages recorded in the SOF', () => {
    const result = runLaytimeEngine(
      buildInput({
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'BREAKDOWN',
          },
          {
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'BREAKDOWN_REPAIRED',
          },
          {
            eventTime: new Date('2026-03-06T18:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    // 2.5 days elapsed less the 12-hour stoppage leaves exactly the 2-day allowance.
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.demurrageAmount).toBe(0);
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('deducts weather stoppages before demurrage when WWD is enabled', () => {
    const weatherWorking: EngineClause = {
      id: 'clause-weather-working',
      clauseType: 'weather_working',
      parameters: { enabled: true },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, weatherWorking],
        sofEvents: [
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe(
      '0 days 12:00:00',
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('1 days 12:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('counts the same rain interval as laytime when WWD is absent', () => {
    const result = runLaytimeEngine(
      buildInput({
        sofEvents: [
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe(
      '0 days 00:00:00',
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(
      result.periods.every((period) => period.periodType !== 'exception'),
    ).toBe(true);
  });

  it('unions overlapping weather and generic stoppage evidence once', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, weatherWorking],
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-04T12:00:00Z'),
            eventType: 'BREAKDOWN',
          },
          {
            eventTime: new Date('2026-03-04T16:00:00Z'),
            eventType: 'BREAKDOWN_REPAIRED',
          },
          {
            eventTime: new Date('2026-03-04T14:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-04T18:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-05T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(secondsToInterval(result.usedSeconds)).toBe('0 days 18:00:00');
    expect(result.periods).toContainEqual(
      expect.objectContaining({
        periodType: 'exception',
        exceptionKinds: ['generic', 'weather'],
      }),
    );
    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe(
      '0 days 04:00:00',
    );
  });

  it('restores actual work inside a generic exception when ATUTC applies', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          {
            id: 'clause-laytime-sixteen',
            clauseType: 'laytime_rate',
            parameters: { hours: 16, noticeHours: 6 },
          },
          demurrageRate,
          despatch,
          atutcEnabled,
        ],
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-04T14:00:00Z'),
            eventType: 'BREAKDOWN',
          },
          {
            eventTime: new Date('2026-03-04T16:00:00Z'),
            eventType: 'CARGO_STARTED',
          },
          {
            eventTime: new Date('2026-03-04T18:00:00Z'),
            eventType: 'BREAKDOWN_REPAIRED',
          },
          {
            eventTime: new Date('2026-03-04T20:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.atutc.restoredSeconds).toBe(2 * 3600);
    expect(secondsToInterval(result.usedSeconds)).toBe('0 days 12:00:00');
    expect(result.periods).toContainEqual(
      expect.objectContaining({ periodType: 'exception' }),
    );
  });

  it('counts the same rain interval as laytime when WWD is disabled', () => {
    const weatherWorking: EngineClause = {
      id: 'clause-weather-working-disabled',
      clauseType: 'weather_working',
      parameters: { enabled: false },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, weatherWorking],
        sofEvents: [
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe(
      '0 days 00:00:00',
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(
      result.periods.every((period) => period.periodType !== 'exception'),
    ).toBe(true);
  });

  it('counts rain continuously after demurrage begins even when WWD is enabled', () => {
    const weatherWorking: EngineClause = {
      id: 'clause-weather-working',
      clauseType: 'weather_working',
      parameters: { enabled: true },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          {
            id: 'clause-laytime-fixed',
            clauseType: 'laytime_rate',
            parameters: { hours: 6, noticeHours: 6 },
          },
          demurrageRate,
          despatch,
          weatherWorking,
        ],
        norDocuments: [
          {
            tenderTime: new Date('2026-03-04T00:00:00Z'),
            acceptedTime: new Date('2026-03-04T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-04T12:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-04T18:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.demurrageStartedAt?.toISOString()).toBe(
      '2026-03-04T12:00:00.000Z',
    );
    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe(
      '0 days 00:00:00',
    );
    expect(
      result.periods.every((period) => period.periodType !== 'exception'),
    ).toBe(true);
    expect(
      result.periods.some((period) => period.periodType === 'demurrage'),
    ).toBe(true);
  });

  it('counts Sunday as demurrage once the allowance is exhausted before Sunday', () => {
    const shex: EngineClause = {
      id: 'clause-shex',
      clauseType: 'shex_shinc',
      parameters: { shex: true },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          {
            id: 'clause-laytime-fixed',
            clauseType: 'laytime_rate',
            parameters: { hours: 30, noticeHours: 6 },
          },
          demurrageRate,
          despatch,
          shex,
        ],
        norDocuments: [
          {
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-09T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.demurrageStartedAt?.toISOString()).toBe(
      '2026-03-07T12:00:00.000Z',
    );
    expect(result.ignoredExceptions).toEqual([
      {
        startTime: new Date('2026-03-08T00:00:00Z'),
        endTime: new Date('2026-03-09T00:00:00Z'),
        appliedClauseId: 'clause-shex',
        calendarDates: [{ localDate: '2026-03-08', reasons: ['sunday'] }],
      },
    ]);
    expect(result.periods[0]).toEqual({
      startTime: new Date('2026-03-06T06:00:00Z'),
      endTime: new Date('2026-03-07T12:00:00Z'),
      periodType: 'laytime',
      appliedClauseId: null,
    });
    expect(
      result.periods
        .slice(1)
        .every((period) => period.periodType === 'demurrage'),
    ).toBe(true);
    expect(
      result.periods.find(
        (period) =>
          period.startTime.toISOString() === '2026-03-08T00:00:00.000Z',
      ),
    ).toEqual(
      expect.objectContaining({
        periodType: 'demurrage',
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('3 days 00:00:00');
  });

  it('keeps pre-demurrage rain deductible and counts post-demurrage rain continuously', () => {
    const rainResult = runLaytimeEngine(
      buildInput({
        clauses: [
          {
            id: 'clause-laytime-fixed',
            clauseType: 'laytime_rate',
            parameters: { hours: 12, noticeHours: 6 },
          },
          demurrageRate,
          despatch,
          {
            id: 'clause-weather-working',
            clauseType: 'weather_working',
            parameters: { enabled: true },
          },
        ],
        norDocuments: [
          {
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-06T12:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-06T18:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-07T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-07T06:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-07T12:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(rainResult.demurrageStartedAt?.toISOString()).toBe(
      '2026-03-07T00:00:00.000Z',
    );
    expect(rainResult.ignoredExceptions).toEqual([
      {
        startTime: new Date('2026-03-07T00:00:00Z'),
        endTime: new Date('2026-03-07T06:00:00Z'),
        appliedClauseId: null,
      },
    ]);
    expect(rainResult.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
      'demurrage',
      'demurrage',
    ]);
    expect(secondsToInterval(rainResult.usedSeconds)).toBe('1 days 00:00:00');
  });

  it('starts demurrage at the boundary of a later stoppage and counts that stoppage continuously', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          {
            id: 'clause-laytime-fixed',
            clauseType: 'laytime_rate',
            parameters: { hours: 18, noticeHours: 6 },
          },
          demurrageRate,
          despatch,
          {
            id: 'clause-weather-working',
            clauseType: 'weather_working',
            parameters: { enabled: true },
          },
        ],
        norDocuments: [
          {
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-07T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-07T12:00:00Z'),
            eventType: 'RAIN_STOPPED',
          },
          {
            eventTime: new Date('2026-03-07T18:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(result.demurrageStartedAt?.toISOString()).toBe(
      '2026-03-07T00:00:00.000Z',
    );
    expect(result.ignoredExceptions).toEqual([
      {
        startTime: new Date('2026-03-07T00:00:00Z'),
        endTime: new Date('2026-03-07T12:00:00Z'),
        appliedClauseId: null,
      },
    ]);
    expect(result.periods).toEqual([
      {
        startTime: new Date('2026-03-06T06:00:00Z'),
        endTime: new Date('2026-03-07T00:00:00Z'),
        periodType: 'laytime',
        appliedClauseId: null,
      },
      {
        startTime: new Date('2026-03-07T00:00:00Z'),
        endTime: new Date('2026-03-07T12:00:00Z'),
        periodType: 'demurrage',
        appliedClauseId: null,
      },
      {
        startTime: new Date('2026-03-07T12:00:00Z'),
        endTime: new Date('2026-03-07T18:00:00Z'),
        periodType: 'demurrage',
        appliedClauseId: null,
      },
    ]);
  });

  it('excepts Sundays under a SHEX clause and attributes them to it', () => {
    const shex: EngineClause = {
      id: 'clause-shex',
      clauseType: 'shex_shinc',
      parameters: { shex: true },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, shex],
        // Friday tender, so the window spans Sunday the 8th.
        norDocuments: [
          {
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-09T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    const sunday = result.periods.find(
      (period) => period.periodType === 'exception',
    );
    expect(sunday).toBeDefined();
    expect(sunday?.appliedClauseId).toBe('clause-shex');
    expect(sunday?.startTime.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(sunday?.endTime.toISOString()).toBe('2026-03-09T00:00:00.000Z');
    // 3 days elapsed less the excepted Sunday = 2 days counted.
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
  });

  it('recognizes enabled WIBON without emitting an unsupported-clause warning', () => {
    const wibon: EngineClause = {
      id: 'clause-wibon',
      clauseType: 'wibon',
      parameters: { enabled: true },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, wibon],
      }),
    );

    expect(result.warnings).not.toContain(
      'Clause type "wibon" is not yet supported by the laytime engine and was ignored.',
    );
    expect(result.commencedAt.toISOString()).toBe('2026-03-04T06:00:00.000Z');
    expect(result.usedSeconds).toBe(172800);
  });

  it('recognizes enabled WIPON without emitting an unsupported-clause warning', () => {
    const wipon: EngineClause = {
      id: 'clause-wipon',
      clauseType: 'wipon',
      parameters: { enabled: true },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, wipon],
      }),
    );

    expect(result.warnings).not.toContain(
      'Clause type "wipon" is not yet supported by the laytime engine and was ignored.',
    );
    expect(result.commencedAt.toISOString()).toBe('2026-03-04T06:00:00.000Z');
    expect(result.usedSeconds).toBe(172800);
  });

  it('recognizes enabled ATUTC and exposes it in the audit output without applying it', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, atutcEnabled],
      }),
    );

    expect(result.warnings).not.toContain(
      'Clause type "atutc" is not yet supported by the laytime engine and was ignored.',
    );
    expect(result.atutc).toEqual(
      expect.objectContaining({
        clauseId: 'clause-atutc',
        enabled: true,
        applied: false,
        limitation:
          'ATUTC restores actual cargo-working time inside supported contractual exception periods before demurrage.',
      }),
    );
  });

  it('reports a disabled ATUTC clause without applying it', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, atutcDisabled],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        clauseId: 'clause-atutc-disabled',
        enabled: false,
        applied: false,
      }),
    );
  });

  it('reports ATUTC as disabled when no clause exists', () => {
    const result = runLaytimeEngine(buildInput());

    expect(result.atutc).toEqual(
      expect.objectContaining({
        clauseId: null,
        enabled: false,
        applied: false,
      }),
    );
  });

  it('keeps the same numerical result with or without ATUTC', () => {
    const baseline = runLaytimeEngine(buildInput());
    const withAtutc = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, atutcEnabled],
      }),
    );

    expect(withAtutc.usedSeconds).toBe(baseline.usedSeconds);
    expect(withAtutc.demurrageAmount).toBe(baseline.demurrageAmount);
    expect(withAtutc.despatchAmount).toBe(baseline.despatchAmount);
    expect(withAtutc.periods).toEqual(baseline.periods);
  });

  it('preserves the SHEX exclusion when ATUTC is absent', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [extendedLaytimeRate, demurrageRate, despatch, shexEnabled],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: false,
        applied: false,
        restoredSeconds: 0,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('preserves the SHEX exclusion when ATUTC is explicitly disabled', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcDisabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: false,
        applied: false,
        restoredSeconds: 0,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
  });

  it('leaves Sunday fully excluded when ATUTC is enabled but no Sunday work is present', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: MONDAY_00, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: false,
        restoredSeconds: 0,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('restores only the actual cargo-working overlap inside a partial Sunday SHEX period', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 57_600,
      }),
    );
    expect(result.atutc.restoredIntervals).toEqual([
      {
        startTime: SUNDAY_08,
        endTime: SUNDAY_END,
      },
    ]);
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 16:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('restores the entire Sunday work interval when cargo work spans the full SHEX day', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_00, eventType: 'CARGO_STARTED' },
          { eventTime: SUNDAY_END, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 86_400,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 18:00:00');
    expect(
      result.periods.every((period) => period.periodType === 'laytime'),
    ).toBe(true);
  });

  it('restores only the Sunday portion of a work interval that crosses into and out of Sunday', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SATURDAY_20, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 86_400,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('3 days 00:00:00');
    expect(
      result.periods.every((period) => period.periodType === 'laytime'),
    ).toBe(true);
  });

  it('restores actual weather-overlap work under ATUTC without deducting it twice', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          weatherWorking,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: SUNDAY_10, eventType: 'RAIN_STOPPAGE' },
          { eventTime: SUNDAY_12, eventType: 'RAIN_STOPPED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe(
      '0 days 00:00:00',
    );
    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 57_600,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 16:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('preserves generic and SHEX provenance around ATUTC-restored time', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: SUNDAY_10, eventType: 'BREAKDOWN' },
          { eventTime: SUNDAY_12, eventType: 'BREAKDOWN_REPAIRED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 7_200,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 02:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
      'exception',
      'exception',
      'laytime',
    ]);
  });

  it('leaves SHINC unaffected by ATUTC', () => {
    const baseline = runLaytimeEngine(
      buildInput({
        clauses: [extendedLaytimeRate, demurrageRate, despatch, shinc],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );
    const withAtutc = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shinc,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(withAtutc.usedSeconds).toBe(baseline.usedSeconds);
    expect(withAtutc.demurrageAmount).toBe(baseline.demurrageAmount);
    expect(withAtutc.despatchAmount).toBe(baseline.despatchAmount);
    expect(withAtutc.periods).toEqual(baseline.periods);
  });

  it('records the restored ATUTC overlap in the audit output', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          extendedLaytimeRate,
          demurrageRate,
          despatch,
          shexEnabled,
          atutcEnabled,
        ],
        norDocuments: [{ tenderTime: FRIDAY_NOR, acceptedTime: FRIDAY_NOR }],
        sofEvents: [
          { eventTime: FRIDAY_NOR, eventType: 'NOR_TENDERED' },
          { eventTime: SUNDAY_08, eventType: 'CARGO_STARTED' },
          { eventTime: MONDAY_06, eventType: 'CARGO_COMPLETED' },
        ],
      }),
    );

    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 57_600,
      }),
    );
    expect(result.atutc.restoredIntervals).toEqual([
      {
        startTime: SUNDAY_08,
        endTime: SUNDAY_END,
      },
    ]);
  });

  it('treats disabled WIPON as a recognized no-op', () => {
    const wipon: EngineClause = {
      id: 'clause-wipon-disabled',
      clauseType: 'wipon',
      parameters: { enabled: false },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, wipon],
      }),
    );

    expect(result.warnings).not.toContain(
      'Clause type "wipon" is not yet supported by the laytime engine and was ignored.',
    );
    expect(result.usedSeconds).toBe(172800);
  });

  it('treats disabled WIBON as a no-op', () => {
    const wibon: EngineClause = {
      id: 'clause-wibon-disabled',
      clauseType: 'wibon',
      parameters: { enabled: false },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, wibon],
      }),
    );

    expect(result.warnings).not.toContain(
      'Clause type "wibon" is not yet supported by the laytime engine and was ignored.',
    );
    expect(result.usedSeconds).toBe(172800);
  });

  it('counts continuously through Sunday when SHINC is explicit', () => {
    const shinc: EngineClause = {
      id: 'clause-shinc',
      clauseType: 'shex_shinc',
      parameters: { shex: false },
    };

    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch, shinc],
        norDocuments: [
          {
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-09T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(
      result.periods.every((period) => period.periodType !== 'exception'),
    ).toBe(true);
    expect(secondsToInterval(result.usedSeconds)).toBe('3 days 00:00:00');
    expect(result.demurrageAmount).toBe(12000);
  });

  it('preserves continuous counting when no SHEX clause exists', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [laytimeRate, demurrageRate, despatch],
        norDocuments: [
          {
            tenderTime: new Date('2026-03-06T00:00:00Z'),
            acceptedTime: new Date('2026-03-06T00:00:00Z'),
          },
        ],
        sofEvents: [
          {
            eventTime: new Date('2026-03-09T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(
      result.periods.every((period) => period.periodType !== 'exception'),
    ).toBe(true);
    expect(secondsToInterval(result.usedSeconds)).toBe('3 days 00:00:00');
  });

  it('reports clause types it does not understand instead of failing', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          laytimeRate,
          demurrageRate,
          despatch,
          {
            id: 'clause-unknown',
            clauseType: 'unsupported_clause',
            parameters: {},
          },
        ],
      }),
    );

    expect(result.warnings).toContain(
      'Clause type "unsupported_clause" is not yet supported by the laytime engine and was ignored.',
    );
  });

  it('falls back to the NOR_TENDERED event when no NOR document exists', () => {
    const result = runLaytimeEngine(buildInput({ norDocuments: [] }));

    expect(result.commencedAt.toISOString()).toBe('2026-03-04T06:00:00.000Z');
    expect(result.warnings).toContain(
      'No NOR document found; laytime commencement was derived from the NOR_TENDERED SOF event.',
    );
  });

  it('rejects a voyage with no notice of readiness at all', () => {
    expect(() =>
      runLaytimeEngine(
        buildInput({
          norDocuments: [],
          sofEvents: [
            {
              eventTime: new Date('2026-03-06T06:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      ),
    ).toThrow(LaytimeEngineError);
  });

  it('rejects a voyage whose SOF has no completion event', () => {
    expect(() =>
      runLaytimeEngine(
        buildInput({
          sofEvents: [{ eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' }],
        }),
      ),
    ).toThrow(LaytimeEngineError);
  });

  it('uses dry-bulk terminal evidence over generic cargo completion markers', () => {
    const result = runLaytimeEngine(
      buildInput({
        bulkOperationType: 'dry_bulk',
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
          {
            eventTime: new Date('2026-03-06T06:15:00Z'),
            eventType: 'CARGO_SECURED',
          },
          {
            eventTime: new Date('2026-03-06T06:30:00Z'),
            eventType: 'HATCHES_CLOSED',
          },
        ],
      }),
    );

    expect(result.completedAt.toISOString()).toBe('2026-03-06T06:30:00.000Z');
    expect(result.cargoCompletion).toEqual(
      expect.objectContaining({
        selectedEventId: expect.any(String),
        selectedEventType: 'HATCHES_CLOSED',
        selectionBasis: 'dry-bulk-hatches-closed',
        bulkOperationType: 'dry_bulk',
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:30:00');
    expect(result.warnings).not.toContain(
      'Dry-bulk completion evidence did not include HATCHES_CLOSED; CARGO_SECURED was used as the documented fallback terminal marker.',
    );
  });

  it('falls back to CARGO_SECURED for dry bulk when HATCHES_CLOSED is missing', () => {
    const result = runLaytimeEngine(
      buildInput({
        bulkOperationType: 'dry_bulk',
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
          {
            eventTime: new Date('2026-03-06T06:20:00Z'),
            eventType: 'CARGO_SECURED',
          },
        ],
      }),
    );

    expect(result.completedAt.toISOString()).toBe('2026-03-06T06:20:00.000Z');
    expect(result.cargoCompletion).toEqual(
      expect.objectContaining({
        selectedEventType: 'CARGO_SECURED',
        selectionBasis: 'dry-bulk-cargo-secured-fallback',
      }),
    );
    expect(result.warnings).toContain(
      'Dry-bulk completion evidence did not include HATCHES_CLOSED; CARGO_SECURED was used as the documented fallback terminal marker.',
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:20:00');
  });

  it('uses tanker terminal evidence over later generic completion markers', () => {
    const result = runLaytimeEngine(
      buildInput({
        bulkOperationType: 'tanker',
        operation: 'Discharge',
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'DISCHARGE_COMPLETED',
            operation: 'Discharge',
          },
          {
            eventTime: new Date('2026-03-06T06:30:00Z'),
            eventType: 'HOSES_DISCONNECTED',
            operation: 'Discharge',
          },
          {
            eventTime: new Date('2026-03-06T06:45:00Z'),
            eventType: 'CARGO_COMPLETED',
            operation: 'Discharge',
          },
        ],
      }),
    );

    expect(result.completedAt.toISOString()).toBe('2026-03-06T06:30:00.000Z');
    expect(result.cargoCompletion).toEqual(
      expect.objectContaining({
        selectedEventType: 'HOSES_DISCONNECTED',
        selectionBasis: 'tanker-hoses-disconnected',
        bulkOperationType: 'tanker',
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:30:00');
  });

  it('preserves legacy completion behavior when the voyage regime is unknown', () => {
    const result = runLaytimeEngine(
      buildInput({
        bulkOperationType: null,
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
          {
            eventTime: new Date('2026-03-06T06:30:00Z'),
            eventType: 'HATCHES_CLOSED',
          },
        ],
      }),
    );

    expect(result.completedAt.toISOString()).toBe('2026-03-06T06:00:00.000Z');
    expect(result.cargoCompletion.selectionBasis).toBe(
      'legacy-completion-fallback',
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.warnings).not.toContain(
      'Dry-bulk completion evidence did not include HATCHES_CLOSED; CARGO_SECURED was used as the documented fallback terminal marker.',
    );
  });

  it('rejects a charter party with no usable laytime rate', () => {
    expect(() =>
      runLaytimeEngine(buildInput({ clauses: [demurrageRate, despatch] })),
    ).toThrow(LaytimeEngineError);
  });

  it('treats an unclosed stoppage as running until completion', () => {
    const result = runLaytimeEngine(
      buildInput({
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'BREAKDOWN',
          },
          {
            eventTime: new Date('2026-03-06T06:00:00Z'),
            eventType: 'CARGO_COMPLETED',
          },
        ],
      }),
    );

    expect(secondsToInterval(result.usedSeconds)).toBe('0 days 18:00:00');
    expect(result.warnings).toContain(
      'A stoppage recorded in the SOF was never closed; it was treated as lasting until cargo completion.',
    );
  });

  describe('versioned SHEX contractual calendars', () => {
    const fixedAllowance: EngineClause = {
      id: 'calendar-laytime',
      clauseType: 'laytime_rate',
      parameters: { hours: 120, noticeHours: 0 },
    };
    const versionedShex = (
      parameters: Partial<Record<string, unknown>> = {},
    ): EngineClause => ({
      id: 'versioned-shex',
      clauseType: 'shex_shinc',
      parameters: {
        shex: true,
        calendarVersion: 1,
        timeZone: 'UTC',
        holidayDates: [],
        saturdayExcepted: false,
        ...parameters,
      },
    });

    it('excludes Sydney local Sunday without excluding local Monday', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            fixedAllowance,
            demurrageRate,
            despatch,
            versionedShex({ timeZone: 'Australia/Sydney' }),
          ],
          norDocuments: [
            {
              tenderTime: new Date('2026-07-04T12:00:00Z'),
              acceptedTime: new Date('2026-07-04T12:00:00Z'),
            },
          ],
          sofEvents: [
            {
              eventTime: new Date('2026-07-05T18:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.usedSeconds).toBe(6 * 60 * 60);
      expect(result.shexCalendar.generatedIntervals).toEqual([
        {
          startTime: new Date('2026-07-04T14:00:00Z'),
          endTime: new Date('2026-07-05T14:00:00Z'),
          localDate: '2026-07-05',
          reasons: ['sunday'],
        },
      ]);
      expect(result.periods.at(-1)).toEqual(
        expect.objectContaining({
          startTime: new Date('2026-07-05T14:00:00Z'),
          endTime: new Date('2026-07-05T18:00:00Z'),
          periodType: 'laytime',
        }),
      );
    });

    it('restores actual cargo work inside a contractual holiday under ATUTC', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            fixedAllowance,
            demurrageRate,
            despatch,
            versionedShex({ holidayDates: ['2026-12-25'] }),
            atutcEnabled,
          ],
          norDocuments: [
            {
              tenderTime: new Date('2026-12-24T18:00:00Z'),
              acceptedTime: new Date('2026-12-24T18:00:00Z'),
            },
          ],
          sofEvents: [
            {
              eventTime: new Date('2026-12-25T08:00:00Z'),
              eventType: 'CARGO_STARTED',
            },
            {
              eventTime: new Date('2026-12-25T12:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.usedSeconds).toBe(10 * 60 * 60);
      expect(result.atutc).toEqual(
        expect.objectContaining({
          applied: true,
          restoredSeconds: 4 * 60 * 60,
          restoredIntervals: [
            {
              startTime: new Date('2026-12-25T08:00:00Z'),
              endTime: new Date('2026-12-25T12:00:00Z'),
            },
          ],
        }),
      );
    });

    it('records a contractual holiday ignored after demurrage starts', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [
            {
              ...fixedAllowance,
              parameters: { hours: 6, noticeHours: 0 },
            },
            demurrageRate,
            despatch,
            versionedShex({ holidayDates: ['2026-12-25'] }),
          ],
          norDocuments: [
            {
              tenderTime: new Date('2026-12-24T12:00:00Z'),
              acceptedTime: new Date('2026-12-24T12:00:00Z'),
            },
          ],
          sofEvents: [
            {
              eventTime: new Date('2026-12-26T06:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.demurrageStartedAt).toEqual(
        new Date('2026-12-24T18:00:00Z'),
      );
      expect(result.ignoredExceptions).toContainEqual({
        startTime: new Date('2026-12-25T00:00:00Z'),
        endTime: new Date('2026-12-26T00:00:00Z'),
        appliedClauseId: 'versioned-shex',
        calendarDates: [
          {
            localDate: '2026-12-25',
            reasons: ['contractual-holiday'],
          },
        ],
      });
    });

    it('marks legacy SHEX and preserves its historical UTC result', () => {
      const result = runLaytimeEngine(
        buildInput({
          clauses: [fixedAllowance, demurrageRate, despatch, shexEnabled],
          norDocuments: [
            {
              tenderTime: new Date('2026-07-04T12:00:00Z'),
              acceptedTime: new Date('2026-07-04T12:00:00Z'),
            },
          ],
          sofEvents: [
            {
              eventTime: new Date('2026-07-05T18:00:00Z'),
              eventType: 'CARGO_COMPLETED',
            },
          ],
        }),
      );

      expect(result.usedSeconds).toBe(12 * 60 * 60);
      expect(result.shexCalendar).toEqual(
        expect.objectContaining({
          sourceType: 'legacy-utc-calendar',
          legacyCompatibilityUsed: true,
          timeZone: 'UTC',
        }),
      );
      expect(result.warnings).toContain(
        'A legacy SHEX clause used historical UTC Sunday/Saturday boundaries and no named holidays; upgrade the clause to calendarVersion 1 before editing it.',
      );
    });
  });
});
