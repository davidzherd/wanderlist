import { useEffect, useRef, useState } from 'react'
import { useLocations } from '../context/LocationContext'
import { MapView } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'
import { Skeleton } from '../components/Skeleton'
import { ToastStack } from '../components/Toast'
import { AddLocationButton } from '../components/AddLocationButton'
import { LocateButton } from '../components/LocateButton'
import { Trash2 } from 'lucide-react'
import { GeolocationDeniedModal } from '../components/GeolocationDeniedModal'
import { AlertModal } from '../components/AlertModal'
import { AddLocationPopup } from '../components/AddLocationPopup'
import { SuggestionDeck } from '../components/SuggestionDeck'
import { useToasts } from '../hooks/useToasts'
import { useTheme } from '../hooks/useTheme'
import { useGeolocation } from '../hooks/useGeolocation'
import { ApiError } from '../api/client'
import type { Location, LocationFormValues } from '../types/location'

export function HomeMapView() {
  const { filteredLocations, allTags, isLoading, error, filters, setFilters, toggleVisited, removeLocation } =
    useLocations()
  const { theme } = useTheme()
  const { toasts, pushToast, dismissToast } = useToasts()
  const hasWarnedRef = useRef(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addPrefill, setAddPrefill] = useState<Partial<LocationFormValues> | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)

  // Live "you are here" tracking. Nothing runs until the user taps the Locate button.
  const {
    position: userPosition,
    status: geoStatus,
    start: startGeolocation,
    stop: stopGeolocation,
  } = useGeolocation()
  const [recenterToken, setRecenterToken] = useState(0)
  // True while the view is focused on the user's dot — the Locate button then turns tracking off.
  const [isCenteredOnUser, setIsCenteredOnUser] = useState(false)
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

  // Three-way tap: not tracking → start (permission prompt, then auto-zoom on first fix); tracking but
  // the user has panned/zoomed away → fly back to them; already focused on them → turn tracking off.
  const handleLocate = () => {
    if (!userPosition) {
      startGeolocation()
    } else if (isCenteredOnUser) {
      stopGeolocation()
      hasCenteredRef.current = false // next start() should auto-zoom on its first fix again
      setIsCenteredOnUser(false)
    } else {
      setRecenterToken((t) => t + 1)
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

  // Remove is a two-step action: the card's Remove button only opens a confirmation, and the delete
  // runs from there — so a mis-tap (easy on mobile's icon-only buttons) can't wipe a location.
  const [pendingDelete, setPendingDelete] = useState<Location | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const requestDelete = (id: string) => {
    setPendingDelete(filteredLocations.find((loc) => loc.id === id) ?? null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await removeLocation(pendingDelete.id)
      pushToast('success', 'Location removed from your bucket list.')
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        pushToast('error', 'Could not remove that location. Try again.')
      }
    } finally {
      setIsDeleting(false)
      setPendingDelete(null)
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
            onCenteredOnUserChange={setIsCenteredOnUser}
            onToggleVisited={handleToggleVisited}
            onDelete={requestDelete}
            onEdit={(loc) => setEditingLocation(loc)}
          />
          <FilterPanel filters={filters} onChange={setFilters} resultCount={filteredLocations.length} allTags={allTags} />
          <LocateButton status={geoStatus} isCentered={isCenteredOnUser} onClick={handleLocate} />
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
      {pendingDelete && (
        <AlertModal
          icon={<Trash2 size={32} className="text-red-600 dark:text-red-400" />}
          title="Remove this location?"
          tone="danger"
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          cancelLabel="Cancel"
          onCancel={() => setPendingDelete(null)}
          onDismiss={() => setPendingDelete(null)}
          isBusy={isDeleting}
        >
          <span className="font-semibold text-ink dark:text-mist-light">{pendingDelete.name}</span> will be permanently
          removed from your bucket list. Trips that already include it will keep their copy of the stop.
        </AlertModal>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
