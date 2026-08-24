import { resolveNorValidity } from './nor-validity';
import {
  type FreePratiqueEvidenceSelection,
  selectFreePratiqueEvidence,
} from './free-pratique-evidence';
import {
  type FreePratiqueQualificationResult,
  type SelectedWifponClause,
  resolveFreePratiqueQualification,
} from './free-pratique-qualification';
import {
  type ReadinessEvidenceEvent,
  type ReadinessOperation,
  selectReadinessEvidence,
} from './readiness-evidence';
import {
  type NorLocationClauseInput,
  type NorLocationEvidenceInput,
  type NorLocationQualificationResult,
  resolveNorLocationQualification,
} from './nor-location-qualification';

export interface NorDocumentCandidateInput {
  id?: string | null;
  tenderTime: Date;
  acceptedTime?: Date | null;
}

export type NorSofEventCandidateInput = ReadinessEvidenceEvent;

type CandidateSource = 'nor-document' | 'sof-event';

export interface SelectedNorCandidate {
  source: CandidateSource;
  norDocumentId: string | null;
  norTenderedEventId: string | null;
  tenderTime: Date;
  acceptedTime: Date | null;
  effectiveTime: Date;
  validityBasis: 'accepted' | 'tendered-ready' | null;
  freePratique: FreePratiqueCandidateAudit;
  location: NorLocationQualificationResult;
}

export type FreePratiqueCandidateAudit = Omit<
  FreePratiqueQualificationResult,
  'freePratiqueEventId'
> & {
  eventId: string | null;
  source: FreePratiqueEvidenceSelection['source'];
};

export interface RejectedNorCandidate {
  source: CandidateSource;
  norDocumentId: string | null;
  norTenderedEventId: string | null;
  tenderTime: Date;
  validityBasis: 'not-ready';
  warnings: string[];
  freePratique: FreePratiqueCandidateAudit;
}

export interface FreePratiqueRejectedNorCandidate {
  source: CandidateSource;
  norDocumentId: string | null;
  norTenderedEventId: string | null;
  tenderTime: Date;
  freePratique: FreePratiqueCandidateAudit;
}

export interface LocationRejectedNorCandidate {
  source: CandidateSource;
  norDocumentId: string | null;
  norTenderedEventId: string | null;
  tenderTime: Date;
  rejectionReasons: string[];
  location: NorLocationQualificationResult;
}

export interface NorCommencementCandidateResult {
  selectedCandidate: SelectedNorCandidate | null;
  readiness: {
    selectedEventId: string | null;
    readinessTime: Date | null;
    source: 'operation-specific' | 'legacy-null' | 'unscoped' | 'missing';
  };
  validityStatus: 'valid' | 'unavailable' | 'no-valid-candidate';
  rejectedCandidates: RejectedNorCandidate[];
  freePratiqueRejectedCandidates: FreePratiqueRejectedNorCandidate[];
  locationRejectedCandidates: LocationRejectedNorCandidate[];
  freePratiqueEvidence: FreePratiqueEvidenceSelection;
  warnings: string[];
}

type OrderedCandidate = {
  source: CandidateSource;
  id: string | null;
  tenderTime: Date;
  acceptedTime: Date | null;
  inputOrder: number;
};

const MISSING_READINESS_WARNING =
  'NOR validity was not evaluated because vessel-readiness evidence is missing.';
const NO_VALID_CANDIDATE_WARNING =
  'No valid NOR candidate remained after NOR qualification.';

