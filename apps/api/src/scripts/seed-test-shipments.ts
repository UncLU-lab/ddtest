import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { normalizeCommercialTermsToClauses } from '../modules/bulk/charter-party-terms';
import { CharterParty } from '../modules/bulk/entities/charter-party.entity';
import { CpClause } from '../modules/bulk/entities/cp-clause.entity';
import { LaytimeCalculation } from '../modules/bulk/entities/laytime-calculation.entity';
import { NorDocument } from '../modules/bulk/entities/nor-document.entity';
import { SofDocument } from '../modules/bulk/entities/sof-document.entity';
import { SofEvent } from '../modules/bulk/entities/sof-event.entity';
import { Vessel } from '../modules/bulk/entities/vessel.entity';
import { Voyage } from '../modules/bulk/entities/voyage.entity';
import { LaytimeCalculationsService } from '../modules/bulk/laytime-calculations/laytime-calculations.service';
import { SofDocumentsService } from '../modules/bulk/sof-documents/sof-documents.service';
import { CharterPartiesService } from '../modules/bulk/charter-parties/charter-parties.service';
import { VoyagesService } from '../modules/bulk/voyages/voyages.service';

const logger = new Logger('SeedTestShipments');
const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
const FIXED_CALCULATION_TIMESTAMP = new Date('2026-08-01T00:00:00Z');

type ScenarioId =
  | 'CODEX-TEST-01'
  | 'CODEX-TEST-02'
  | 'CODEX-TEST-03'
  | 'CODEX-TEST-04'
  | 'CODEX-TEST-05'
  | 'CODEX-TEST-06'
  | 'CODEX-TEST-07'
  | 'CODEX-TEST-08'
  | 'CODEX-TEST-09'
  | 'CODEX-TEST-10';

type Operation = 'Loading' | 'Discharge' | null;

type ScenarioDefinition = {
  reference: ScenarioId;
  label: string;
  vessel: {
    imo: string;
    name: string;
    flag: string;
    type: string;
    dwt: number;
  };
  voyage: {
    cargoQuantity: string;
    cargoType: string;
    loadPort: string;
    dischargePort: string;
    laycanStart: string;
    laycanEnd: string;
    laytimeOperation: 'Loading' | 'Discharge';
    laytimeAllowed: number;
    demurrageRate: number;
    dispatchRate: number;
    timeCountingBasis: 'SHINC' | 'SHEX';
    norNoticePeriod: string;
  };
  voyageCreatedAt: Date;
  voyageUpdatedAt: Date;
  charterCreatedAt: Date;
  documentUploadDate: Date;
  calculationTimestamp: Date;
  nor: {
    tenderTime: Date;
    acceptedTime: Date | null;
  };
  sofDocument: {
    id: string;
    filePath: string;
    operation: Operation;
    status: 'Final';
  };
  sofEvents: Array<{
    id: string;
    eventTime: Date;
    eventType: string;
    operation: Operation;
  }>;
  extraClauses: Array<{
    clauseType: string;
    rawText: string;
    parameters: Record<string, unknown>;
  }>;
  expected: {
    usedLaytime: string;
    demurrageAmount: string;
    despatchAmount: string;
    warningIncludes?: string[];
    warningExcludes?: string[];
    auditChecks?: Array<{ path: string[]; expected: unknown }>;
  };
};

function scenarioTime(day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 6, day, hour, minute, 0));
}

function seedUuid(reference: ScenarioId, slot: number): string {
  const index = Number(reference.slice(-2));
  const numeric = index * 100 + slot;
  return `00000000-0000-4000-8000-${String(numeric).padStart(12, '0')}`;
}

function buildCommonScenario(
  reference: ScenarioId,
  label: string,
  overrides: Partial<ScenarioDefinition> & {
    vessel: ScenarioDefinition['vessel'];
    voyage: ScenarioDefinition['voyage'];
    nor: ScenarioDefinition['nor'];
    sofDocument: ScenarioDefinition['sofDocument'];
    sofEvents: ScenarioDefinition['sofEvents'];
    expected: ScenarioDefinition['expected'];
  },
): ScenarioDefinition {
  const index = Number(reference.slice(-2));
  const day = Math.max(1, Math.min(28, index));

  return {
    reference,
    label,
    vessel: overrides.vessel,
    voyage: overrides.voyage,
    voyageCreatedAt: overrides.voyageCreatedAt ?? scenarioTime(day, 0),
    voyageUpdatedAt: overrides.voyageUpdatedAt ?? scenarioTime(day, 1),
    charterCreatedAt: overrides.charterCreatedAt ?? scenarioTime(day, 2),
    documentUploadDate: overrides.documentUploadDate ?? scenarioTime(day, 3),
    calculationTimestamp:
      overrides.calculationTimestamp ?? scenarioTime(day, 4),
    nor: overrides.nor,
    sofDocument: overrides.sofDocument,
    sofEvents: overrides.sofEvents,
    extraClauses: overrides.extraClauses ?? [],
    expected: overrides.expected,
  };
}

