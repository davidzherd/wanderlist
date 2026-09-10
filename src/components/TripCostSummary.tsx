import { Wallet } from 'lucide-react'
import type { TripItem } from '../types/trip'
import type { RateTable } from '../api/exchangeRates'
import type { ExchangeRatesStatus } from '../hooks/useExchangeRates'
import { formatMoney } from '../data/currencies'
import { summarizeCost } from '../utils/tripCost'

/**
 * Trip-wide cost total, converted into the home currency. Renders nothing when no item has a price.
 * When rates can't be loaded (offline + no cache) it shows a "rates unavailable" note instead of a
 * number; when some items converted and some didn't, it flags the total as partial.
 */
export function TripCostSummary({
  items,
  home,
  table,
  status,
}: {
  items: TripItem[]
  home: string
  table: RateTable | null
  status: ExchangeRatesStatus
}) {
  const { total, hasPricedItems, hasUnconverted } = summarizeCost(items, home, table)
  if (!hasPricedItems) return null

  return (
    <div className="flex items-center gap-1.5 text-sm text-ink/70 dark:text-mist-light/70">
      <Wallet size={14} className="shrink-0 text-harbor" />
      {status === 'loading' && !table ? (
        <span>Totalling…</span>
      ) : hasUnconverted && total === 0 ? (
        <span className="text-ink/50 dark:text-mist-light/50">
          Exchange rates unavailable — showing prices in their own currencies.
        </span>
      ) : (
        <span>
          Estimated total:{' '}
          <span className="font-semibold text-ink dark:text-mist-light">{formatMoney(total, home)}</span>
          {hasUnconverted && <span className="text-ink/50 dark:text-mist-light/50"> (partial)</span>}
        </span>
      )}
    </div>
  )
}