/** Resolves an effective NOR candidate without applying a notice period. */
export function resolveNorCommencementCandidate(input: {
  norDocuments: NorDocumentCandidateInput[];
  sofEvents: NorSofEventCandidateInput[];
  operation?: ReadinessOperation;
  wifponClause?: SelectedWifponClause | null;
  voyageId?: string;
  locationEvidence?: NorLocationEvidenceInput[];
  wibonClause?: NorLocationClauseInput | null;
  wiponClause?: NorLocationClauseInput | null;
}): NorCommencementCandidateResult {
  const readinessSelection = selectReadinessEvidence(
    input.sofEvents,
    input.operation,
  );
  const readiness = {
    selectedEventId: readinessSelection.selectedEventId,
    readinessTime: readinessSelection.readinessTime
      ? new Date(readinessSelection.readinessTime)
      : null,
    source: readinessSelection.source,
  };
  const freePratiqueEvidence = selectFreePratiqueEvidence(
    input.sofEvents,
    input.operation,
  );
  const evaluateFreePratique = Object.prototype.hasOwnProperty.call(
    input,
    'wifponClause',
  );
  const documentCandidates = input.norDocuments.map<OrderedCandidate>(
    (document, index) => ({
      source: 'nor-document',
      id: document.id ?? null,
      tenderTime: document.tenderTime,
      acceptedTime: document.acceptedTime ?? null,
      inputOrder: index,
    }),
  );
  const sofCandidates = input.sofEvents
    .filter((event) => event.eventType === 'NOR_TENDERED')
    .map<OrderedCandidate>((event, index) => ({
      source: 'sof-event',
      id: event.id ?? null,
      tenderTime: event.eventTime,
      acceptedTime: null,
      inputOrder: index,
    }));
  const orderedCandidates = [...documentCandidates, ...sofCandidates].sort(
    compareCandidates,
  );

  const qualifyFreePratique = (candidate: OrderedCandidate) =>
    evaluateFreePratique
      ? resolveFreePratiqueQualification({
          tenderTime: candidate.tenderTime,
          freePratiqueEvidence,
          wifponClause: input.wifponClause ?? null,
        })
      : unevaluatedFreePratiqueQualification(freePratiqueEvidence);
  const qualifyLocation = (candidate: OrderedCandidate) =>
    resolveNorLocationQualification({
      candidate: {
        source: candidate.source,
        id: candidate.id,
        voyageId: input.voyageId ?? '',
        operation: input.operation ?? 'Loading',
        tenderTime: candidate.tenderTime,
      },
      evidence: input.locationEvidence ?? [],
      wibonClause: input.wibonClause ?? null,
      wiponClause: input.wiponClause ?? null,
    });

  if (!readiness.readinessTime) {
    const legacyOrderedCandidates = [
      ...documentCandidates.sort(compareCandidates),
      ...sofCandidates.sort(compareCandidates),
    ];
    const rejectedForFreePratique: FreePratiqueRejectedNorCandidate[] = [];
    const rejectedForLocation: LocationRejectedNorCandidate[] = [];
    const qualificationWarnings: string[] = [];
    let legacySelection:
      | {
          candidate: OrderedCandidate;
          qualification: FreePratiqueQualificationResult;
          location: NorLocationQualificationResult;
        }
      | undefined;

    for (const candidate of legacyOrderedCandidates) {
      const qualification = qualifyFreePratique(candidate);
      const location = qualifyLocation(candidate);
      qualificationWarnings.push(...qualification.warnings);
      qualificationWarnings.push(...location.warnings);
      if (qualification.valid === false) {
        rejectedForFreePratique.push(
          toFreePratiqueRejectedCandidate(
            candidate,
            toFreePratiqueAudit(qualification, freePratiqueEvidence.source),
          ),
        );
        continue;
      }

      if (location.overallStatus === 'INVALID') {
        rejectedForLocation.push(
          toLocationRejectedCandidate(candidate, location),
        );
        continue;
      }

      legacySelection = { candidate, qualification, location };
      break;
    }

    return {
      selectedCandidate: legacySelection
        ? toSelectedCandidate(
            legacySelection.candidate,
            legacySelection.candidate.acceptedTime ??
              legacySelection.candidate.tenderTime,
            null,
            toFreePratiqueAudit(
              legacySelection.qualification,
              freePratiqueEvidence.source,
            ),
            legacySelection.location,
          )
        : null,
      readiness,
      validityStatus: legacySelection
        ? 'unavailable'
        : legacyOrderedCandidates.length > 0
          ? 'no-valid-candidate'
          : 'unavailable',
      rejectedCandidates: [],
      freePratiqueRejectedCandidates: rejectedForFreePratique,
      locationRejectedCandidates: rejectedForLocation,
      freePratiqueEvidence: cloneFreePratiqueEvidence(freePratiqueEvidence),
      warnings: uniqueWarnings([
        ...readinessSelection.warnings,
        ...freePratiqueEvidence.warnings,
        ...qualificationWarnings,
        MISSING_READINESS_WARNING,
        ...(legacyOrderedCandidates.length > 0 && !legacySelection
          ? [NO_VALID_CANDIDATE_WARNING]
          : []),
      ]),
    };
  }

  const rejectedCandidates: RejectedNorCandidate[] = [];
  const freePratiqueRejectedCandidates: FreePratiqueRejectedNorCandidate[] = [];
  const locationRejectedCandidates: LocationRejectedNorCandidate[] = [];
  const validCandidates: Array<{
    candidate: OrderedCandidate;
    effectiveTime: Date;
    validityBasis: 'accepted' | 'tendered-ready';
    freePratique: FreePratiqueCandidateAudit;
    location: NorLocationQualificationResult;
  }> = [];
  const validityWarnings: string[] = [];

  for (const candidate of orderedCandidates) {
    const validity = resolveNorValidity({
      tenderTime: candidate.tenderTime,
      acceptedTime: candidate.acceptedTime,
      readinessTime: readiness.readinessTime,
    });
    const freePratiqueQualification = qualifyFreePratique(candidate);
    const locationQualification = qualifyLocation(candidate);
    const freePratiqueAudit = toFreePratiqueAudit(
      freePratiqueQualification,
      freePratiqueEvidence.source,
    );

    validityWarnings.push(...validity.warnings);
    validityWarnings.push(...freePratiqueQualification.warnings);
    validityWarnings.push(...locationQualification.warnings);
    if (
      !validity.valid ||
      !validity.effectiveTime ||
      validity.basis === 'not-ready'
    ) {
      rejectedCandidates.push({
        source: candidate.source,
        norDocumentId:
          candidate.source === 'nor-document' ? candidate.id : null,
        norTenderedEventId:
          candidate.source === 'sof-event' ? candidate.id : null,
        tenderTime: new Date(candidate.tenderTime),
        validityBasis: 'not-ready',
        warnings: [...validity.warnings],
        freePratique: freePratiqueAudit,
      });
    }

    if (freePratiqueQualification.valid === false) {
      freePratiqueRejectedCandidates.push(
        toFreePratiqueRejectedCandidate(candidate, freePratiqueAudit),
      );
    }

    if (locationQualification.overallStatus === 'INVALID') {
      locationRejectedCandidates.push(
        toLocationRejectedCandidate(candidate, locationQualification),
      );
    }

    if (
      !validity.valid ||
      !validity.effectiveTime ||
      validity.basis === 'not-ready' ||
      freePratiqueQualification.valid === false ||
      locationQualification.overallStatus === 'INVALID'
    ) {
      continue;
    }

    validCandidates.push({
      candidate,
      effectiveTime: validity.effectiveTime,
      validityBasis: validity.basis,
      freePratique: freePratiqueAudit,
      location: locationQualification,
    });
  }

  const selected = validCandidates[0];
  return {
    selectedCandidate: selected
      ? toSelectedCandidate(
          selected.candidate,
          selected.effectiveTime,
          selected.validityBasis,
          selected.freePratique,
          selected.location,
        )
      : null,
    readiness,
    validityStatus: selected ? 'valid' : 'no-valid-candidate',
    rejectedCandidates,
    freePratiqueRejectedCandidates,
    locationRejectedCandidates,
    freePratiqueEvidence: cloneFreePratiqueEvidence(freePratiqueEvidence),
    warnings: uniqueWarnings([
      ...readinessSelection.warnings,
      ...freePratiqueEvidence.warnings,
      ...validityWarnings,
      ...(selected ? [] : [NO_VALID_CANDIDATE_WARNING]),
    ]),
  };
}

