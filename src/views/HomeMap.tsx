import { useEffect, useRef, useState } from 'react'
import { useLocations } from '../context/LocationContext'
import { MapView, type DroppedPin, type FocusRequest } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'
import { Skeleton } from '../components/Skeleton'
import { AddLocationButton } from '../components/AddLocationButton'
import { LocateButton } from '../components/LocateButton'
import { MapPin, Trash2 } from 'lucide-react'
import { GeolocationDeniedModal } from '../components/GeolocationDeniedModal'
import { AlertModal } from '../components/AlertModal'
import { AddLocationPopup } from '../components/AddLocationPopup'
import { SuggestionDeck } from '../components/SuggestionDeck'
import { useNotifications } from '../context/NotificationContext'
import { useTheme } from '../hooks/useTheme'
import { useGeolocation } from '../hooks/useGeolocation'
import { ApiError } from '../api/client'
import type { Location, LocationFormValues } from '../types/location'

export function HomeMapView() {
  const [controlStackEl, setControlStackEl] = useState<HTMLDivElement | null>(null)
  const { filteredLocations, allTags, isLoading, error, filters, setFilters, toggleVisited, removeLocation } =
    useLocations()
  const { theme } = useTheme()
  const { pushToast, notify } = useNotifications()
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
    setDroppedPin(null)
  }

  // Right-click flow: the map flies in and a pin drops on the spot with a Save/Cancel bubble. The user can drag the
  // pin to fine-tune it; Save opens the add popup with its coordinates. The pin stays (frozen) until the popup closes —
  // on save the real marker takes its place.
  const [droppedPin, setDroppedPin] = useState<DroppedPin | null>(null)

  const handleMapContextMenu = (coords: { latitude: number; longitude: number }) => {
    // The form only reads its prefill on mount, so ignore right-clicks while a popup is already up.
    if (isAddOpen || editingLocation) return
    // A new dropId each time, so a second right-click re-drops the pin at the new spot.
    setDroppedPin((prev) => ({ ...coords, dropId: (prev?.dropId ?? 0) + 1 }))
  }
  const handleDroppedPinMove = (coords: { latitude: number; longitude: number }) => {
    setDroppedPin((prev) => (prev ? { ...prev, ...coords } : prev))
  }
  const handleDroppedPinSave = () => {
    if (droppedPin) openAdd({ latitude: droppedPin.latitude, longitude: droppedPin.longitude })
  }

  // A newly added or edited location gets a photo notification (instead of the text-only kind); tapping it flies
  // the map to the pin and opens its card.
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)

  const notifyLocation = (loc: Location, titleSuffix?: string) => {
    notify({
      category: 'location',
      title: loc.name,
      titleSuffix,
      subtitle: loc.country,
      subtitleIcon: MapPin,
      imageUrl: loc.images[0],
      onClick: () =>
        setFocusRequest((prev) => ({
          locationId: loc.id,
          latitude: loc.latitude,
          longitude: loc.longitude,
          token: (prev?.token ?? 0) + 1,
        })),
    })
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
      pushToast('removed', `${pendingDelete.name} removed`, 'location')
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
            onMapContextMenu={handleMapContextMenu}
            droppedPin={droppedPin}
            droppedPinLocked={isAddOpen}
            onDroppedPinMove={handleDroppedPinMove}
            onDroppedPinSave={handleDroppedPinSave}
            onDroppedPinCancel={() => setDroppedPin(null)}
            focusRequest={focusRequest}
          />
          <FilterPanel filters={filters} onChange={setFilters} resultCount={filteredLocations.length} allTags={allTags} />
          <LocateButton status={geoStatus} isCentered={isCenteredOnUser} onClick={handleLocate} stackEl={controlStackEl} />
        </>
      )}
      {/* Every screen size: one map-control group above the Add button (maps-app style). Discover and Locate portal their
          buttons into it, so each keeps its own logic; it hides itself when empty. Portal DOM order isn't guaranteed, so
          cells use `order-*` for position, Discover draws the divider, and corners use `only:` rather than first/last. */}
      <div
        ref={setControlStackEl}
        className="fixed bottom-[92px] right-[30px] z-[900] flex flex-col rounded-xl border border-black/10 bg-white/90 shadow-lg backdrop-blur-xl empty:hidden dark:border-white/10 dark:bg-[#333]/90"
      />
      <SuggestionDeck pushToast={pushToast} stackEl={controlStackEl} />
      <AddLocationButton
        onClick={() => {
          setDroppedPin(null) // the + flow isn't for the pending right-click spot, so don't leave its pin behind
          openAdd()
        }}
      />
      {isAddOpen && (
        <AddLocationPopup prefill={addPrefill ?? undefined} onClose={closeAdd} pushToast={pushToast} onAdded={(loc) => notifyLocation(loc)} />
      )}
      {editingLocation && (
        <AddLocationPopup
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          pushToast={pushToast}
          onUpdated={(loc) => notifyLocation(loc, 'just updated')}
        />
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
    </div>
  )
}
