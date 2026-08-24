import type {
  NorBerthRelation,
  NorLocationEvidenceSource,
  NorLocationOperation,
  NorPortRelation,
  NorWaitingPlace,
} from '../entities/nor-tender-location-evidence.entity';

export type NorLocationQualificationStatus = 'PASS' | 'INVALID' | 'UNAVAILABLE';

export interface NorLocationClauseInput {
  id: string;
  parameters: Record<string, unknown>;
}

export interface NorLocationEvidenceInput {
  id: string;
  voyageId: string;
  operation: NorLocationOperation;
  evidenceTime: Date;
  portRelation: NorPortRelation;
  berthRelation: NorBerthRelation;
  waitingPlace: NorWaitingPlace;
  source: NorLocationEvidenceSource;
  norDocumentId?: string | null;
  norTenderedEventId?: string | null;
  createdAt: Date;
}

export interface NorLocationCandidateInput {
  source: 'nor-document' | 'sof-event';
  id: string | null;
  voyageId: string;
  operation: NorLocationOperation;
  tenderTime: Date;
}

export interface NorLocationDimensionResult {
  status: NorLocationQualificationStatus;
  factualValue: NorBerthRelation | NorPortRelation | null;
  waitingPlace: NorWaitingPlace | null;
  requirement: 'AT_BERTH' | 'INSIDE_PORT_LIMITS';
  clauseId: string | null;
  configured: boolean;
  enabled: boolean;
  waiverNeeded: boolean;
  waiverApplied: boolean;
  reason: string;
}

export interface NorLocationQualificationResult {
  overallStatus: NorLocationQualificationStatus;
  selectedEvidence: NorLocationEvidenceInput | null;
  associationBasis:
    | 'explicit-nor-document'
    | 'explicit-sof-nor-tendered-event'
    | null;
  conflictingEvidenceIds: string[];
  ignoredUnassociatedEvidenceIds: string[];
  ineligibleAfterTenderEvidenceIds: string[];
  berth: NorLocationDimensionResult;
  port: NorLocationDimensionResult;
  warnings: string[];
}

const APPROVED_WIPON_WAITING_PLACES = new Set<NorWaitingPlace>([
  'ANCHORAGE',
  'PILOT_STATION',
  'CUSTOMARY_WAITING_PLACE',
]);

const NO_EVIDENCE_WARNING =
  'NOR location qualification is unavailable because no eligible candidate-associated location evidence exists.';
const CONFLICT_WARNING =
  'NOR location qualification is unavailable because equally timed candidate-associated evidence conflicts.';

export function resolveNorLocationQualification(input: {
  candidate: NorLocationCandidateInput;
  evidence: NorLocationEvidenceInput[];
  wibonClause?: NorLocationClauseInput | null;
  wiponClause?: NorLocationClauseInput | null;
}): NorLocationQualificationResult {
  const candidateReference =
    input.candidate.source === 'nor-document'
      ? 'norDocumentId'
      : 'norTenderedEventId';
  const associationBasis =
    input.candidate.source === 'nor-document'
      ? 'explicit-nor-document'
      : 'explicit-sof-nor-tendered-event';

  const matching = input.evidence.filter(
    (evidence) =>
      input.candidate.id !== null &&
      evidence.voyageId === input.candidate.voyageId &&
      evidence.operation === input.candidate.operation &&
      evidence[candidateReference] === input.candidate.id,
  );
  const ignoredUnassociatedEvidenceIds = input.evidence
    .filter((evidence) => !matching.includes(evidence))
    .map((evidence) => evidence.id);
  const eligible = matching.filter(
    (evidence) =>
      evidence.evidenceTime.getTime() <= input.candidate.tenderTime.getTime(),
  );
  const ineligibleAfterTenderEvidenceIds = matching
    .filter(
      (evidence) =>
        evidence.evidenceTime.getTime() > input.candidate.tenderTime.getTime(),
    )
    .map((evidence) => evidence.id);

  if (eligible.length === 0) {
    return unavailableResult({
      wibonClause: input.wibonClause,
      wiponClause: input.wiponClause,
      ignoredUnassociatedEvidenceIds,
      ineligibleAfterTenderEvidenceIds,
      warning: NO_EVIDENCE_WARNING,
    });
  }

  const latestTime = Math.max(
    ...eligible.map((evidence) => evidence.evidenceTime.getTime()),
  );
  const latest = eligible.filter(
    (evidence) => evidence.evidenceTime.getTime() === latestTime,
  );
  const facts = new Set(
    latest.map(
      (evidence) =>
        `${evidence.portRelation}|${evidence.berthRelation}|${evidence.waitingPlace}`,
    ),
  );

  if (facts.size > 1) {
    return unavailableResult({
      wibonClause: input.wibonClause,
      wiponClause: input.wiponClause,
      ignoredUnassociatedEvidenceIds,
      ineligibleAfterTenderEvidenceIds,
      conflictingEvidenceIds: latest.map((evidence) => evidence.id).sort(),
      warning: CONFLICT_WARNING,
    });
  }

  const selectedEvidence = [...latest].sort(compareEvidenceDescending)[0];
  const berth = resolveBerth(selectedEvidence, input.wibonClause ?? null);
  const port = resolvePort(selectedEvidence, input.wiponClause ?? null);
  const overallStatus = combineStatus(berth.status, port.status);
  const unavailableReasons = [
    ...new Set(
      [berth, port]
        .filter((dimension) => dimension.status === 'UNAVAILABLE')
        .map((dimension) => dimension.reason),
    ),
  ];

  return {
    overallStatus,
    selectedEvidence: cloneEvidence(selectedEvidence),
    associationBasis,
    conflictingEvidenceIds: [],
    ignoredUnassociatedEvidenceIds,
    ineligibleAfterTenderEvidenceIds,
    berth,
    port,
    warnings:
      overallStatus === 'UNAVAILABLE'
        ? [
            `NOR location qualification is unavailable: ${unavailableReasons.join(', ')}.`,
          ]
        : [],
  };
}

