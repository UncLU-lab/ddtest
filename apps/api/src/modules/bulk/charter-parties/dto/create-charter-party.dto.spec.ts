import { validate } from 'class-validator';
import { CreateCharterPartyDto } from './create-charter-party.dto';

function dto(scope?: unknown): CreateCharterPartyDto {
  return Object.assign(new CreateCharterPartyDto(), {
    formType: 'GENCON 94',
    fullText: 'Contract terms',
    effectiveDate: '2026-01-01',
    ...(scope !== undefined ? { laytimeOperationScope: scope } : {}),
  });
}

describe('CreateCharterPartyDto laytimeOperationScope', () => {
  it.each(['Loading', 'Discharge', 'LoadingAndDischarge'])(
    'accepts %s',
    async (scope) => {
      await expect(validate(dto(scope))).resolves.toHaveLength(0);
    },
  );

  it('allows unresolved scope for draft creation compatibility', async () => {
    await expect(validate(dto())).resolves.toHaveLength(0);
  });

  it.each(['', 'Container', 'loading', [], ['Loading', 'Loading']])(
    'rejects unsupported scope %p',
    async (scope) => {
      const errors = await validate(dto(scope));
      expect(
        errors.some((error) => error.property === 'laytimeOperationScope'),
      ).toBe(true);
    },
  );
});

describe('CreateCharterPartyDto settlementCurrency', () => {
  const currencyDto = (settlementCurrency?: unknown) =>
    Object.assign(dto(),
      settlementCurrency === undefined ? {} : { settlementCurrency },
    );

  it.each(['USD', 'EUR', 'AUD'] as const)('accepts %s', async (currency) => {
    await expect(validate(currencyDto(currency))).resolves.toHaveLength(0);
  });

  it('allows currency to remain unresolved on drafts', async () => {
    await expect(validate(currencyDto())).resolves.toHaveLength(0);
    await expect(validate(currencyDto(null))).resolves.toHaveLength(0);
  });

  it.each(['usd', 'ZZZ', 'US', 'USDD', '', 123])(
    'rejects unsupported currency %p',
    async (currency) => {
      const errors = await validate(currencyDto(currency));
      expect(errors.some((error) => error.property === 'settlementCurrency')).toBe(true);
    },
  );
});