function compareCandidates(
  left: OrderedCandidate,
  right: OrderedCandidate,
): number {
  const timeDelta = left.tenderTime.getTime() - right.tenderTime.getTime();
  if (timeDelta !== 0) return timeDelta;

  const sourceDelta =
    sourcePriority(left.source) - sourcePriority(right.source);
  if (sourceDelta !== 0) return sourceDelta;

  const idDelta = (left.id ?? '').localeCompare(right.id ?? '');
  return idDelta !== 0 ? idDelta : left.inputOrder - right.inputOrder;
}

function sourcePriority(source: CandidateSource): number {
  return source === 'nor-document' ? 0 : 1;
}

function toSelectedCandidate(
  candidate: OrderedCandidate,
  effectiveTime: Date,
  validityBasis: 'accepted' | 'tendered-ready' | null,
  freePratique: FreePratiqueCandidateAudit,
  location: NorLocationQualificationResult,
): SelectedNorCandidate {
  return {
    source: candidate.source,
    norDocumentId: candidate.source === 'nor-document' ? candidate.id : null,
    norTenderedEventId: candidate.source === 'sof-event' ? candidate.id : null,
    tenderTime: new Date(candidate.tenderTime),
    acceptedTime: candidate.acceptedTime
      ? new Date(candidate.acceptedTime)
      : null,
    effectiveTime: new Date(effectiveTime),
    validityBasis,
    freePratique: cloneFreePratiqueAudit(freePratique),
    location: cloneLocationQualification(location),
  };
}