function resolveBerth(
  evidence: NorLocationEvidenceInput,
  clause: NorLocationClauseInput | null,
): NorLocationDimensionResult {
  const enabled = clause?.parameters.enabled === true;
  const common = clauseState(clause, enabled);

  if (evidence.berthRelation === 'UNKNOWN') {
    return {
      ...common,
      status: 'UNAVAILABLE',
      factualValue: evidence.berthRelation,
      waitingPlace: null,
      requirement: 'AT_BERTH',
      waiverNeeded: false,
      waiverApplied: false,
      reason: 'BERTH_LOCATION_UNKNOWN',
    };
  }
  if (evidence.berthRelation === 'AT_BERTH') {
    return {
      ...common,
      status: 'PASS',
      factualValue: evidence.berthRelation,
      waitingPlace: null,
      requirement: 'AT_BERTH',
      waiverNeeded: false,
      waiverApplied: false,
      reason: 'BERTH_REQUIREMENT_SATISFIED',
    };
  }
  if (enabled) {
    return {
      ...common,
      status: 'PASS',
      factualValue: evidence.berthRelation,
      waitingPlace: null,
      requirement: 'AT_BERTH',
      waiverNeeded: true,
      waiverApplied: true,
      reason: 'BERTH_REQUIREMENT_WAIVED_BY_WIBON',
    };
  }

  return {
    ...common,
    status: 'INVALID',
    factualValue: evidence.berthRelation,
    waitingPlace: null,
    requirement: 'AT_BERTH',
    waiverNeeded: true,
    waiverApplied: false,
    reason: 'NOR_LOCATION_NOT_AT_BERTH',
  };
}

