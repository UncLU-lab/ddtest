import { Injectable } from '@nestjs/common';
import { VesselsService } from '../vessels/vessels.service';
import { ListVesselsQueryDto } from '../vessels/dto/list-vessels-query.dto';
import { isSupportedSettlementCurrency } from '../currency/settlement-currency';

export const EXTRACTION_STATUSES = [
  'FOUND',
  'NOT_FOUND',
  'AMBIGUOUS',
  'UNSUPPORTED',
  'INVALID',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export interface ExtractedContractField {
  rawValue: string | null;
  normalizedValue: string | number | null;
  status: ExtractionStatus;
  sourceSnippet: string | null;
  warning?: string;
  vesselId?: string;
}

export interface ContractExtractionResult {
  fields: Record<string, ExtractedContractField>;
  warnings: string[];
}

type LabelDefinition = { field: string; labels: string[] };

const LABELS: LabelDefinition[] = [
  { field: 'voyageRef', labels: ['VOYAGE REFERENCE', 'VOYAGE REF', 'REFERENCE'] },
  { field: 'vessel', labels: ['VESSEL'] },
  { field: 'productType', labels: ['PRODUCT', 'PRODUCT TYPE'] },
  { field: 'quantity', labels: ['QUANTITY', 'QUANTITY MT'] },
  { field: 'eta', labels: ['ETA'] },
  { field: 'loadPort', labels: ['LOAD PORT', 'LOADING PORT'] },
  { field: 'dischargePort', labels: ['DISCHARGE PORT', 'DISCHARGING PORT'] },
  { field: 'supplier', labels: ['SUPPLIER'] },
  { field: 'receiver', labels: ['RECEIVER'] },
  { field: 'laycanOpen', labels: ['LAYCAN OPEN', 'LAYCAN START'] },
  { field: 'laycanClose', labels: ['LAYCAN CLOSE', 'LAYCAN END'] },
  { field: 'laytimeAllowed', labels: ['LAYTIME ALLOWED'] },
  { field: 'loadingLaytimeAllowed', labels: ['LOADING LAYTIME ALLOWED', 'LOADING LAYTIME ALLOWANCE'] },
  { field: 'dischargeLaytimeAllowed', labels: ['DISCHARGE LAYTIME ALLOWED', 'DISCHARGE LAYTIME ALLOWANCE'] },
  { field: 'demurrageRate', labels: ['DEMURRAGE RATE'] },
  { field: 'dispatchRate', labels: ['DESPATCH RATE', 'DISPATCH RATE'] },
  { field: 'timeCountingBasis', labels: ['COUNTING BASIS', 'TIME COUNTING BASIS'] },
  { field: 'norNoticePeriod', labels: ['NOR NOTICE', 'NOR NOTICE PERIOD'] },
  { field: 'laytimeOperation', labels: ['LAYTIME OPERATION'] },
  { field: 'bulkOperationType', labels: ['BULK OPERATION TYPE'] },
  { field: 'settlementCurrency', labels: ['SETTLEMENT CURRENCY'] },
  { field: 'laytimeOperationScope', labels: ['LAYTIME APPLIES TO'] },
  { field: 'reversibleLaytime', labels: ['REVERSIBLE LAYTIME'] },
  { field: 'reversibleSettlementVersion', labels: ['REVERSIBLE SETTLEMENT VERSION'] },
  { field: 'reversibleAllowanceMode', labels: ['REVERSIBLE ALLOWANCE MODE'] },
];

@Injectable()
export class ContractExtractionsService {
  constructor(private readonly vessels: VesselsService) {}

  async parseText(sourceText: string): Promise<ContractExtractionResult> {
    const values = readExplicitLabels(sourceText);
    const vesselQuery = new ListVesselsQueryDto();
    vesselQuery.limit = 200;
    const vessels = (await this.vessels.findAll(vesselQuery)).data;
    const fields: Record<string, ExtractedContractField> = {};

    for (const definition of LABELS) {
      const match = values.get(definition.field);
      fields[definition.field] = match
        ? this.normalize(definition.field, match.value, match.snippet, vessels)
        : notFound();
    }

    validateReversibleFields(fields);

    return { fields, warnings: Object.values(fields).flatMap((field) => field.warning ?? []) };
  }

  private normalize(
    field: string,
    rawValue: string,
    sourceSnippet: string,
    vessels: Array<{ id: string; name: string }>,
  ): ExtractedContractField {
    const text = rawValue.trim();
    switch (field) {
      case 'vessel': {
        const matches = vessels.filter((vessel) => vessel.name.toLowerCase() === text.toLowerCase());
        if (matches.length === 1) return found(text, matches[0].name, sourceSnippet, { vesselId: matches[0].id });
        return invalid(text, sourceSnippet, matches.length ? 'Multiple tenant-visible vessels match this name.' : 'No tenant-visible vessel exactly matches this name.');
      }
      case 'productType': {
        const product = ['LNG', 'LPG', 'Crude', 'Products'].find((candidate) => candidate.toLowerCase() === text.toLowerCase());
        return product ? found(text, product, sourceSnippet) : unsupported(text, sourceSnippet, 'Product must be LNG, LPG, Crude, or Products.');
      }
      case 'quantity': return numeric(text, sourceSnippet, /\b(MT|TONNES?|METRIC TONS?)\b/i.test(text) ? undefined : 'Quantity unit was not recognised; review before applying.');
      case 'laytimeAllowed':
      case 'loadingLaytimeAllowed':
      case 'dischargeLaytimeAllowed':
        return hours(text, sourceSnippet);
      case 'demurrageRate':
      case 'dispatchRate': return numeric(text, sourceSnippet);
      case 'eta':
      case 'laycanOpen':
      case 'laycanClose': return date(text, sourceSnippet);
      case 'loadPort':
      case 'dischargePort': return /^[A-Z]{5,10}$/i.test(text) ? found(text, text.toUpperCase(), sourceSnippet) : invalid(text, sourceSnippet, 'Backend requires an accepted 5–10 character port code.');
      case 'timeCountingBasis': {
        const basis = text.toUpperCase();
        return ['SHINC', 'SHEX', 'WWD', 'CQD', '6H SHINC'].includes(basis) ? found(text, basis === '6H SHINC' ? '6h SHINC' : basis, sourceSnippet) : unsupported(text, sourceSnippet, 'Counting basis is not supported by the current form.');
      }
      case 'norNoticePeriod': {
        if (text.toLowerCase() === 'immediate') return found(text, 'Immediate', sourceSnippet);
        const match = text.match(/^(\d+(?:\.\d+)?)\s*(?:H|HRS?|HOURS?)$/i);
        return match ? found(text, `${match[1]} hours`, sourceSnippet) : invalid(text, sourceSnippet, 'NOR notice must be Immediate or a number of hours.');
      }
      case 'laytimeOperation': return /^loading$/i.test(text) ? found(text, 'Loading', sourceSnippet) : /^discharge$/i.test(text) ? found(text, 'Discharge', sourceSnippet) : unsupported(text, sourceSnippet, 'Laytime operation must be Loading or Discharge.');
      case 'bulkOperationType': return /^(dry[ _-]?bulk)$/i.test(text) ? found(text, 'dry_bulk', sourceSnippet) : /^(tanker|liquid[ _-]?bulk)$/i.test(text) ? found(text, 'tanker', sourceSnippet) : unsupported(text, sourceSnippet, 'Bulk operation type must be dry_bulk or tanker.');
      case 'settlementCurrency': {
        const currency = text.toUpperCase();
        return isSupportedSettlementCurrency(currency) ? found(text, currency, sourceSnippet) : invalid(text, sourceSnippet, 'Settlement currency must be a supported ISO 4217 code.');
      }
      case 'laytimeOperationScope': {
        const scope = text.replace(/[ _-]+/g, ' ').trim().toUpperCase();
        if (scope === 'LOADING') return found(text, 'Loading', sourceSnippet);
        if (scope === 'DISCHARGE') return found(text, 'Discharge', sourceSnippet);
        if (scope === 'LOADING AND DISCHARGE') return found(text, 'LoadingAndDischarge', sourceSnippet);
        return invalid(text, sourceSnippet, 'Laytime applies to must be Loading, Discharge, or Loading and Discharge.');
      }
      case 'reversibleLaytime':
        return /^enabled$/i.test(text) ? found(text, 'Enabled', sourceSnippet) : /^disabled$/i.test(text) ? found(text, 'Disabled', sourceSnippet) : invalid(text, sourceSnippet, 'Reversible laytime must be ENABLED or DISABLED.');
      case 'reversibleSettlementVersion':
        return text.trim() === '1' ? found(text, 1, sourceSnippet) : unsupported(text, sourceSnippet, 'Only reversible settlement version 1 is supported.');
      case 'reversibleAllowanceMode':
        return /^sum[ _-]?operation[ _-]?allowances$/i.test(text) ? found(text, 'sum_operation_allowances', sourceSnippet) : unsupported(text, sourceSnippet, 'Only sum_operation_allowances is supported.');
      default: return found(text, text, sourceSnippet);
    }
  }
}

function readExplicitLabels(sourceText: string): Map<string, { value: string; snippet: string }> {
  const output = new Map<string, { value: string; snippet: string }>();
  for (const line of sourceText.split(/\r?\n/)) {
    const match = /^\s*([^:]+?)\s*:\s*(.*?)\s*$/.exec(line);
    if (!match || !match[2]) continue;
    const label = match[1].replace(/\s+/g, ' ').trim().toUpperCase();
    const definition = LABELS.find((item) => item.labels.includes(label));
    if (definition && !output.has(definition.field)) output.set(definition.field, { value: match[2].trim(), snippet: line.trim() });
  }
  return output;
}

function found(rawValue: string, normalizedValue: string | number, sourceSnippet: string, extra: Partial<ExtractedContractField> = {}): ExtractedContractField {
  return { rawValue, normalizedValue, status: 'FOUND', sourceSnippet, ...extra };
}
function notFound(): ExtractedContractField { return { rawValue: null, normalizedValue: null, status: 'NOT_FOUND', sourceSnippet: null }; }
function invalid(rawValue: string, sourceSnippet: string, warning: string): ExtractedContractField { return { rawValue, normalizedValue: null, status: 'INVALID', sourceSnippet, warning }; }
function unsupported(rawValue: string, sourceSnippet: string, warning: string): ExtractedContractField { return { rawValue, normalizedValue: null, status: 'UNSUPPORTED', sourceSnippet, warning }; }
function numeric(rawValue: string, sourceSnippet: string, warning?: string): ExtractedContractField {
  const match = rawValue.replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
  if (!match || !Number.isFinite(Number(match[0]))) return invalid(rawValue, sourceSnippet, 'A numeric value is required.');
  return { rawValue, normalizedValue: Number(match[0]), status: 'FOUND', sourceSnippet, ...(warning ? { warning } : {}) };
}
function hours(rawValue: string, sourceSnippet: string): ExtractedContractField {
  const result = numeric(rawValue, sourceSnippet);
  if (result.status !== 'FOUND') return result;
  return /\b(H|HRS?|HOURS?)\b/i.test(rawValue) ? result : invalid(rawValue, sourceSnippet, 'Laytime must state hours in V1.');
}
function date(rawValue: string, sourceSnippet: string): ExtractedContractField {
  const value = rawValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return invalid(rawValue, sourceSnippet, 'Date must be a valid YYYY-MM-DD value.');
  return found(rawValue, value, sourceSnippet);
}

function validateReversibleFields(fields: Record<string, ExtractedContractField>): void {
  if (fields.reversibleLaytime?.normalizedValue !== 'Enabled' || fields.reversibleLaytime.status !== 'FOUND') {
    return;
  }
  const version = fields.reversibleSettlementVersion;
  const mode = fields.reversibleAllowanceMode;
  if (version?.status === 'FOUND' && mode?.status === 'FOUND') {
    return;
  }
  fields.reversibleLaytime = {
    ...fields.reversibleLaytime,
    normalizedValue: null,
    status: 'INVALID',
    warning: 'Enabled reversible laytime requires settlement version 1 and sum_operation_allowances.',
  };
}
