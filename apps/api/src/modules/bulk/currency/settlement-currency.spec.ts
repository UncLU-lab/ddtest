import {
  isSupportedSettlementCurrency,
  SUPPORTED_SETTLEMENT_CURRENCIES,
} from './settlement-currency';

describe('settlement currency', () => {
  it.each(['USD', 'EUR', 'AUD', 'GBP', 'SGD', 'JPY', 'CNY', 'HKD', 'CAD', 'AED'])(
    'accepts supported ISO 4217 code %s',
    (currency) => expect(isSupportedSettlementCurrency(currency)).toBe(true),
  );

  it.each(['usd', 'ZZZ', 'US', 'USDD', '123', '', null, undefined, 123])(
    'rejects malformed or unsupported value %p',
    (currency) => expect(isSupportedSettlementCurrency(currency)).toBe(false),
  );

  it('uses a stable duplicate-free uppercase code set', () => {
    expect(new Set(SUPPORTED_SETTLEMENT_CURRENCIES).size).toBe(
      SUPPORTED_SETTLEMENT_CURRENCIES.length,
    );
    expect(
      SUPPORTED_SETTLEMENT_CURRENCIES.every((code) => /^[A-Z]{3}$/.test(code)),
    ).toBe(true);
  });
});
