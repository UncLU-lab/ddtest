export interface NorValidityInput {
  tenderTime: Date;
  acceptedTime?: Date | null;
  readinessTime: Date;
}
export interface NorValidityResult {
  valid: boolean;
  effectiveTime: Date | null;
  basis: 'accepted' | 'tendered-ready' | 'not-ready';
  warnings: string[];
}

/** Resolves NOR effectiveness from explicit readiness and acceptance evidence. */
export function resolveNorValidity(
  input: NorValidityInput,
): NorValidityResult {
  const tenderTime = new Date(input.tenderTime);
  const readinessTime = new Date(input.readinessTime);
  const acceptedTime = input.acceptedTime
    ? new Date(input.acceptedTime)
    : null;

  if (readinessTime.getTime() > tenderTime.getTime()) {
    return {
      valid: false,
      effectiveTime: null,
      basis: 'not-ready',
      warnings: [
        'NOR was tendered before vessel readiness and cannot become effective from that tender.',
      ],
    };
  }

  if (acceptedTime) {
    if (acceptedTime.getTime() < readinessTime.getTime()) {
      return {
        valid: false,
        effectiveTime: null,
        basis: 'not-ready',
        warnings: [
          'NOR acceptance predates vessel readiness and cannot make the NOR effective.',
        ],
      };
    }

    return {
      valid: true,
      effectiveTime: acceptedTime,
      basis: 'accepted',
      warnings: [],
    };
  }

  return {
    valid: true,
    effectiveTime: tenderTime,
    basis: 'tendered-ready',
    warnings: [],
  };
}
