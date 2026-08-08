import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Location, LocationFormValues } from '../types/location'
import * as locationsApi from '../api/supabaseLocations'
import { ApiError } from '../api/client'
import { useAuth } from './AuthContext'

function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}

export interface LocationFilters {
  search: string
  priority: number | null
}

interface LocationContextValue {
  locations: Location[]
  filteredLocations: Location[]
  isLoading: boolean
  error: string | null
  filters: LocationFilters
  setFilters: (filters: Partial<LocationFilters>) => void
  addLocation: (values: LocationFormValues) => Promise<Location>
  editLocation: (id: string, values: LocationFormValues) => Promise<Location>
  toggleVisited: (id: string) => Promise<void>
  removeLocation: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined)

const DEFAULT_FILTERS: LocationFilters = { search: '', priority: null }

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, expireSession } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<LocationFilters>(DEFAULT_FILTERS)

  const refresh = useCallback(async () => {
    if (!user) {
      setLocations([])
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const result = await locationsApi.fetchLocations()
      setLocations(result)
    } catch (err) {
      if (isSessionExpired(err)) {
        expireSession()
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load locations')
      }
    } finally {
      setIsLoading(false)
    }
  }, [user, expireSession])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addLocation = useCallback(
    async (values: LocationFormValues) => {
      if (!user) throw new Error('Must be signed in to add a location')
      try {
        const created = await locationsApi.createLocation(values)
        setLocations((prev) => [...prev, created])
        return created
      } catch (err) {
        if (isSessionExpired(err)) expireSession()
        throw err
      }
    },
    [user, expireSession],
  )

  const editLocation = useCallback(
    async (id: string, values: LocationFormValues) => {
      if (!user) throw new Error('Must be signed in to edit a location')
      try {
        const updated = await locationsApi.updateLocation(id, values)
        setLocations((prev) => prev.map((loc) => (loc.id === id ? updated : loc)))
        return updated
      } catch (err) {
        if (isSessionExpired(err)) expireSession()
        throw err
      }
    },
    [user, expireSession],
  )

  const toggleVisited = useCallback(
    async (id: string) => {
      if (!user) return
      const target = locations.find((loc) => loc.id === id)
      if (!target) return
      try {
        const updated = await locationsApi.updateLocation(id, { visited: !target.visited })
        setLocations((prev) => prev.map((loc) => (loc.id === id ? updated : loc)))
      } catch (err) {
        if (isSessionExpired(err)) expireSession()
        throw err
      }
    },
    [user, locations, expireSession],
  )

  const removeLocation = useCallback(
    async (id: string) => {
      if (!user) return
      try {
        await locationsApi.deleteLocation(id)
        setLocations((prev) => prev.filter((loc) => loc.id !== id))
      } catch (err) {
        if (isSessionExpired(err)) expireSession()
        throw err
      }
    },
    [user, expireSession],
  )

  const setFilters = useCallback((partial: Partial<LocationFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const search = filters.search.trim().toLowerCase()
      const matchesSearch = search
        ? loc.name.toLowerCase().includes(search) || loc.country.toLowerCase().includes(search)
        : true
      const matchesPriority = filters.priority ? loc.priority === filters.priority : true
      return matchesSearch && matchesPriority
    })
  }, [locations, filters])

  const value = useMemo(
    () => ({
      locations,
      filteredLocations,
      isLoading,
      error,
      filters,
      setFilters,
      addLocation,
      editLocation,
      toggleVisited,
      removeLocation,
      refresh,
    }),
    [
      locations,
      filteredLocations,
      isLoading,
      error,
      filters,
      setFilters,
      addLocation,
      editLocation,
      toggleVisited,
      removeLocation,
      refresh,
    ],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocations(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocations must be used within a LocationProvider')
  return ctx
}
