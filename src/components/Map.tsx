import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useEffect, useRef, useState } from 'react'
import type { Popup as LeafletPopup } from 'leaflet'
import { MapPin, MapPinCheck, MapPinCheckInside, Pencil, Route, Star, Trash2, type LucideIcon } from 'lucide-react'
import type { Location } from '../types/location'
import type { UserPosition } from '../hooks/useGeolocation'
import { createClusterIcon, createMarkerIcon, createUserLocationIcon } from './CustomClusterIcon'
import { LocationImage } from './LocationImage'
import { ImageCarousel } from './ImageCarousel'
import { TagChips } from './TagChips'
import { useIsMobile } from '../hooks/useIsMobile'

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
  onCenteredOnUserChange: (centered: boolean) => void
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

const USER_FOCUS_ZOOM = 14
// How close (in screen pixels) the dot must sit to the map's center to count as "focused on the user".
const CENTERED_TOLERANCE_PX = 40

interface RecenterControllerProps {
  userPosition: UserPosition | null
  recenterToken: number
  onCenteredChange: (centered: boolean) => void
}

// Flies the map to the user's position only when `recenterToken` changes (first fix + Locate taps).
// Live position updates are read through a ref, never as an effect dependency — otherwise every
// watchPosition tick would re-fly the map and lock the view onto the user.
//
// Also reports whether the view is currently focused on the user (dot near the center at street-level
// zoom), re-checked after every pan/zoom and position update, so the Locate button can switch to its
// "turn off" state.
function RecenterController({ userPosition, recenterToken, onCenteredChange }: RecenterControllerProps) {
  const map = useMap()
  const positionRef = useRef(userPosition)
  positionRef.current = userPosition

  useEffect(() => {
    const pos = positionRef.current
    if (recenterToken === 0 || !pos) return
    map.flyTo([pos.latitude, pos.longitude], Math.max(map.getZoom(), USER_FOCUS_ZOOM))
  }, [recenterToken, map])

  useEffect(() => {
    const check = () => {
      const pos = positionRef.current
      if (!pos || map.getZoom() < USER_FOCUS_ZOOM - 1) {
        onCenteredChange(false)
        return
      }
      const dot = map.latLngToContainerPoint([pos.latitude, pos.longitude])
      const center = map.getSize().divideBy(2)
      onCenteredChange(dot.distanceTo(center) <= CENTERED_TOLERANCE_PX)
    }
    check()
    map.on('moveend', check)
    return () => {
      map.off('moveend', check)
    }
  }, [map, userPosition, onCenteredChange])

  return null
}

// Created once: a fresh icon per render makes Leaflet rebuild the marker DOM on every position
// update, which restarts the pulse animation and flickers.
const USER_LOCATION_ICON = createUserLocationIcon()

// The live "you are here" dot plus a translucent accuracy circle (radius in meters from the fix).
// Non-interactive so it never swallows clicks meant for the map or nearby saved pins.
function UserLocationLayer({ userPosition }: { userPosition: UserPosition | null }) {
  if (!userPosition) return null
  const center: [number, number] = [userPosition.latitude, userPosition.longitude]
  return (
    <>
      <Circle
        center={center}
        radius={userPosition.accuracy}
        interactive={false}
        pathOptions={{ color: '#12857B', weight: 1, fillColor: '#12857B', fillOpacity: 0.12 }}
      />
      <Marker position={center} icon={USER_LOCATION_ICON} zIndexOffset={1000} interactive={false} />
    </>
  )
}

