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

/** Wednesday, so the default window never crosses a weekend. */
const NOR_TENDERED = new Date('2026-03-04T00:00:00Z');

function buildInput(overrides: Partial<LaytimeEngineInput> = {}) {
  return {
    cargoQuantity: 20_000,
    clauses: [laytimeRate, demurrageRate, despatch],
    norDocuments: [{ tenderTime: NOR_TENDERED, acceptedTime: NOR_TENDERED }],
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

  it.each([
    [0.5, 6_000],
    [0.25, 3_000],
    [0, 0],
  ])(
    'honours despatch.multiplier of %s',
    (multiplier, expectedDespatch) => {
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
    },
  );

  it('suspends the clock for stoppages recorded in the SOF', () => {
    const result = runLaytimeEngine(
      buildInput({
        sofEvents: [
          { eventTime: NOR_TENDERED, eventType: 'NOR_TENDERED' },
          {
            eventTime: new Date('2026-03-05T00:00:00Z'),
            eventType: 'RAIN_STOPPAGE',
          },
          {
            eventTime: new Date('2026-03-05T12:00:00Z'),
            eventType: 'RAIN_STOPPED',
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

  it('reports clause types it does not understand instead of failing', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          laytimeRate,
          demurrageRate,
          despatch,
          { id: 'clause-wibon', clauseType: 'wibon', parameters: {} },
        ],
      }),
    );

    expect(result.warnings).toContain(
      'Clause type "wibon" is not yet supported by the laytime engine and was ignored.',
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
});
