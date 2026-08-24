import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { COMMERCIAL_CLAUSE_OPERATIONS } from '../../charter-party-terms';
import { isValidShexClauseForWrite } from '../../laytime/shex-calendar';

const DESPATCH_TIME_BASES = ['all_time_saved', 'working_time_saved'] as const;
const NOR_WORKING_DAYS = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
] as const;
const NOR_CUTOFF_REFERENCES = ['tenderTime', 'acceptedTime'] as const;

@ValidatorConstraint({ name: 'cpClauseParameters', async: false })
export class CpClauseParametersConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    const clauseType = (args.object as Record<string, unknown> | undefined)
      ?.clauseType;

    return areCpClauseParametersValid(clauseType, value);
  }

  defaultMessage(args: ValidationArguments): string {
    const clauseType = (args.object as Record<string, unknown> | undefined)
      ?.clauseType;

    return cpClauseParametersValidationMessage(clauseType, args.property);
  }
}

export function areCpClauseParametersValid(
  clauseType: unknown,
  value: unknown,
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const operation = (value as Record<string, unknown>).operation;
  const timeBasis = (value as Record<string, unknown>).timeBasis;

  if (clauseType === 'nor_commencement_schedule') {
    const parameters = value as Record<string, unknown>;
    return (
      isNorCutoffReference(parameters.cutoffReference) &&
      isStrictClockTime(parameters.tenderCutoffTime) &&
      isStrictClockTime(parameters.sameDayCommencementTime) &&
      isStrictClockTime(parameters.nextWorkingDayCommencementTime) &&
      isValidWorkingDays(parameters.workingDays) &&
      isValidIanaTimeZone(parameters.timeZone) &&
      operation === undefined
    );
  }

  if (clauseType === 'shex_shinc') {
    return isValidShexClauseForWrite(value as Record<string, unknown>);
  }

  if (clauseType === 'reversible_laytime' || clauseType === 'atutc') {
    if (clauseType === 'reversible_laytime') {
      const parameters = value as Record<string, unknown>;
      return (
        typeof parameters.enabled === 'boolean' &&
        operation === undefined &&
        (parameters.enabled === false ||
          (parameters.settlementVersion === 1 &&
            parameters.allowanceMode === 'sum_operation_allowances'))
      );
    }
    return (
      typeof (value as Record<string, unknown>).enabled === 'boolean' &&
      operation === undefined
    );
  }

  if (
    clauseType === 'wifpon' ||
    clauseType === 'wibon' ||
    clauseType === 'wipon'
  ) {
    return (
      typeof (value as Record<string, unknown>).enabled === 'boolean' &&
      isOptionalCommercialOperation(operation)
    );
  }

  if (
    clauseType === 'despatch' &&
    timeBasis !== undefined &&
    (!isDespatchTimeBasis(timeBasis) || typeof timeBasis !== 'string')
  ) {
    return false;
  }

  if (clauseType === 'laytime_rate' && !isValidAllowance(value as Record<string, unknown>)) {
    return false;
  }

  if (
    clauseType === 'demurrage_rate' &&
    !isValidNonNegativeRate(value as Record<string, unknown>, true)
  ) {
    return false;
  }

  if (clauseType === 'despatch' && !isValidDespatchPricing(value as Record<string, unknown>)) {
    return false;
  }

  if (operation === undefined || operation === null) {
    return true;
  }

  return (
    typeof operation === 'string' &&
    (COMMERCIAL_CLAUSE_OPERATIONS as readonly string[]).includes(operation)
  );
}

