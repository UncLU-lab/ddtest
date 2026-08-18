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
      const remainingWithAtutc = withAtutc.allowedSeconds - withAtutc.usedSeconds;

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

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe('0 days 12:00:00');
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

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe('0 days 00:00:00');
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.periods.every((period) => period.periodType !== 'exception')).toBe(
      true,
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

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe('0 days 00:00:00');
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 00:00:00');
    expect(result.periods.every((period) => period.periodType !== 'exception')).toBe(
      true,
    );
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
    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe('0 days 00:00:00');
    expect(result.periods.every((period) => period.periodType !== 'exception')).toBe(
      true,
    );
    expect(result.periods.some((period) => period.periodType === 'demurrage')).toBe(
      true,
    );
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
      },
    ]);
    expect(result.periods[0]).toEqual({
      startTime: new Date('2026-03-06T06:00:00Z'),
      endTime: new Date('2026-03-07T12:00:00Z'),
      periodType: 'laytime',
      appliedClauseId: null,
    });
    expect(result.periods.slice(1).every((period) => period.periodType === 'demurrage')).toBe(true);
    expect(
      result.periods.find(
        (period) => period.startTime.toISOString() === '2026-03-08T00:00:00.000Z',
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
    expect(secondsToInterval(rainResult.usedSeconds)).toBe(
      '1 days 00:00:00',
    );
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
          'ATUTC is applied only to SHEX-excepted periods in this engine version.',
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
    expect(result.periods.every((period) => period.periodType === 'laytime')).toBe(
      true,
    );
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
    expect(result.periods.every((period) => period.periodType === 'laytime')).toBe(
      true,
    );
  });

  it('keeps weather deductions separate from ATUTC-restored SHEX time', () => {
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

    expect(secondsToInterval(result.weatherDeductedSeconds)).toBe('0 days 02:00:00');
    expect(result.atutc).toEqual(
      expect.objectContaining({
        enabled: true,
        applied: true,
        restoredSeconds: 57_600,
      }),
    );
    expect(secondsToInterval(result.usedSeconds)).toBe('2 days 14:00:00');
    expect(result.periods.map((period) => period.periodType)).toEqual([
      'laytime',
      'exception',
      'laytime',
      'exception',
      'laytime',
    ]);
  });

  it('keeps generic stoppages separate from ATUTC-restored SHEX time', () => {
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

    expect(result.periods.every((period) => period.periodType !== 'exception')).toBe(true);
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

    expect(result.periods.every((period) => period.periodType !== 'exception')).toBe(true);
    expect(secondsToInterval(result.usedSeconds)).toBe('3 days 00:00:00');
  });

  it('reports clause types it does not understand instead of failing', () => {
    const result = runLaytimeEngine(
      buildInput({
        clauses: [
          laytimeRate,
          demurrageRate,
          despatch,
          { id: 'clause-wifpon', clauseType: 'wifpon', parameters: {} },
        ],
      }),
    );

    expect(result.warnings).toContain(
      'Clause type "wifpon" is not yet supported by the laytime engine and was ignored.',
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