function resolvePort(
  evidence: NorLocationEvidenceInput,
  clause: NorLocationClauseInput | null,
): NorLocationDimensionResult {
  const enabled = clause?.parameters.enabled === true;
  const common = clauseState(clause, enabled);

  if (evidence.portRelation === 'UNKNOWN') {
    return {
      ...common,
      status: 'UNAVAILABLE',
      factualValue: evidence.portRelation,
      waitingPlace: evidence.waitingPlace,
      requirement: 'INSIDE_PORT_LIMITS',
      waiverNeeded: false,
      waiverApplied: false,
      reason: 'PORT_LOCATION_UNKNOWN',
    };
  }
  if (evidence.portRelation === 'INSIDE_PORT_LIMITS') {
    return {
      ...common,
      status: 'PASS',
      factualValue: evidence.portRelation,
      waitingPlace: evidence.waitingPlace,
      requirement: 'INSIDE_PORT_LIMITS',
      waiverNeeded: false,
      waiverApplied: false,
      reason: 'PORT_REQUIREMENT_SATISFIED',
    };
  }
  if (!enabled) {
    return {
      ...common,
      status: 'INVALID',
      factualValue: evidence.portRelation,
      waitingPlace: evidence.waitingPlace,
      requirement: 'INSIDE_PORT_LIMITS',
      waiverNeeded: true,
      waiverApplied: false,
      reason: 'NOR_LOCATION_OUTSIDE_PORT',
    };
  }
  if (evidence.waitingPlace === 'UNKNOWN') {
    return {
      ...common,
      status: 'UNAVAILABLE',
      factualValue: evidence.portRelation,
      waitingPlace: evidence.waitingPlace,
      requirement: 'INSIDE_PORT_LIMITS',
      waiverNeeded: true,
      waiverApplied: false,
      reason: 'WAITING_PLACE_UNKNOWN',
    };
  }
  if (APPROVED_WIPON_WAITING_PLACES.has(evidence.waitingPlace)) {
    return {
      ...common,
      status: 'PASS',
      factualValue: evidence.portRelation,
      waitingPlace: evidence.waitingPlace,
      requirement: 'INSIDE_PORT_LIMITS',
      waiverNeeded: true,
      waiverApplied: true,
      reason: 'PORT_REQUIREMENT_WAIVED_BY_WIPON',
    };
  }

  return {
    ...common,
    status: 'INVALID',
    factualValue: evidence.portRelation,
    waitingPlace: evidence.waitingPlace,
    requirement: 'INSIDE_PORT_LIMITS',
    waiverNeeded: true,
    waiverApplied: false,
    reason: 'NOR_LOCATION_WIPON_WAITING_PLACE_NOT_QUALIFIED',
  };
}

function unavailableResult(input: {
  wibonClause?: NorLocationClauseInput | null;
  wiponClause?: NorLocationClauseInput | null;
  ignoredUnassociatedEvidenceIds: string[];
  ineligibleAfterTenderEvidenceIds: string[];
  conflictingEvidenceIds?: string[];
  warning: string;
}): NorLocationQualificationResult {
  const wibonEnabled = input.wibonClause?.parameters.enabled === true;
  const wiponEnabled = input.wiponClause?.parameters.enabled === true;
  const reason = input.conflictingEvidenceIds?.length
    ? 'LOCATION_EVIDENCE_CONFLICT'
    : 'NO_ASSOCIATED_LOCATION_EVIDENCE';

  return {
    overallStatus: 'UNAVAILABLE',
    selectedEvidence: null,
    associationBasis: null,
    conflictingEvidenceIds: input.conflictingEvidenceIds ?? [],
    ignoredUnassociatedEvidenceIds: input.ignoredUnassociatedEvidenceIds,
    ineligibleAfterTenderEvidenceIds: input.ineligibleAfterTenderEvidenceIds,
    berth: {
      ...clauseState(input.wibonClause ?? null, wibonEnabled),
      status: 'UNAVAILABLE',
      factualValue: null,
      waitingPlace: null,
      requirement: 'AT_BERTH',
      waiverNeeded: false,
      waiverApplied: false,
      reason,
    },
    port: {
      ...clauseState(input.wiponClause ?? null, wiponEnabled),
      status: 'UNAVAILABLE',
      factualValue: null,
      waitingPlace: null,
      requirement: 'INSIDE_PORT_LIMITS',
      waiverNeeded: false,
      waiverApplied: false,
      reason,
    },
    warnings: [input.warning],
  };
}

function clauseState(clause: NorLocationClauseInput | null, enabled: boolean) {
  return {
    clauseId: clause?.id ?? null,
    configured: clause !== null,
    enabled,
  };
}

function combineStatus(
  berth: NorLocationQualificationStatus,
  port: NorLocationQualificationStatus,
): NorLocationQualificationStatus {
  if (berth === 'INVALID' || port === 'INVALID') return 'INVALID';
  if (berth === 'PASS' && port === 'PASS') return 'PASS';
  return 'UNAVAILABLE';
}

function compareEvidenceDescending(
  left: NorLocationEvidenceInput,
  right: NorLocationEvidenceInput,
): number {
  const createdAt = right.createdAt.getTime() - left.createdAt.getTime();
  return createdAt !== 0 ? createdAt : right.id.localeCompare(left.id);
}

function cloneEvidence(
  evidence: NorLocationEvidenceInput,
): NorLocationEvidenceInput {
  return {
    ...evidence,
    evidenceTime: new Date(evidence.evidenceTime),
    createdAt: new Date(evidence.createdAt),
  };
}
