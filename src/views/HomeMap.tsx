import { useEffect, useRef, useState } from 'react'
import { useLocations } from '../context/LocationContext'
import { MapView } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'
import { Skeleton } from '../components/Skeleton'
import { ToastStack } from '../components/Toast'
import { AddLocationButton } from '../components/AddLocationButton'
import { LocateButton } from '../components/LocateButton'
import { GeolocationDeniedModal } from '../components/GeolocationDeniedModal'
import { AddLocationPopup } from '../components/AddLocationPopup'
import { SuggestionDeck } from '../components/SuggestionDeck'
import { useToasts } from '../hooks/useToasts'
import { useTheme } from '../hooks/useTheme'
import { useGeolocation } from '../hooks/useGeolocation'
import { ApiError } from '../api/client'
import type { Location, LocationFormValues } from '../types/location'

export function HomeMapView() {
  const { filteredLocations, isLoading, error, filters, setFilters, toggleVisited, removeLocation } = useLocations()
  const { theme } = useTheme()
  const { toasts, pushToast, dismissToast } = useToasts()
  const hasWarnedRef = useRef(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addPrefill, setAddPrefill] = useState<Partial<LocationFormValues> | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)

  // Live "you are here" tracking. Nothing runs until the user taps the Locate button.
  const { position: userPosition, status: geoStatus, start: startGeolocation } = useGeolocation()
  const [recenterToken, setRecenterToken] = useState(0)
  const [showGeoDenied, setShowGeoDenied] = useState(false)
  const hasCenteredRef = useRef(false)

  // Auto-recenter once when the first fix arrives (the "zoom to me on accept" step); after that the
  // user controls the view and only a Locate tap recenters again.
  useEffect(() => {
    if (userPosition && !hasCenteredRef.current) {
      hasCenteredRef.current = true
      setRecenterToken((t) => t + 1)
    }
  }, [userPosition])

  useEffect(() => {
    if (geoStatus === 'denied') setShowGeoDenied(true)
    if (geoStatus === 'unavailable') pushToast('error', "Couldn't get your location. Check your device settings and try again.")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoStatus])

  const handleLocate = () => {
    if (userPosition) {
      setRecenterToken((t) => t + 1) // already tracking — just recenter on the user
    } else {
      startGeolocation() // first tap: triggers the permission prompt
    }
  }

  const openAdd = (prefill?: Partial<LocationFormValues>) => {
    setAddPrefill(prefill ?? null)
    setIsAddOpen(true)
  }
  const closeAdd = () => {
    setIsAddOpen(false)
    setAddPrefill(null)
  }

  if (error && !hasWarnedRef.current) {
    hasWarnedRef.current = true
    pushToast('error', error)
  }

  const handleToggleVisited = async (id: string) => {
    try {
      await toggleVisited(id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      pushToast('error', 'Could not update that location. Try again.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await removeLocation(id)
      pushToast('success', 'Location removed from your bucket list.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      pushToast('error', 'Could not remove that location. Try again.')
    }
  }

  return (
    <div className="relative h-full w-full bg-[#d5e8eb] dark:bg-[#404040]">
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="w-full max-w-md space-y-3 px-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ) : (
        <>
          <MapView
            locations={filteredLocations}
            theme={theme}
            userPosition={userPosition}
            recenterToken={recenterToken}
            onToggleVisited={handleToggleVisited}
            onDelete={handleDelete}
            onEdit={(loc) => setEditingLocation(loc)}
          />
          <FilterPanel filters={filters} onChange={setFilters} resultCount={filteredLocations.length} />
          <LocateButton status={geoStatus} onClick={handleLocate} />
        </>
      )}
      <SuggestionDeck pushToast={pushToast} />
      <AddLocationButton onClick={() => openAdd()} />
      {isAddOpen && (
        <AddLocationPopup prefill={addPrefill ?? undefined} onClose={closeAdd} pushToast={pushToast} />
      )}
      {editingLocation && (
        <AddLocationPopup location={editingLocation} onClose={() => setEditingLocation(null)} pushToast={pushToast} />
      )}
      {showGeoDenied && <GeolocationDeniedModal onClose={() => setShowGeoDenied(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
