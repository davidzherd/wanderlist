import { useCallback, useEffect, useRef, useState } from 'react'
import { geocodeSearch } from '../api/geocode'
import type { NominatimResult } from '../types/location'

/**
 * Debounced Nominatim place search. Returns the current results plus loading/error
 * state for `query`, and a `reset` to clear results (e.g. after picking one).
 * Queries shorter than `minLength` are ignored (and clear any prior results).
 */
export function useGeocodeSearch(query: string, minLength = 3, debounceMs = 400) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < minLength) {
      setResults([])
      setError(null)
      setIsSearching(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      setError(null)
      try {
        setResults(await geocodeSearch(query))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Geocoding lookup failed')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, minLength, debounceMs])

  const reset = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return { results, isSearching, error, reset }
}