const scenarios: ScenarioDefinition[] = [
  buildCommonScenario('CODEX-TEST-01', 'Discharge / SHINC / within allowance', {
    vessel: {
      imo: '7000001',
      name: 'CODEX-TEST-01 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-01', 5),
      filePath: 'seed/codex-test-01/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-01', 11),
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    expected: {
      usedLaytime: '1 days 00:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '6000.00',
    },
  }),
  buildCommonScenario('CODEX-TEST-02', 'Discharge / SHINC / demurrage', {
    vessel: {
      imo: '7000002',
      name: 'CODEX-TEST-02 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-02', 5),
      filePath: 'seed/codex-test-02/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-02', 11),
        eventTime: new Date('2026-03-07T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    expected: {
      usedLaytime: '3 days 00:00:00',
      demurrageAmount: '12000.00',
      despatchAmount: '0.00',
    },
  }),
  buildCommonScenario('CODEX-TEST-03', 'Loading / SHEX / spans Sunday', {
    vessel: {
      imo: '7000003',
      name: 'CODEX-TEST-03 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Loading',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHEX',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-06T00:00:00Z'),
      acceptedTime: new Date('2026-03-06T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-03', 5),
      filePath: 'seed/codex-test-03/sof.txt',
      operation: 'Loading',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-03', 11),
        eventTime: new Date('2026-03-09T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    expected: {
      usedLaytime: '2 days 00:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '0.00',
    },
  }),
  buildCommonScenario('CODEX-TEST-04', 'Weather Working enabled', {
    vessel: {
      imo: '7000004',
      name: 'CODEX-TEST-04 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 36,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-04', 5),
      filePath: 'seed/codex-test-04/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-04', 11),
        eventTime: new Date('2026-03-05T00:00:00Z'),
        eventType: 'RAIN_STOPPAGE',
        operation: null,
      },
      {
        id: seedUuid('CODEX-TEST-04', 12),
        eventTime: new Date('2026-03-05T12:00:00Z'),
        eventType: 'RAIN_STOPPED',
        operation: null,
      },
      {
        id: seedUuid('CODEX-TEST-04', 13),
        eventTime: new Date('2026-03-06T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    extraClauses: [
      {
        clauseType: 'weather_working',
        rawText: 'Weather working day enabled',
        parameters: { enabled: true },
      },
    ],
    expected: {
      usedLaytime: '1 days 12:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '0.00',
      auditChecks: [
        {
          path: ['weatherWorking', 'applied'],
          expected: true,
        },
        {
          path: ['weatherWorking', 'totalWeatherTimeDeductedBeforeDemurrage'],
          expected: 43200,
        },
      ],
    },
  }),
  buildCommonScenario('CODEX-TEST-05', 'Weather Working disabled', {
    vessel: {
      imo: '7000005',
      name: 'CODEX-TEST-05 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 36,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-05', 5),
      filePath: 'seed/codex-test-05/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-05', 11),
        eventTime: new Date('2026-03-05T00:00:00Z'),
        eventType: 'RAIN_STOPPAGE',
        operation: null,
      },
      {
        id: seedUuid('CODEX-TEST-05', 12),
        eventTime: new Date('2026-03-05T12:00:00Z'),
        eventType: 'RAIN_STOPPED',
        operation: null,
      },
      {
        id: seedUuid('CODEX-TEST-05', 13),
        eventTime: new Date('2026-03-06T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    extraClauses: [
      {
        clauseType: 'weather_working',
        rawText: 'Weather working day disabled',
        parameters: { enabled: false },
      },
    ],
    expected: {
      usedLaytime: '2 days 00:00:00',
      demurrageAmount: '6000.00',
      despatchAmount: '0.00',
      auditChecks: [
        {
          path: ['weatherWorking', 'applied'],
          expected: false,
        },
        {
          path: ['weatherWorking', 'totalWeatherTimeDeductedBeforeDemurrage'],
          expected: 0,
        },
      ],
    },
  }),
  buildCommonScenario('CODEX-TEST-06', 'Once on demurrage', {
    vessel: {
      imo: '7000006',
      name: 'CODEX-TEST-06 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 12,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-06', 5),
      filePath: 'seed/codex-test-06/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-06', 11),
        eventTime: new Date('2026-03-04T20:00:00Z'),
        eventType: 'RAIN_STOPPAGE',
        operation: null,
      },
      {
        id: seedUuid('CODEX-TEST-06', 12),
        eventTime: new Date('2026-03-05T02:00:00Z'),
        eventType: 'RAIN_STOPPED',
        operation: null,
      },
      {
        id: seedUuid('CODEX-TEST-06', 13),
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    extraClauses: [
      {
        clauseType: 'weather_working',
        rawText: 'Weather working day enabled',
        parameters: { enabled: true },
      },
    ],
    expected: {
      usedLaytime: '1 days 00:00:00',
      demurrageAmount: '6000.00',
      despatchAmount: '0.00',
      auditChecks: [
        {
          path: ['demurrage', 'startedAt'],
          expected: '2026-03-04T18:00:00.000Z',
        },
        {
          path: ['demurrage', 'ignoredExceptions'],
          expected: [
            {
              startTime: '2026-03-04T20:00:00.000Z',
              endTime: '2026-03-05T02:00:00.000Z',
              appliedClauseId: null,
              reason: 'already_on_demurrage',
            },
          ],
        },
      ],
    },
  }),
  buildCommonScenario('CODEX-TEST-07', 'WIBON enabled', {
    vessel: {
      imo: '7000007',
      name: 'CODEX-TEST-07 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-07', 5),
      filePath: 'seed/codex-test-07/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-07', 11),
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    extraClauses: [
      {
        clauseType: 'wibon',
        rawText: 'WIBON enabled',
        parameters: { enabled: true },
      },
    ],
    expected: {
      usedLaytime: '1 days 00:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '6000.00',
      auditChecks: [
        { path: ['wibon', 'applied'], expected: true },
      ],
    },
  }),
  buildCommonScenario('CODEX-TEST-08', 'WIPON enabled', {
    vessel: {
      imo: '7000008',
      name: 'CODEX-TEST-08 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-08', 5),
      filePath: 'seed/codex-test-08/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-08', 11),
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'CARGO_COMPLETED',
        operation: null,
      },
    ],
    extraClauses: [
      {
        clauseType: 'wipon',
        rawText: 'WIPON enabled',
        parameters: { enabled: true },
      },
    ],
    expected: {
      usedLaytime: '1 days 00:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '6000.00',
      auditChecks: [
        { path: ['wipon', 'applied'], expected: true },
        {
          path: ['wipon', 'limitation'],
          expected: 'Port-limit status is not currently modeled; timing is unchanged.',
        },
      ],
    },
  }),
  buildCommonScenario('CODEX-TEST-09', 'Mixed operation evidence', {
    vessel: {
      imo: '7000009',
      name: 'CODEX-TEST-09 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Discharge',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-09', 5),
      filePath: 'seed/codex-test-09/sof.txt',
      operation: 'Discharge',
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-09', 11),
        eventTime: new Date('2026-03-05T00:00:00Z'),
        eventType: 'LOADING_COMPLETED',
        operation: 'Loading',
      },
      {
        id: seedUuid('CODEX-TEST-09', 12),
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'DISCHARGE_COMPLETED',
        operation: 'Discharge',
      },
    ],
    expected: {
      usedLaytime: '1 days 00:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '6000.00',
      warningIncludes: [
        'SOF contains both Loading and Discharge operation-specific completion events. Calculation used the voyage laytimeOperation to select the applicable completion evidence.',
      ],
      auditChecks: [
        {
          path: ['operationSelection', 'mixedOperationEvidence'],
          expected: true,
        },
        {
          path: ['operationSelection', 'includedCompletionEventIds'],
          expected: [seedUuid('CODEX-TEST-09', 12)],
        },
        {
          path: ['operationSelection', 'excludedCompletionEventIds'],
          expected: [seedUuid('CODEX-TEST-09', 11)],
        },
      ],
    },
  }),
  buildCommonScenario('CODEX-TEST-10', 'Legacy compatibility', {
    vessel: {
      imo: '7000010',
      name: 'CODEX-TEST-10 Vessel',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    },
    voyage: {
      cargoQuantity: '20000.00',
      cargoType: 'Crude Oil',
      loadPort: 'USNOL',
      dischargePort: 'SGSIN',
      laycanStart: '2026-03-01',
      laycanEnd: '2026-03-31',
      laytimeOperation: 'Loading',
      laytimeAllowed: 48,
      demurrageRate: 12000,
      dispatchRate: 6000,
      timeCountingBasis: 'SHINC',
      norNoticePeriod: '6 hours',
    },
    nor: {
      tenderTime: new Date('2026-03-04T00:00:00Z'),
      acceptedTime: new Date('2026-03-04T00:00:00Z'),
    },
    sofDocument: {
      id: seedUuid('CODEX-TEST-10', 5),
      filePath: 'seed/codex-test-10/sof.txt',
      operation: null,
      status: 'Final',
    },
    sofEvents: [
      {
        id: seedUuid('CODEX-TEST-10', 11),
        eventTime: new Date('2026-03-05T06:00:00Z'),
        eventType: 'LOADING_COMPLETED',
        operation: null,
      },
    ],
    expected: {
      usedLaytime: '1 days 00:00:00',
      demurrageAmount: '0.00',
      despatchAmount: '6000.00',
      warningIncludes: [
        'Legacy unscoped SOF evidence was used because no operation-matching SOF document existed for the voyage laytime operation.',
      ],
      auditChecks: [
        {
          path: ['sofDocumentSelection', 'legacyNullDocumentIds'],
          expected: [seedUuid('CODEX-TEST-10', 5)],
        },
      ],
    },
  }),
];

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isSameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right));
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeJson((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function buildFullText(scenario: ScenarioDefinition): string {
  return [
    scenario.label,
    `Voyage reference: ${scenario.reference}`,
    `Laytime operation: ${scenario.voyage.laytimeOperation}`,
    `Laytime allowed: ${scenario.voyage.laytimeAllowed}h`,
    `Demurrage: $${scenario.voyage.demurrageRate.toLocaleString()}/day`,
    `Dispatch: $${scenario.voyage.dispatchRate.toLocaleString()}/day`,
    `Time counting basis: ${scenario.voyage.timeCountingBasis}`,
    `NOR notice: ${scenario.voyage.norNoticePeriod}`,
  ].join('\n');
}

async function main(): Promise<void> {
  process.env.DB_ENABLED = process.env.DB_ENABLED ?? 'true';
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';

  const { AppModule } = require('../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    const vesselRepo = app.get<Repository<Vessel>>(getRepositoryToken(Vessel));
    const voyageRepo = app.get<Repository<Voyage>>(getRepositoryToken(Voyage));
    const charterPartyRepo = app.get<Repository<CharterParty>>(
      getRepositoryToken(CharterParty),
    );
    const cpClauseRepo = app.get<Repository<CpClause>>(getRepositoryToken(CpClause));
    const norRepo = app.get<Repository<NorDocument>>(getRepositoryToken(NorDocument));
    const sofDocumentRepo = app.get<Repository<SofDocument>>(
      getRepositoryToken(SofDocument),
    );
    const sofEventRepo = app.get<Repository<SofEvent>>(getRepositoryToken(SofEvent));
    const calculationRepo = app.get<Repository<LaytimeCalculation>>(
      getRepositoryToken(LaytimeCalculation),
    );
    const voyagesService = app.get(VoyagesService);
    const charterPartiesService = app.get(CharterPartiesService);
    const sofDocumentsService = app.get(SofDocumentsService);
    const calculationsService = app.get(LaytimeCalculationsService);

    const results: Array<Record<string, unknown>> = [];

    for (const scenario of scenarios) {
      logger.log(`Starting ${scenario.reference}`);
      const result = await seedScenario({
        scenario,
        vesselRepo,
        voyageRepo,
        charterPartyRepo,
        cpClauseRepo,
        norRepo,
        sofDocumentRepo,
        sofEventRepo,
        calculationRepo,
        voyagesService,
        charterPartiesService,
        sofDocumentsService,
        calculationsService,
      });
      results.push(result);
    }

    logger.log(`Seeded or verified ${results.length} CODEX test voyages.`);
    for (const result of results) {
      logger.log(toJson(result));
    }
  } finally {
    await app.close();
  }
}

async function seedScenario(deps: {
  scenario: ScenarioDefinition;
  vesselRepo: Repository<Vessel>;
  voyageRepo: Repository<Voyage>;
  charterPartyRepo: Repository<CharterParty>;
  cpClauseRepo: Repository<CpClause>;
  norRepo: Repository<NorDocument>;
  sofDocumentRepo: Repository<SofDocument>;
  sofEventRepo: Repository<SofEvent>;
  calculationRepo: Repository<LaytimeCalculation>;
  voyagesService: VoyagesService;
  charterPartiesService: CharterPartiesService;
  sofDocumentsService: SofDocumentsService;
  calculationsService: LaytimeCalculationsService;
}): Promise<Record<string, unknown>> {
  const {
    scenario,
    vesselRepo,
    voyageRepo,
    charterPartyRepo,
    cpClauseRepo,
    norRepo,
    sofDocumentRepo,
    sofEventRepo,
    calculationRepo,
    voyagesService,
    charterPartiesService,
    sofDocumentsService,
    calculationsService,
  } = deps;

  const vessel = await ensureVessel(vesselRepo, scenario);
  const voyage = await ensureVoyage(voyageRepo, vessel.id, scenario);
  const charterParty = await ensureCharterPartyAndClauses(
    charterPartyRepo,
    cpClauseRepo,
    voyageRepo,
    voyage,
    scenario,
  );
  await ensureNor(norRepo, voyage.id, scenario);
  const sofDocument = await ensureSofDocument(sofDocumentRepo, voyage.id, scenario);
  await ensureSofEvents(sofEventRepo, sofDocument.id, scenario);

  const existingCalculations = await calculationsService.findForVoyage(voyage.id, {
    page: 1,
    skip: 0,
    limit: 1,
  } as never);

  let calculation = existingCalculations.data[0] ?? null;
  const createdNow = !calculation;
  if (!calculation) {
    const result = await calculationsService.calculate(voyage.id);
    calculation = result.calculation;
  }

  await calculationRepo.update(calculation.id, {
    calculatedAt: scenario.calculationTimestamp,
  });

  calculation = await calculationRepo.findOneOrFail({
    where: { id: calculation.id },
    relations: { periods: true },
  });

  await verifyScenario({
    scenario,
    vessel,
    voyage,
    charterParty,
    sofDocument,
    calculationsService,
    voyagesService,
    charterPartiesService,
    sofDocumentsService,
    calculation,
    createdNow,
  });

  return {
    reference: scenario.reference,
    voyageId: voyage.id,
    vesselId: vessel.id,
    charterPartyId: charterParty.id,
    sofDocumentId: sofDocument.id,
    calculationId: calculation.id,
    calculationVersion: calculation.version,
    calculationStatus: calculation.status,
    usedLaytime: calculation.usedLaytime,
    demurrageAmount: calculation.demurrageAmount,
    despatchAmount: calculation.despatchAmount,
    createdNow,
  };
}

async function ensureVessel(
  vesselRepo: Repository<Vessel>,
  scenario: ScenarioDefinition,
): Promise<Vessel> {
  const existing = await vesselRepo.findOne({ where: { imo: scenario.vessel.imo } });
  if (existing) {
    return existing;
  }

  return vesselRepo.save(
    vesselRepo.create({
      ...scenario.vessel,
      createdAt: scenario.voyageCreatedAt,
      updatedAt: scenario.voyageUpdatedAt,
    }),
  );
}

async function ensureVoyage(
  voyageRepo: Repository<Voyage>,
  vesselId: string,
  scenario: ScenarioDefinition,
): Promise<Voyage> {
  const existing = await voyageRepo.findOne({
    where: { reference: scenario.reference },
    relations: { charterParty: { clauses: true } },
  });

  if (existing) {
    assertScenarioVoyage(existing, scenario);
    return existing;
  }

  const voyage = await voyageRepo.save(
    voyageRepo.create({
      organizationId: DEFAULT_ORGANIZATION_ID,
      reference: scenario.reference,
      vesselId,
      cargoQuantity: scenario.voyage.cargoQuantity,
      cargoQuantityUnit: 'MT',
      cargoType: scenario.voyage.cargoType,
      loadPort: scenario.voyage.loadPort,
      dischargePort: scenario.voyage.dischargePort,
      laycanStart: scenario.voyage.laycanStart,
      laycanEnd: scenario.voyage.laycanEnd,
      eta: new Date(`${scenario.voyage.laycanStart}T00:00:00Z`),
      laytimeOperation: scenario.voyage.laytimeOperation,
      calculationTimeZone: 'UTC',
      notes: scenario.label,
      status: 'Active',
      createdAt: scenario.voyageCreatedAt,
      updatedAt: scenario.voyageUpdatedAt,
    }),
  );

  return voyageRepo.findOneOrFail({
    where: { id: voyage.id },
    relations: { charterParty: { clauses: true } },
  });
}

async function ensureCharterPartyAndClauses(
  charterPartyRepo: Repository<CharterParty>,
  cpClauseRepo: Repository<CpClause>,
  voyageRepo: Repository<Voyage>,
  voyage: Voyage,
  scenario: ScenarioDefinition,
): Promise<CharterParty> {
  const existing = await charterPartyRepo.findOne({
    where: { voyageId: voyage.id },
    relations: { clauses: true },
  });

  if (existing) {
    assertScenarioCharterParty(existing, scenario);
    return existing;
  }

  const charterParty = await charterPartyRepo.save(
    charterPartyRepo.create({
      voyageId: voyage.id,
      formType: 'Pre-ops draft',
      fullText: buildFullText(scenario),
      effectiveDate: scenario.voyage.laycanStart,
      laytimeAllowed: scenario.voyage.laytimeAllowed,
      demurrageRate: scenario.voyage.demurrageRate.toFixed(2),
      dispatchRate: scenario.voyage.dispatchRate.toFixed(2),
      timeCountingBasis: scenario.voyage.timeCountingBasis,
      norNoticePeriod: scenario.voyage.norNoticePeriod,
      createdAt: scenario.charterCreatedAt,
    }),
  );

  await voyageRepo.update(voyage.id, { charterPartyId: charterParty.id });

  const normalized = normalizeCommercialTermsToClauses({
    id: charterParty.id,
    laytimeAllowed: scenario.voyage.laytimeAllowed,
    demurrageRate: scenario.voyage.demurrageRate,
    dispatchRate: scenario.voyage.dispatchRate,
    timeCountingBasis: scenario.voyage.timeCountingBasis,
    norNoticePeriod: scenario.voyage.norNoticePeriod,
  });

  for (const clause of normalized) {
    await cpClauseRepo.save(
      cpClauseRepo.create({
        charterPartyId: charterParty.id,
        clauseType: clause.clauseType,
        rawText: clause.rawText,
        parameters: clause.parameters,
      }),
    );
  }

  await ensureExtraClauses(cpClauseRepo, charterParty.id, scenario.extraClauses);

  return charterPartyRepo.findOneOrFail({
    where: { id: charterParty.id },
    relations: { clauses: true },
  });
}

async function ensureExtraClauses(
  cpClauseRepo: Repository<CpClause>,
  charterPartyId: string,
  extraClauses: ScenarioDefinition['extraClauses'],
): Promise<void> {
  const existing = await cpClauseRepo.find({
    where: { charterPartyId },
  });

  for (const clause of extraClauses) {
    const found = existing.find((item) => item.clauseType === clause.clauseType);
    if (found) {
      if (found.rawText !== clause.rawText || !isSameJson(found.parameters, clause.parameters)) {
        throw new Error(
          `Existing extra clause ${found.id} does not match the expected ${clause.clauseType} seed data.`,
        );
      }
      continue;
    }

    await cpClauseRepo.save(
      cpClauseRepo.create({
        charterPartyId,
        clauseType: clause.clauseType,
        rawText: clause.rawText,
        parameters: clause.parameters,
      }),
    );
  }
}

async function ensureNor(
  norRepo: Repository<NorDocument>,
  voyageId: string,
  scenario: ScenarioDefinition,
): Promise<NorDocument> {
  const existing = await norRepo.findOne({
    where: {
      voyageId,
      tenderTime: scenario.nor.tenderTime,
    },
  });

  if (existing) {
    return existing;
  }

  return norRepo.save(
    norRepo.create({
      voyageId,
      filePath: `seed/${scenario.reference.toLowerCase()}/nor.txt`,
      tenderTime: scenario.nor.tenderTime,
      acceptedTime: scenario.nor.acceptedTime,
    }),
  );
}

async function ensureSofDocument(
  sofDocumentRepo: Repository<SofDocument>,
  voyageId: string,
  scenario: ScenarioDefinition,
): Promise<SofDocument> {
  const existing = await sofDocumentRepo.findOne({
    where: {
      id: scenario.sofDocument.id,
    },
  });

  if (existing) {
    if (existing.operation !== scenario.sofDocument.operation || existing.status !== scenario.sofDocument.status || existing.filePath !== scenario.sofDocument.filePath) {
      throw new Error(
        `Existing SOF document ${existing.id} on ${scenario.reference} does not match the expected seed data.`,
      );
    }
    return existing;
  }

  const existingByPath = await sofDocumentRepo.findOne({
    where: {
      voyageId,
      filePath: scenario.sofDocument.filePath,
    },
  });

  if (existingByPath) {
    if (
      existingByPath.operation !== scenario.sofDocument.operation ||
      existingByPath.status !== scenario.sofDocument.status ||
      existingByPath.filePath !== scenario.sofDocument.filePath
    ) {
      throw new Error(
        `Existing SOF document ${existingByPath.id} on ${scenario.reference} does not match the expected seed data.`,
      );
    }
    return existingByPath;
  }

  return sofDocumentRepo.save(
    sofDocumentRepo.create({
      id: scenario.sofDocument.id,
      voyageId,
      filePath: scenario.sofDocument.filePath,
      uploadDate: scenario.documentUploadDate,
      status: scenario.sofDocument.status,
      operation: scenario.sofDocument.operation,
    }),
  );
}

async function ensureSofEvents(
  sofEventRepo: Repository<SofEvent>,
  sofId: string,
  scenario: ScenarioDefinition,
): Promise<void> {
  for (const event of scenario.sofEvents) {
    const existing = await sofEventRepo.findOne({
      where: {
        id: event.id,
      },
    });

    if (existing) {
      continue;
    }

    const existingByNaturalKey = await sofEventRepo.findOne({
      where: {
        sofId,
        eventTime: event.eventTime,
        eventType: event.eventType,
        operation: event.operation === null ? IsNull() : event.operation,
      },
    });

    if (existingByNaturalKey) {
      continue;
    }

    await sofEventRepo.save(
      sofEventRepo.create({
        id: event.id,
        sofId,
        eventTime: event.eventTime,
        eventType: event.eventType,
        operation: event.operation,
        remarks: `${scenario.reference} seed event`,
        confidenceScore: null,
        isManualOverride: false,
        overrideReason: null,
        createdAt: scenario.documentUploadDate,
      }),
    );
  }
}

async function verifyScenario(deps: {
  scenario: ScenarioDefinition;
  vessel: Vessel;
  voyage: Voyage;
  charterParty: CharterParty;
  sofDocument: SofDocument;
  calculationsService: LaytimeCalculationsService;
  voyagesService: VoyagesService;
  charterPartiesService: CharterPartiesService;
  sofDocumentsService: SofDocumentsService;
  calculation: LaytimeCalculation;
  createdNow: boolean;
}): Promise<void> {
  const {
    scenario,
    voyage,
    charterParty,
    sofDocument,
    calculationsService,
    voyagesService,
    charterPartiesService,
    sofDocumentsService,
    calculation,
    createdNow,
  } = deps;

  const voyageRecord = await voyagesService.findOne(voyage.id);
  const summary = await voyagesService.findSummary(voyage.id);
  const charterPartyRecord = await charterPartiesService.findForVoyage(voyage.id);
  const sofPage = await sofDocumentsService.findForVoyage(voyage.id, {
    page: 1,
    skip: 0,
    limit: 10,
  } as never);
  const sofEventPage = await sofDocumentsService.findEvents(sofDocument.id, {
    page: 1,
    skip: 0,
    limit: 20,
  } as never);
  const calculationPage = await calculationsService.findForVoyage(voyage.id, {
    page: 1,
    skip: 0,
    limit: 10,
  } as never);
  const audit = await calculationsService.getAudit(calculation.id);

  assertValue(
    voyageRecord.id === voyage.id,
    scenario.reference,
    'voyage fetch failed',
  );
  assertValue(
    summary.latestCalculation?.id === calculation.id,
    scenario.reference,
    'voyage summary did not expose the expected latest calculation',
  );
  assertValue(
    charterPartyRecord.id === charterParty.id,
    scenario.reference,
    'charter party fetch failed',
  );
  assertValue(
    sofPage.data.some((document) => document.id === sofDocument.id),
    scenario.reference,
    'SOF document fetch did not return the seeded document',
  );
  assertValue(
    sofEventPage.data.length === scenario.sofEvents.length,
    scenario.reference,
    'SOF event fetch did not return the expected number of events',
  );
  assertValue(
    calculationPage.data.some((item) => item.id === calculation.id),
    scenario.reference,
    'latest parent calculation query did not return the seeded calculation',
  );
  assertValue(
    audit.inputs !== null && audit.decisions !== null,
    scenario.reference,
    'calculation audit snapshots are missing',
  );
  assertValue(
    calculation.parentCalculationId === null,
    scenario.reference,
    'calculation parentCalculationId is not null',
  );
  assertValue(
    calculation.operation === null,
    scenario.reference,
    'calculation operation is not null',
  );
  assertValue(
    calculation.usedLaytime === scenario.expected.usedLaytime,
    scenario.reference,
    `used laytime mismatch: expected ${scenario.expected.usedLaytime}, got ${calculation.usedLaytime}`,
  );
  assertValue(
    calculation.demurrageAmount === scenario.expected.demurrageAmount,
    scenario.reference,
    `demurrage amount mismatch: expected ${scenario.expected.demurrageAmount}, got ${calculation.demurrageAmount}`,
  );
  assertValue(
    calculation.despatchAmount === scenario.expected.despatchAmount,
    scenario.reference,
    `despatch amount mismatch: expected ${scenario.expected.despatchAmount}, got ${calculation.despatchAmount}`,
  );

  const warnings = calculation.warnings ?? [];
  for (const warning of scenario.expected.warningIncludes ?? []) {
    assertValue(
      warnings.includes(warning),
      scenario.reference,
      `missing expected warning: ${warning}`,
    );
  }
  for (const warning of scenario.expected.warningExcludes ?? []) {
    assertValue(
      !warnings.includes(warning),
      scenario.reference,
      `unexpected warning present: ${warning}`,
    );
  }

  const inputSnapshot = audit.inputs as Record<string, unknown>;
  const decisionSnapshot = audit.decisions as Record<string, unknown>;
  for (const check of scenario.expected.auditChecks ?? []) {
    assertSnapshotPath(
      inputSnapshot,
      decisionSnapshot,
      check.path,
      check.expected,
      scenario.reference,
    );
  }

  logger.log(
    [
      scenario.reference,
      createdNow ? 'created' : 'reused',
      `used=${calculation.usedLaytime}`,
      `demurrage=${calculation.demurrageAmount}`,
      `despatch=${calculation.despatchAmount}`,
    ].join(' | '),
  );
}

function assertScenarioVoyage(voyage: Voyage, scenario: ScenarioDefinition): void {
  assertValue(
    voyage.vesselId.length > 0,
    scenario.reference,
    'voyage has no vessel',
  );
  assertValue(
    voyage.reference === scenario.reference,
    scenario.reference,
    'existing voyage reference mismatch',
  );
  assertValue(
    voyage.laytimeOperation === scenario.voyage.laytimeOperation,
    scenario.reference,
    'existing voyage laytime operation mismatch',
  );
}

function assertScenarioCharterParty(
  charterParty: CharterParty,
  scenario: ScenarioDefinition,
): void {
  assertValue(
    charterParty.voyageId !== undefined,
    scenario.reference,
    'existing charter party missing voyage relation',
  );
}

function assertSnapshotPath(
  inputSnapshot: Record<string, unknown>,
  decisionSnapshot: Record<string, unknown>,
  path: string[],
  expected: unknown,
  reference: string,
): void {
  const snapshot = path[0] === 'weatherWorking' || path[0] === 'demurrage' || path[0] === 'wibon' || path[0] === 'wipon'
    ? decisionSnapshot
    : inputSnapshot;
  let value: unknown = snapshot;
  for (const key of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `[${reference}] snapshot path ${path.join('.')} was missing`,
      );
    }
    value = (value as Record<string, unknown>)[key];
  }

  if (!isSameJson(value, expected)) {
    throw new Error(
      `[${reference}] snapshot path ${path.join('.')} mismatch.\nExpected: ${toJson(expected)}\nActual: ${toJson(value)}`,
    );
  }
}

function assertValue(
  condition: boolean,
  reference: string,
  message: string,
): void {
  if (!condition) {
    throw new Error(`[${reference}] ${message}`);
  }
}

function formatSeedError(error: unknown): string {
  if (error instanceof Error) {
    const parts = [`${error.name}: ${error.message}`];
    if (error.stack) {
      parts.push(error.stack);
    }
    return parts.join('\n');
  }

  return String(error);
}

void main().catch((error: unknown) => {
  console.error(formatSeedError(error));
  process.exitCode = 1;
});
