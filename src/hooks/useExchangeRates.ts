import { useEffect, useState } from 'react'
import { getRates, type RateTable } from '../api/exchangeRates'

export type ExchangeRatesStatus = 'loading' | 'ready' | 'failed'

/**
 * Loads the daily FX rate table for `base` (the trip's home currency), fail-soft: `status` is
 * 'failed' only when there's no table at all (fetch failed AND no cache). A ready table may still
 * be a stale cached one — that's fine for rough budgeting. Re-runs when `base` changes.
 */
export function useExchangeRates(base: string): { table: RateTable | null; status: ExchangeRatesStatus } {
  const [table, setTable] = useState<RateTable | null>(null)
  const [status, setStatus] = useState<ExchangeRatesStatus>('loading')

  useEffect(() => {
    let active = true
    setStatus('loading')
    getRates(base).then((result) => {
      if (!active) return
      setTable(result)
      setStatus(result ? 'ready' : 'failed')
    })
    return () => {
      active = false
    }
  }, [base])

  return { table, status }
}
