import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useEffect, useRef, useState } from 'react'
import type { Popup as LeafletPopup } from 'leaflet'
import { CheckCircle2, Circle as CircleIcon, MapPin, Navigation, Pencil, Star, Trash2 } from 'lucide-react'
import type { Location } from '../types/location'
import type { UserPosition } from '../hooks/useGeolocation'
import { createClusterIcon, createMarkerIcon, createUserLocationIcon } from './CustomClusterIcon'
import { LocationImage } from './LocationImage'
import { ImageCarousel } from './ImageCarousel'

// CARTO's raster basemaps now require an API key (?key=…) — without one their servers return
// "API KEY REQUIRED" watermarked tiles. The key is inlined into the bundle at build time like the
// other VITE_* vars (fine here: it's a non-billing map key and there's no backend to proxy through).
// If the key is missing we fall back to the bare URL so the app still renders (watermarked).
const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY
const cartoKeyParam = CARTO_KEY ? `?key=${CARTO_KEY}` : ''

export const TILE_URLS = {
  light: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoKeyParam}`,
  dark: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${cartoKeyParam}`,
}

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

const DEFAULT_CENTER: [number, number] = [20, 10]

// Keeps the map a single flat world: no wrapping past the antimeridian, so panning left
// stops at the Americas instead of Leaflet fetching duplicate tiles for repeated world copies.
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-90, -180],
  [90, 180],
]

interface MapViewProps {
  locations: Location[]
  theme: 'light' | 'dark'
  userPosition: UserPosition | null
  // Bumps each time the map should recenter on the user (first fix + every Locate-button tap). We
  // recenter only on this token, never on raw position updates, so manual zoom/pan isn't fought.
  recenterToken: number
  onToggleVisited: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (location: Location) => void
}

