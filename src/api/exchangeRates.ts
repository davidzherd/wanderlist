// Foreign-exchange rates for trip cost totals. Uses Frankfurter (api.frankfurter.dev) — a free,
// keyless, CORS-enabled ECB rate feed — fetched once per calendar day and cached in localStorage so
// totals keep working offline afterward. Every path FAILS SOFT: a network error, non-2xx, or bad
// shape resolves to whatever is cached (or null), never throwing. Callers treat a null table as
// "can't total mixed currencies right now" and fall back to showing each price in its own currency.

const BASE_URL = 'https://api.frankfurter.dev/v1/latest'

export interface RateTable {
  /** Base currency the rates are expressed against (the trip's home currency). */
  base: string
  /** ECB reference date the rates are from (may lag on weekends). */
  date: string
  /** Units of each currency per 1 unit of `base`. Excludes `base` itself. */
  rates: Record<string, number>
}

interface CachedRates {
  fetchedOn: string // YYYY-MM-DD, the local calendar day we fetched — drives the daily refresh.
  table: RateTable
}

const cacheKey = (base: string) => `wanderlist:fx:${base}`
const todayIso = () => new Date().toISOString().slice(0, 10)

function readCache(base: string): CachedRates | null {
  try {
    const raw = localStorage.getItem(cacheKey(base))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRates
    if (parsed?.table?.rates && typeof parsed.fetchedOn === 'string') return parsed
  } catch {
    // Corrupt/blocked storage — treat as no cache.
  }
  return null
}

function writeCache(base: string, table: RateTable): void {
  try {
    localStorage.setItem(cacheKey(base), JSON.stringify({ fetchedOn: todayIso(), table } satisfies CachedRates))
  } catch {
    // Storage full/blocked — non-fatal, we just won't have a cache next time.
  }
}

/**
 * Returns the rate table for `base`, fetching at most once per day. On any failure, returns the last
 * cached table for that base if we have one, else null. Never throws.
 */
export async function getRates(base: string): Promise<RateTable | null> {
  const cached = readCache(base)
  if (cached && cached.fetchedOn === todayIso()) return cached.table

  try {
    const res = await fetch(`${BASE_URL}?base=${encodeURIComponent(base)}`)
    if (!res.ok) throw new Error(`FX request failed: ${res.status}`)
    const data = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> }
    if (!data.rates || typeof data.rates !== 'object' || !data.base || !data.date) {
      throw new Error('FX response shape unexpected')
    }
    const table: RateTable = { base: data.base, date: data.date, rates: data.rates }
    writeCache(base, table)
    return table
  } catch (err) {
    console.error(err)
    return cached?.table ?? null
  }
}

/**
 * Converts `amount` from currency `from` into the table's base currency.
 * Returns null when the rate is unavailable (currency not in the table), so callers can flag it as
 * un-totalable rather than silently dropping it. Base-to-base is a no-op.
 */
export function convert(amount: number, from: string, table: RateTable): number | null {
  if (from === table.base) return amount
  const rate = table.rates[from]
  if (!rate || !Number.isFinite(rate)) return null
  return amount / rate
}