function toLocationRejectedCandidate(
  candidate: OrderedCandidate,
  location: NorLocationQualificationResult,
): LocationRejectedNorCandidate {
  return {
    source: candidate.source,
    norDocumentId: candidate.source === 'nor-document' ? candidate.id : null,
    norTenderedEventId: candidate.source === 'sof-event' ? candidate.id : null,
    tenderTime: new Date(candidate.tenderTime),
    rejectionReasons: [location.berth, location.port]
      .filter((dimension) => dimension.status === 'INVALID')
      .map((dimension) => dimension.reason),
    location: cloneLocationQualification(location),
  };
}

function cloneLocationQualification(
  location: NorLocationQualificationResult,
): NorLocationQualificationResult {
  return {
    ...location,
    selectedEvidence: location.selectedEvidence
      ? {
          ...location.selectedEvidence,
          evidenceTime: new Date(location.selectedEvidence.evidenceTime),
          createdAt: new Date(location.selectedEvidence.createdAt),
        }
      : null,
    conflictingEvidenceIds: [...location.conflictingEvidenceIds],
    ignoredUnassociatedEvidenceIds: [
      ...location.ignoredUnassociatedEvidenceIds,
    ],
    ineligibleAfterTenderEvidenceIds: [
      ...location.ineligibleAfterTenderEvidenceIds,
    ],
    berth: { ...location.berth },
    port: { ...location.port },
    warnings: [...location.warnings],
  };
}

function toFreePratiqueAudit(
  qualification: FreePratiqueQualificationResult,
  source: FreePratiqueEvidenceSelection['source'],
): FreePratiqueCandidateAudit {
  return {
    valid: qualification.valid,
    status: qualification.status,
    grantedTime: qualification.grantedTime
      ? new Date(qualification.grantedTime)
      : null,
    eventId: qualification.freePratiqueEventId,
    source,
    wifponClauseId: qualification.wifponClauseId,
    wifponEnabled: qualification.wifponEnabled,
    wifponApplied: qualification.wifponApplied,
    warnings: [...qualification.warnings],
  };
}

function cloneFreePratiqueAudit(
  audit: FreePratiqueCandidateAudit,
): FreePratiqueCandidateAudit {
  return {
    ...audit,
    grantedTime: audit.grantedTime ? new Date(audit.grantedTime) : null,
    warnings: [...audit.warnings],
  };
}

function toFreePratiqueRejectedCandidate(
  candidate: OrderedCandidate,
  freePratique: FreePratiqueCandidateAudit,
): FreePratiqueRejectedNorCandidate {
  return {
    source: candidate.source,
    norDocumentId: candidate.source === 'nor-document' ? candidate.id : null,
    norTenderedEventId: candidate.source === 'sof-event' ? candidate.id : null,
    tenderTime: new Date(candidate.tenderTime),
    freePratique: cloneFreePratiqueAudit(freePratique),
  };
}

function cloneFreePratiqueEvidence(
  evidence: FreePratiqueEvidenceSelection,
): FreePratiqueEvidenceSelection {
  return {
    ...evidence,
    grantedTime: evidence.grantedTime ? new Date(evidence.grantedTime) : null,
    candidateEventIds: [...evidence.candidateEventIds],
    excludedOppositeOperationEventIds: [
      ...evidence.excludedOppositeOperationEventIds,
    ],
    duplicateEventIds: [...evidence.duplicateEventIds],
    warnings: [...evidence.warnings],
  };
}

function unevaluatedFreePratiqueQualification(
  evidence: FreePratiqueEvidenceSelection,
): FreePratiqueQualificationResult {
  return {
    valid: null,
    status: 'unavailable',
    grantedTime: evidence.grantedTime ? new Date(evidence.grantedTime) : null,
    freePratiqueEventId: evidence.selectedEventId,
    wifponClauseId: null,
    wifponEnabled: false,
    wifponApplied: false,
    warnings: [],
  };
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}