function MapController({ locations }: { locations: Location[] }) {
  const map = useMap()

  useEffect(() => {
    // The map mounts inside a flex layout that hasn't finished sizing yet, so Leaflet's
    // first-paint viewport calculation is wrong and it only fetches tiles for that stale
    // area. Recompute the size once layout settles, then a ResizeObserver keeps it correct
    // across window resizes / sidebar changes.
    const container = map.getContainer()
    const raf = requestAnimationFrame(() => map.invalidateSize())
    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
    }
  }, [map])

  useEffect(() => {
    if (locations.length === 0) return
    const bounds = locations.map((loc) => [loc.latitude, loc.longitude] as [number, number])
    if (bounds.length === 1) {
      map.setView(bounds[0], 6)
    } else {
      map.fitBounds(bounds, { padding: [60, 60] })
    }
    // Only run once on initial data load, not on every locations change (avoids yanking the view while filtering).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// Flies the map to the user's position whenever `recenterToken` changes (first fix + Locate taps).
// Street-level zoom on the way in; afterwards the user is free to zoom out — we don't touch the view
// again until the next token bump.
function RecenterController({ userPosition, recenterToken }: { userPosition: UserPosition | null; recenterToken: number }) {
  const map = useMap()
  useEffect(() => {
    if (recenterToken === 0 || !userPosition) return
    map.flyTo([userPosition.latitude, userPosition.longitude], Math.max(map.getZoom(), 14))
  }, [recenterToken, userPosition, map])
  return null
}

// The live "you are here" dot plus a translucent accuracy circle (radius in meters from the fix).
function UserLocationLayer({ userPosition }: { userPosition: UserPosition | null }) {
  if (!userPosition) return null
  const center: [number, number] = [userPosition.latitude, userPosition.longitude]
  return (
    <>
      <Circle
        center={center}
        radius={userPosition.accuracy}
        pathOptions={{ color: '#12857B', weight: 1, fillColor: '#12857B', fillOpacity: 0.12 }}
      />
      <Marker position={center} icon={createUserLocationIcon()} zIndexOffset={1000} />
    </>
  )
}

export function MapView({
  locations,
  theme,
  userPosition,
  recenterToken,
  onToggleVisited,
  onDelete,
  onEdit,
}: MapViewProps) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={2}
      minZoom={2}
      className="h-full w-full"
      zoomControl={false}
      worldCopyJump={false}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1.0}
    >
      <TileLayer url={TILE_URLS[theme]} attribution={TILE_ATTRIBUTION} noWrap />
      <MapController locations={locations} />
      <RecenterController userPosition={userPosition} recenterToken={recenterToken} />
      <UserLocationLayer userPosition={userPosition} />
      <MarkerClusterGroup maxClusterRadius={40} iconCreateFunction={createClusterIcon}>
        {locations.map((loc) => (
          <LocationMarker
            key={loc.id}
            loc={loc}
            onToggleVisited={onToggleVisited}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}

interface LocationMarkerProps {
  loc: Location
  onToggleVisited: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (location: Location) => void
}

// One map pin + its popup. Owns the async check of the photo's aspect ratio so the popup can
// pick between the standard (landscape) card and the full-bleed portrait card. The check runs on
// mount using the same URL the card renders, so the browser cache is warm by the time the popup
// opens and there's no layout flip.
function LocationMarker({ loc, onToggleVisited, onDelete, onEdit }: LocationMarkerProps) {
  const popupRef = useRef<LeafletPopup>(null)
  const [isPortrait, setIsPortrait] = useState(false)

  // The primary image (element 0) decides portrait vs. landscape framing for the whole card;
  // the carousel then shows every photo regardless of individual aspect ratios.
  const primaryImage = loc.images[0]

  useEffect(() => {
    if (!primaryImage) {
      setIsPortrait(false)
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setIsPortrait(img.naturalHeight > img.naturalWidth)
    }
    // On error, fall back to the standard card (LocationImage renders its own placeholder there).
    img.src = primaryImage
    return () => {
      cancelled = true
    }
  }, [primaryImage])

  // If the aspect ratio resolves after the popup is already open, the card may have changed
  // height — nudge Leaflet to re-measure so the tip stays anchored to the marker.
  useEffect(() => {
    popupRef.current?.update()
  }, [isPortrait])

  return (
    <Marker position={[loc.latitude, loc.longitude]} icon={createMarkerIcon(loc.color, loc.emoji, loc.icon)}>
      <Popup ref={popupRef} maxWidth={240} className="wl-loc-popup">
        {isPortrait ? (
          <PortraitCard loc={loc} onToggleVisited={onToggleVisited} onDelete={onDelete} onEdit={onEdit} />
        ) : (
          <StandardCard loc={loc} onToggleVisited={onToggleVisited} onDelete={onDelete} onEdit={onEdit} />
        )}
      </Popup>
    </Marker>
  )
}

type CardProps = LocationMarkerProps

// Hands off to Google Maps directions to this spot. Origin is omitted so Google uses the device's
// current location; opens the native Maps app on mobile and the web app on desktop.
function directionsUrl(loc: Location): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`
}

function PriorityStars({ priority, className }: { priority: number; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center gap-0.5 text-xs font-medium ${className ?? 'text-brass'}`}>
      {Array.from({ length: priority }).map((_, i) => (
        <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  )
}

// Landscape / no image: the original popup layout — image in a fixed-height box above the details.
function StandardCard({ loc, onToggleVisited, onDelete, onEdit }: CardProps) {
  return (
    <div className="min-w-[220px] p-3 font-body">
      <div className="mb-1 flex items-start justify-between gap-2 pr-5">
        <h3 className="font-display text-sm font-semibold text-ink dark:text-mist-light">{loc.name}</h3>
        <PriorityStars priority={loc.priority} />
      </div>
      {loc.images.length > 1 ? (
        <ImageCarousel images={loc.images} alt={loc.name} />
      ) : (
        <LocationImage src={loc.images[0]} alt={loc.name} />
      )}
      <p className="mb-1 flex items-center gap-1 text-xs text-ink/70 dark:text-mist-light/70">
        <MapPin size={12} /> {loc.country}
      </p>
      <p className="mb-2 inline-block rounded-full bg-harbor/10 px-2 py-0.5 text-[11px] font-medium text-harbor dark:bg-harbor/20 dark:text-harbor-light">
        {loc.category}
      </p>
      {loc.notes && <p className="mb-2 text-xs text-ink/70 dark:text-mist-light/70">{loc.notes}</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-black/10 pt-2 dark:border-white/10">
        <a
          href={directionsUrl(loc)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline dark:text-harbor-light"
        >
          <Navigation size={13} /> Directions
        </a>
        <button
          type="button"
          onClick={() => onToggleVisited(loc.id)}
          className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {loc.visited ? <CheckCircle2 size={13} /> : <CircleIcon size={13} />}
          {loc.visited ? 'Visited' : 'Mark visited'}
        </button>
        <button
          type="button"
          onClick={() => onEdit(loc)}
          className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline dark:text-harbor-light"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(loc.id)}
          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
    </div>
  )
}

// Portrait image: the photo becomes the full card background, with a gradient at the top for the
// name and a stronger one at the bottom so the details and actions stay legible over the image.
function PortraitCard({ loc, onToggleVisited, onDelete, onEdit }: CardProps) {
  return (
    <div className="wl-portrait-card relative flex h-[340px] w-[220px] flex-col justify-between overflow-hidden font-body text-white">
      {loc.images.length > 1 ? (
        <ImageCarousel
          images={loc.images}
          alt={loc.name}
          containerClassName="absolute inset-0"
          imgClassName="h-full w-full object-cover"
          dotsClassName="top-3"
        />
      ) : (
        <img src={loc.images[0]} alt={loc.name} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Top gradient — just enough to lift the name off bright skies. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 via-black/25 to-transparent" />
      {/* Bottom gradient — carries the country, category, notes and actions. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/70 to-transparent" />

      <div className="relative flex items-start justify-between gap-2 p-3 pr-6">
        <h3 className="font-display text-sm font-semibold leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
          {loc.name}
        </h3>
        <PriorityStars priority={loc.priority} className="text-brass-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]" />
      </div>

      <div className="relative p-3">
        <p className="mb-1 flex items-center gap-1 text-xs text-white/90">
          <MapPin size={12} /> {loc.country}
        </p>
        <p className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          {loc.category}
        </p>
        {loc.notes && <p className="mb-2 line-clamp-2 text-xs text-white/85">{loc.notes}</p>}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-white/25 pt-2">
          <a
            href={directionsUrl(loc)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-harbor-light hover:underline"
          >
            <Navigation size={13} /> Directions
          </a>
          <button
            type="button"
            onClick={() => onToggleVisited(loc.id)}
            className="flex items-center gap-1 text-xs font-medium text-emerald-300 hover:underline"
          >
            {loc.visited ? <CheckCircle2 size={13} /> : <CircleIcon size={13} />}
            {loc.visited ? 'Visited' : 'Mark visited'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(loc)}
            className="flex items-center gap-1 text-xs font-medium text-harbor-light hover:underline"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(loc.id)}
            className="flex items-center gap-1 text-xs font-medium text-red-300 hover:underline"
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </div>
    </div>
  )
}
