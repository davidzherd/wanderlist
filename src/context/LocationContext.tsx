import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Location, LocationFormValues } from '../types/location'
import * as locationsApi from '../api/locations'
import { useAuth } from './AuthContext'

export interface LocationFilters {
  category: string
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
  toggleVisited: (id: string) => Promise<void>
  removeLocation: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined)

const DEFAULT_FILTERS: LocationFilters = { category: '', priority: null }

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
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
      const result = await locationsApi.fetchLocations(user.username)
      setLocations(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addLocation = useCallback(
    async (values: LocationFormValues) => {
      if (!user) throw new Error('Must be signed in to add a location')
      const created = await locationsApi.createLocation(user.username, values)
      setLocations((prev) => [...prev, created])
      return created
    },
    [user],
  )

  const toggleVisited = useCallback(
    async (id: string) => {
      if (!user) return
      const target = locations.find((loc) => loc.id === id)
      if (!target) return
      const updated = await locationsApi.updateLocation(user.username, id, { visited: !target.visited })
      setLocations((prev) => prev.map((loc) => (loc.id === id ? updated : loc)))
    },
    [user, locations],
  )

  const removeLocation = useCallback(
    async (id: string) => {
      if (!user) return
      await locationsApi.deleteLocation(user.username, id)
      setLocations((prev) => prev.filter((loc) => loc.id !== id))
    },
    [user],
  )

  const setFilters = useCallback((partial: Partial<LocationFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesCategory = filters.category
        ? loc.category.toLowerCase().includes(filters.category.toLowerCase())
        : true
      const matchesPriority = filters.priority ? loc.priority === filters.priority : true
      return matchesCategory && matchesPriority
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
      toggleVisited,
      removeLocation,
      refresh,
    }),
    [locations, filteredLocations, isLoading, error, filters, setFilters, addLocation, toggleVisited, removeLocation, refresh],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocations(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocations must be used within a LocationProvider')
  return ctx
}
