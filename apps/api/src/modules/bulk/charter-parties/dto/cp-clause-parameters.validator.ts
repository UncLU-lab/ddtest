import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { COMMERCIAL_CLAUSE_OPERATIONS } from '../../charter-party-terms';

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

    if (clauseType === 'reversible_laytime' || clauseType === 'atutc') {
      return (
        typeof (value as Record<string, unknown>).enabled === 'boolean' &&
        operation === undefined
      );
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
