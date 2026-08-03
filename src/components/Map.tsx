import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useEffect } from 'react'
import { CheckCircle2, Circle, MapPin, Star, Trash2 } from 'lucide-react'
import type { Location } from '../types/location'
import { createClusterIcon, createMarkerIcon } from './CustomClusterIcon'
import { LocationImage } from './LocationImage'

const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const TILE_ATTRIBUTION =
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
  onToggleVisited: (id: string) => void
  onDelete: (id: string) => void
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

export function MapView({ locations, theme, onToggleVisited, onDelete }: MapViewProps) {
  const markerIcon = createMarkerIcon()

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
      <MarkerClusterGroup maxClusterRadius={40} iconCreateFunction={createClusterIcon}>
        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={markerIcon}>
            <Popup maxWidth={240}>
              <div className="min-w-[220px] font-body">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-espresso">{loc.name}</h3>
                  <span className="flex items-center gap-0.5 text-xs font-medium text-amber">
                    {Array.from({ length: loc.priority }).map((_, i) => (
                      <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
                    ))}
                  </span>
                </div>
                <LocationImage src={loc.imageUrl} alt={loc.name} />
                <p className="mb-1 flex items-center gap-1 text-xs text-espresso/70">
                  <MapPin size={12} /> {loc.country}
                </p>
                <p className="mb-2 inline-block rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta">
                  {loc.category}
                </p>
                {loc.notes && <p className="mb-2 text-xs text-espresso/70">{loc.notes}</p>}
                <div className="flex items-center gap-2 border-t border-black/10 pt-2">
                  <button
                    type="button"
                    onClick={() => onToggleVisited(loc.id)}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                  >
                    {loc.visited ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    {loc.visited ? 'Visited' : 'Mark visited'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(loc.id)}
                    className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
