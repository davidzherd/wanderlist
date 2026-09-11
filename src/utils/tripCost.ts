import { convert, type RateTable } from '../api/exchangeRates'
import type { TripItem } from '../types/trip'

export interface CostSummary {
  /** Sum of every priced item, converted into the home currency. */
  total: number
  /** True when at least one item carries a price (so a total is worth showing at all). */
  hasPricedItems: boolean
  /**
   * True when at least one priced item couldn't be converted — no rate table loaded, or its
   * currency wasn't in the table. Those items are excluded from `total`, so the UI should flag it
   * as approximate/incomplete rather than presenting a confident number.
   */
  hasUnconverted: boolean
}

/**
 * Totals a list of trip items into `home` currency using `table`. An item's currency is its own
 * `currency` override, or `home` when unset (the trip default). When `table` is null (rates
 * unavailable and no cache), nothing converts and `hasUnconverted` flags it — callers then show
 * native per-item amounts instead of a single total.
 */
export function summarizeCost(items: TripItem[], home: string, table: RateTable | null): CostSummary {
  let total = 0
  let hasPricedItems = false
  let hasUnconverted = false

  for (const item of items) {
    if (item.price == null) continue
    hasPricedItems = true
    const currency = item.currency ?? home
    if (!table) {
      hasUnconverted = true
      continue
    }
    const converted = convert(item.price, currency, table)
    if (converted == null) {
      hasUnconverted = true
      continue
    }
    total += converted
  }

  return { total, hasPricedItems, hasUnconverted }
}
