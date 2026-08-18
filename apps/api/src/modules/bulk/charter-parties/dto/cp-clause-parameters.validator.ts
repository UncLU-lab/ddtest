import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { COMMERCIAL_CLAUSE_OPERATIONS } from '../../charter-party-terms';

const DESPATCH_TIME_BASES = ['all_time_saved', 'working_time_saved'] as const;

@ValidatorConstraint({ name: 'cpClauseParameters', async: false })
export class CpClauseParametersConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const clauseType = (args.object as Record<string, unknown> | undefined)
      ?.clauseType;
    const operation = (value as Record<string, unknown>).operation;
    const timeBasis = (value as Record<string, unknown>).timeBasis;

    if (clauseType === 'reversible_laytime' || clauseType === 'atutc') {
      return (
        typeof (value as Record<string, unknown>).enabled === 'boolean' &&
        operation === undefined
      );
    }

    if (
      clauseType === 'despatch' &&
      timeBasis !== undefined &&
      (!isDespatchTimeBasis(timeBasis) ||
        typeof timeBasis !== 'string')
    ) {
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

  defaultMessage(args: ValidationArguments): string {
    const clauseType = (args.object as Record<string, unknown> | undefined)
      ?.clauseType;

    if (clauseType === 'reversible_laytime' || clauseType === 'atutc') {
      return `${args.property}.enabled must be a boolean and operation must be omitted for ${clauseType}`;
    }

    if (clauseType === 'despatch') {
      return `${args.property}.timeBasis must be all_time_saved or working_time_saved when provided for despatch; parameters.operation must be Loading or Discharge when provided`;
    }

    return `${args.property}.operation must be Loading or Discharge when provided`;
  }
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

function isDespatchTimeBasis(value: unknown): value is (typeof DESPATCH_TIME_BASES)[number] {
  return (
    typeof value === 'string' &&
    (DESPATCH_TIME_BASES as readonly string[]).includes(value)
  );
}
