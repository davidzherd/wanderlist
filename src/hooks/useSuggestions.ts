import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocations } from '../context/LocationContext'
import { fetchSuggestions, type Suggestion } from '../api/wikivoyage'

// Persist the computed suggestions so they're already there "when I log in" — with no backend, the
// pool lives in localStorage keyed by a signature of the bucket list. It's only recomputed when the
// list actually changes, so a normal login reads straight from cache. Dismissed names are stored
// separately so a hidden card never comes back, even after a recompute.
const CACHE_KEY = 'wanderlist:suggestions'
const DISMISSED_KEY = 'wanderlist:suggestions-dismissed'

// Top-up policy: whenever the visible pool falls below REFILL_THRESHOLD (because the user dismissed
// cards), fetch a fresh batch of FETCH_COUNT excluding everything already shown/dismissed/saved. That
// caps the pool at (REFILL_THRESHOLD - 1) + FETCH_COUNT = 39 visible suggestions at most.
const REFILL_THRESHOLD = 20
const FETCH_COUNT = 20

interface CacheEntry {
  signature: string
  pool: Suggestion[]
  /** True once the Wikivoyage source is drained for this signature, so we stop re-hitting the API. */
  exhausted?: boolean
}

// Recompute only when the set of places (name + country) changes — editing an unrelated field like a
// note or pin color shouldn't burn a fresh round of API calls.
function computeSignature(places: Array<{ name: string; country: string }>): string {
  return places
    .map((p) => `${p.name.trim().toLowerCase()}@@${p.country.trim().toLowerCase()}`)
    .sort()
    .join('|')
}

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function saveCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    /* ignore — quota/private-mode failures shouldn't break the feature */
  }
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(dismissed: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
  } catch {
    /* ignore */
  }
}

const keyOf = (name: string) => name.trim().toLowerCase()

interface UseSuggestionsResult {
  suggestions: Suggestion[]
  isLoading: boolean
  dismiss: (name: string) => void
}

/**
 * Surfaces Wikivoyage destination suggestions for the signed-in user's bucket list, served instantly
 * from a localStorage cache when the list is unchanged and recomputed in the background when it isn't.
 * Dismissing a card prunes it and, once the pool dips below {@link REFILL_THRESHOLD}, transparently
 * fetches a fresh batch so there's always more to browse (up to 39 at a time).
 */
export function useSuggestions(): UseSuggestionsResult {
  const { locations, isLoading: locationsLoading } = useLocations()
  const [pool, setPool] = useState<Suggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
  const [isLoading, setIsLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const signature = useMemo(() => computeSignature(locations), [locations])

  // Kept in refs so the refill effect can read the latest without re-subscribing to array identity.
  const locationsRef = useRef(locations)
  locationsRef.current = locations
  const exhaustedRef = useRef(false)
  const inFlightRef = useRef(false)

  const visible = useMemo(
    () => pool.filter((s) => !dismissed.has(keyOf(s.name))),
    [pool, dismissed],
  )

  // Hydrate from cache (or clear) whenever the bucket-list signature changes. `hydrated` gates the
  // refill effect below so it never double-fetches over a cache hit that hasn't landed yet.
  useEffect(() => {
    if (locationsLoading) return
    exhaustedRef.current = false
    setHydrated(false)

    if (locationsRef.current.length === 0) {
      setPool([])
      setHydrated(true)
      return
    }

    const cached = loadCache()
    if (cached && cached.signature === signature && Array.isArray(cached.pool) && cached.pool.length > 0) {
      setPool(cached.pool)
      exhaustedRef.current = !!cached.exhausted
    } else {
      // Empty/mismatched cache → start fresh; the refill effect performs the initial fetch.
      setPool([])
    }
    setHydrated(true)
    // `signature` already changes whenever `locations` meaningfully changes; locations is read via ref.
  }, [signature, locationsLoading])

  // Keep the pool topped up: fetch a fresh batch whenever the visible count is under the threshold and
  // the source isn't already drained. Handles both the initial fetch and post-dismiss refills.
  useEffect(() => {
    if (!hydrated || locationsLoading) return
    if (locationsRef.current.length === 0) return
    if (exhaustedRef.current || inFlightRef.current) return
    if (visible.length >= REFILL_THRESHOLD) return

    inFlightRef.current = true
    setIsLoading(true)
    let cancelled = false

    const known = new Set<string>([...pool.map((p) => keyOf(p.name)), ...dismissed])
    fetchSuggestions(locationsRef.current, { exclude: known, count: FETCH_COUNT })
      .then((fresh) => {
        if (cancelled) return
        const added = fresh.filter((f) => !known.has(keyOf(f.name)))
        // Fewer new results than requested means Wikivoyage has nothing left to offer this signature.
        if (added.length < FETCH_COUNT) exhaustedRef.current = true
        const next = added.length ? [...pool, ...added] : pool
        if (added.length) setPool(next)
        saveCache({ signature, pool: next, exhausted: exhaustedRef.current })
      })
      .finally(() => {
        inFlightRef.current = false
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      inFlightRef.current = false
    }
  }, [hydrated, visible.length, pool, dismissed, signature, locationsLoading])

  const dismiss = useCallback(
    (name: string) => {
      const key = keyOf(name)
      setDismissed((prev) => {
        const next = new Set(prev)
        next.add(key)
        saveDismissed(next)
        return next
      })
      // Prune from the pool too so it stays bounded and the refill trigger reads a true visible count.
      setPool((prev) => {
        const next = prev.filter((s) => keyOf(s.name) !== key)
        saveCache({ signature, pool: next, exhausted: exhaustedRef.current })
        return next
      })
    },
    [signature],
  )

  return { suggestions: visible, isLoading, dismiss }
}