export function MapView({
  locations,
  theme,
  userPosition,
  recenterToken,
  onCenteredOnUserChange,
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
      <RecenterController
        userPosition={userPosition}
        recenterToken={recenterToken}
        onCenteredChange={onCenteredOnUserChange}
      />
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
      <Popup ref={popupRef} maxWidth={360} className="wl-loc-popup">
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

// Card width: ~50% larger than the original 220px card, but never wider than a phone screen allows
// (Leaflet keeps a small margin around the popup).
const CARD_WIDTH = 'w-[min(330px,calc(100vw-56px))]'

// Hands off to Google Maps directions to this spot. Origin is omitted so Google uses the device's
// current location; opens the native Maps app on mobile and the web app on desktop.
function directionsUrl(loc: Location): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`
}

function PriorityStars({ priority, className }: { priority: number; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center gap-0.5 text-sm font-medium ${className ?? 'text-brass'}`}>
      {Array.from({ length: priority }).map((_, i) => (
        <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  )
}

interface CardAction {
  key: string
  label: string
  icon: LucideIcon
  tone: string
  href?: string
  onClick?: () => void
  active?: boolean
}

// The four card actions. Desktop: labelled 2x2 grid. Mobile: one row of large icon-only tap targets
// (the label moves to aria-label/title) — the small text links were too hard to hit on a phone.
function CardActions({ loc, onToggleVisited, onDelete, onEdit, variant }: CardProps & { variant: 'standard' | 'portrait' }) {
  const isMobile = useIsMobile()
  const onImage = variant === 'portrait'

  const actions: CardAction[] = [
    {
      key: 'directions',
      label: 'Directions',
      icon: Route,
      href: directionsUrl(loc),
      tone: onImage ? 'text-harbor-light' : 'text-harbor dark:text-harbor-light',
    },
    {
      key: 'visited',
      label: loc.visited ? 'Visited' : 'Mark visited',
      icon: loc.visited ? MapPinCheckInside : MapPinCheck,
      onClick: () => onToggleVisited(loc.id),
      tone: onImage ? 'text-emerald-300' : 'text-emerald-700 dark:text-emerald-400',
      active: loc.visited,
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => onEdit(loc),
      tone: onImage ? 'text-harbor-light' : 'text-harbor dark:text-harbor-light',
    },
    {
      key: 'remove',
      label: 'Remove',
      icon: Trash2,
      onClick: () => onDelete(loc.id),
      tone: onImage ? 'text-red-300' : 'text-red-600 dark:text-red-400',
    },
  ]

  const border = onImage ? 'border-white/25' : 'border-black/10 dark:border-white/10'
  const tile = onImage ? 'bg-white/15 backdrop-blur-sm' : 'bg-black/5 dark:bg-white/10'
  const activeTile = onImage ? 'bg-emerald-400/30 backdrop-blur-sm' : 'bg-emerald-500/15 dark:bg-emerald-400/20'

  return (
    <div className={`grid border-t pt-3 ${border} ${isMobile ? 'grid-cols-4 gap-2' : 'grid-cols-2 gap-x-4 gap-y-2'}`}>
      {actions.map(({ key, label, icon: Icon, tone, href, onClick, active }) => {
        const className = isMobile
          ? `flex h-12 items-center justify-center rounded-xl ${active ? activeTile : tile} ${tone}`
          : `flex items-center gap-1.5 text-sm font-medium hover:underline ${tone}`
        const content = isMobile ? (
          <Icon size={22} />
        ) : (
          <>
            <Icon size={17} /> {label}
          </>
        )
        const a11y = isMobile ? { 'aria-label': label, title: label } : {}
        return href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={className} {...a11y}>
            {content}
          </a>
        ) : (
          <button key={key} type="button" onClick={onClick} className={className} {...a11y}>
            {content}
          </button>
        )
      })}
    </div>
  )
}

// Landscape / no image: image in a fixed-height box above the details.
function StandardCard(props: CardProps) {
  const { loc } = props
  return (
    <div className={`${CARD_WIDTH} p-4 font-body`}>
      <div className="mb-2 flex items-start justify-between gap-2 pr-6">
        <h3 className="font-display text-base font-semibold text-ink dark:text-mist-light">{loc.name}</h3>
        <PriorityStars priority={loc.priority} />
      </div>
      {loc.images.length > 1 ? (
        <ImageCarousel images={loc.images} alt={loc.name} containerClassName="relative mb-3 h-44 w-full" />
      ) : (
        <LocationImage src={loc.images[0]} alt={loc.name} className="mb-3 h-44 w-full rounded-lg object-cover" />
      )}
      <p className="mb-2 flex items-center gap-1 text-sm text-ink/70 dark:text-mist-light/70">
        <MapPin size={14} /> {loc.country}
      </p>
      <TagChips
        tags={loc.tags}
        className="mb-3"
        chipClassName="rounded-full bg-harbor/10 px-2.5 py-0.5 text-xs font-medium text-harbor dark:bg-harbor/20 dark:text-harbor-light"
      />
      {loc.notes && <p className="mb-3 text-sm text-ink/70 dark:text-mist-light/70">{loc.notes}</p>}
      <CardActions {...props} variant="standard" />
    </div>
  )
}

// Portrait image: the photo becomes the full card background, with a gradient at the top for the
// name and a stronger one at the bottom so the details and actions stay legible over the image.
function PortraitCard(props: CardProps) {
  const { loc } = props
  return (
    <div
      className={`wl-portrait-card relative flex h-[min(500px,70vh)] ${CARD_WIDTH} flex-col justify-between overflow-hidden font-body text-white`}
    >
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 via-black/25 to-transparent" />
      {/* Bottom gradient — carries the country, tags, notes and actions. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/70 to-transparent" />

      <div className="relative flex items-start justify-between gap-2 p-4 pr-7">
        <h3 className="font-display text-base font-semibold leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
          {loc.name}
        </h3>
        <PriorityStars priority={loc.priority} className="text-brass-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]" />
      </div>

      <div className="relative p-4">
        <p className="mb-2 flex items-center gap-1 text-sm text-white/90">
          <MapPin size={14} /> {loc.country}
        </p>
        <TagChips
          tags={loc.tags}
          className="mb-3"
          chipClassName="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
        />
        {loc.notes && <p className="mb-3 line-clamp-3 text-sm text-white/85">{loc.notes}</p>}
        <CardActions {...props} variant="portrait" />
      </div>
    </div>
  )
}
