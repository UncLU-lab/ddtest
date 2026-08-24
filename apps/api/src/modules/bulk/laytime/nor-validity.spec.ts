import { resolveNorValidity } from './nor-validity';

describe('resolveNorValidity', () => {
  const tenderTime = new Date('2026-03-04T06:00:00Z');

  it('treats NOR as valid when readiness precedes tender', () => {
    expect(
      resolveNorValidity({
        tenderTime,
        readinessTime: new Date('2026-03-04T05:00:00Z'),
      }),
    ).toEqual({
      valid: true,
      effectiveTime: tenderTime,
      basis: 'tendered-ready',
      warnings: [],
    });
  });

  it('treats NOR as valid when readiness is exactly at tender', () => {
    expect(
      resolveNorValidity({
        tenderTime,
        readinessTime: new Date(tenderTime),
      }),
    ).toEqual({
      valid: true,
      effectiveTime: tenderTime,
      basis: 'tendered-ready',
      warnings: [],
    });
  });

  it('rejects NOR tendered before readiness without moving tender forward', () => {
    expect(
      resolveNorValidity({
        tenderTime,
        readinessTime: new Date('2026-03-04T07:00:00Z'),
      }),
    ).toEqual({
      valid: false,
      effectiveTime: null,
      basis: 'not-ready',
      warnings: [
        'NOR was tendered before vessel readiness and cannot become effective from that tender.',
      ],
    });
  });

  it('does not let acceptance cure a NOR tendered before readiness', () => {
    expect(
      resolveNorValidity({
        tenderTime,
        readinessTime: new Date('2026-03-04T07:00:00Z'),
        acceptedTime: new Date('2026-03-04T08:00:00Z'),
      }),
    ).toEqual({
      valid: false,
      effectiveTime: null,
      basis: 'not-ready',
      warnings: [
        'NOR was tendered before vessel readiness and cannot become effective from that tender.',
      ],
    });
  });

  it('uses accepted basis when valid tender and acceptance follow readiness', () => {
    const acceptedTime = new Date('2026-03-04T08:00:00Z');

    expect(
      resolveNorValidity({
        tenderTime,
        readinessTime: new Date('2026-03-04T05:00:00Z'),
        acceptedTime,
      }),
    ).toEqual({
      valid: true,
      effectiveTime: acceptedTime,
      basis: 'accepted',
      warnings: [],
    });
  });

  it('does not mutate input dates or input data', () => {
    const input = {
      tenderTime: new Date('2026-03-04T06:00:00Z'),
      readinessTime: new Date('2026-03-04T05:00:00Z'),
      acceptedTime: new Date('2026-03-04T08:00:00Z'),
    };
    const values = {
      tenderTime: input.tenderTime.getTime(),
      readinessTime: input.readinessTime.getTime(),
      acceptedTime: input.acceptedTime.getTime(),
    };

    resolveNorValidity(input);

    expect(input.tenderTime.getTime()).toBe(values.tenderTime);
    expect(input.readinessTime.getTime()).toBe(values.readinessTime);
    expect(input.acceptedTime.getTime()).toBe(values.acceptedTime);
  });

  it('returns the same result for repeated calls', () => {
    const input = {
      tenderTime,
      readinessTime: new Date('2026-03-04T05:00:00Z'),
      acceptedTime: new Date('2026-03-04T08:00:00Z'),
    };

    expect(resolveNorValidity(input)).toEqual(resolveNorValidity(input));
  });
});