export function cpClauseParametersValidationMessage(
  clauseType: unknown,
  property = 'parameters',
): string {
  if (clauseType === 'reversible_laytime' || clauseType === 'atutc') {
    if (clauseType === 'reversible_laytime') {
      return `${property}.enabled must be a boolean; enabled Version 1 clauses require settlementVersion 1 and allowanceMode sum_operation_allowances; operation must be omitted`;
    }
    return `${property}.enabled must be a boolean and operation must be omitted for ${clauseType}`;
  }

  if (
    clauseType === 'wifpon' ||
    clauseType === 'wibon' ||
    clauseType === 'wipon'
  ) {
    return `${property}.enabled must be a boolean; parameters.operation must be Loading or Discharge when provided`;
  }

  if (clauseType === 'nor_commencement_schedule') {
    return `${property} must include cutoffReference as tenderTime or acceptedTime, tenderCutoffTime, sameDayCommencementTime, and nextWorkingDayCommencementTime as HH:MM strings, a non-empty unique workingDays array, and a valid IANA timeZone; operation must be omitted`;
  }

  if (clauseType === 'shex_shinc') {
    return `${property} must contain shex as a boolean; SHEX requires calendarVersion 1, a valid IANA timeZone, holidayDates as unique valid YYYY-MM-DD dates, and saturdayExcepted as a boolean; SHINC must omit SHEX calendar fields; parameters.operation must be Loading or Discharge when provided`;
  }

  if (clauseType === 'despatch') {
    return `${property}.timeBasis must be all_time_saved or working_time_saved when provided for despatch; parameters.operation must be Loading or Discharge when provided`;
  }

  return `${property}.operation must be Loading or Discharge when provided`;
}

const ALLOWANCE_KEYS = ['hours', 'days', 'rate', 'ratePerDay', 'rate_per_day'] as const;
const RATE_KEYS = ['rate', 'ratePerDay', 'rate_per_day', 'amount'] as const;

function isFiniteNumber(value: unknown, allowZero: boolean): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0)
  );
}

function isValidAllowance(parameters: Record<string, unknown>): boolean {
  const present = ALLOWANCE_KEYS.filter((key) => parameters[key] !== undefined);
  return present.length === 1 && isFiniteNumber(parameters[present[0]], false);
}

function isValidNonNegativeRate(
  parameters: Record<string, unknown>,
  required: boolean,
): boolean {
  const present = RATE_KEYS.filter((key) => parameters[key] !== undefined);
  if (present.length === 0) return !required;
  return present.length === 1 && isFiniteNumber(parameters[present[0]], true);
}

function isValidDespatchPricing(parameters: Record<string, unknown>): boolean {
  if (!isValidNonNegativeRate(parameters, false)) return false;
  const hasRate = RATE_KEYS.some((key) => parameters[key] !== undefined);
  const hasMultiplier = parameters.multiplier !== undefined;
  if (hasRate && hasMultiplier) return false;
  return !hasMultiplier || isFiniteNumber(parameters.multiplier, true);
}

export function IsCpClauseParameters(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: CpClauseParametersConstraint,
    });
  };
}

function isDespatchTimeBasis(
  value: unknown,
): value is (typeof DESPATCH_TIME_BASES)[number] {
  return (
    typeof value === 'string' &&
    (DESPATCH_TIME_BASES as readonly string[]).includes(value)
  );
}

function isOptionalCommercialOperation(operation: unknown): boolean {
  return (
    operation === undefined ||
    operation === null ||
    (typeof operation === 'string' &&
      (COMMERCIAL_CLAUSE_OPERATIONS as readonly string[]).includes(operation))
  );
}

function isStrictClockTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isNorCutoffReference(
  value: unknown,
): value is (typeof NOR_CUTOFF_REFERENCES)[number] {
  return (
    typeof value === 'string' &&
    (NOR_CUTOFF_REFERENCES as readonly string[]).includes(value)
  );
}

function isValidWorkingDays(
  value: unknown,
): value is Array<(typeof NOR_WORKING_DAYS)[number]> {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  if (
    !value.every(
      (day) =>
        typeof day === 'string' &&
        (NOR_WORKING_DAYS as readonly string[]).includes(day),
    )
  ) {
    return false;
  }

  return new Set(value).size === value.length;
}

function isValidIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  const isRegionIdentifier =
    /^[A-Za-z][A-Za-z0-9._+-]*(\/[A-Za-z0-9._+-]+)+$/.test(value);
  if (value !== 'UTC' && !isRegionIdentifier) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
