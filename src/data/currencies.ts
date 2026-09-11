// Curated currency list for trip budgeting. Deliberately limited to the set the free Frankfurter/ECB
// exchange-rate API supports (see src/api/exchangeRates.ts), so any currency the user can pick is
// always convertible — no "can't convert this one" gaps. Expand both lists together if needed.

export const DEFAULT_CURRENCY = 'USD'

export interface CurrencyDef {
  code: string
  name: string
}

// ISO 4217 codes supported by Frankfurter (api.frankfurter.dev). Ordered roughly by traveller frequency.
export const CURRENCIES: CurrencyDef[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'ILS', name: 'Israeli New Shekel' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Złoty' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'ISK', name: 'Icelandic Króna' },
]

export const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code))

export function isSupportedCurrency(code: string | undefined | null): boolean {
  return Boolean(code && CURRENCY_CODES.has(code))
}

// Symbol lookups go through Intl so we never hand-maintain a symbol/decimals table — the platform
// already knows JPY has no decimals, that CAD renders "CA$", etc. Memoized since formatToParts on a
// fresh formatter isn't free and item rows re-render often.
const symbolCache = new Map<string, string>()

export function getCurrencySymbol(code: string): string {
  const cached = symbolCache.get(code)
  if (cached) return cached
  let symbol = code
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).formatToParts(0)
    symbol = parts.find((p) => p.type === 'currency')?.value ?? code
  } catch {
    // Unknown/invalid code — fall back to the raw code as its own "symbol".
  }
  symbolCache.set(code, symbol)
  return symbol
}

// Formats an amount in its own currency, e.g. formatMoney(1200, 'JPY') -> "¥1,200".
// Intl picks the right symbol and per-currency decimal places automatically.
export function formatMoney(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${getCurrencySymbol(code)}${amount.toLocaleString()}`
  }
}

// Compact label for the currency dropdown, e.g. "USD — US Dollar ($)".
export function currencyLabel(def: CurrencyDef): string {
  return `${def.code} — ${def.name} (${getCurrencySymbol(def.code)})`
}
