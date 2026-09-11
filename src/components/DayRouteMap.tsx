import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronLeft, ChevronRight, List, MapPin, Route, X } from 'lucide-react'
import type { Location } from '../types/location'
import type { TripDay, TripItem } from '../types/trip'
import type { Coordinates } from '../utils/travelEstimate'
import { fetchRoutePath } from '../api/osrm'
import { TILE_URLS, TILE_ATTRIBUTION } from './Map'

const HARBOR = '#12857B'

function routeStopIcon(n: number): L.DivIcon {
  return L.divIcon({
    html: `<div class="wl-route-pin">${n}</div>`,
    className: 'wl-route-pin-wrapper',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  })
}

function finiteCoords(latitude?: number, longitude?: number): Coordinates | null {
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : null
}

interface RouteStop {
  id: string
  name: string
  coords: Coordinates
}

// A day's mappable stops, in itinerary order: location items with coordinates (own snapshot, or the
// linked bucket-list location's). Notes / transport / lodging have no coordinates and are skipped.
function stopsForDay(dayId: string, items: TripItem[], locations: Location[]): RouteStop[] {
  const stops: RouteStop[] = []
  for (const item of items) {
    if (item.dayId !== dayId || item.kind !== 'location') continue
    const own = finiteCoords(item.latitude, item.longitude)
    const linked = !own && item.locationId ? locations.find((l) => l.id === item.locationId) : undefined
    const coords = own ?? (linked ? finiteCoords(linked.latitude, linked.longitude) : null)
    if (coords) stops.push({ id: item.id, name: item.name, coords })
  }
  return stops
}

function formatDayDate(iso?: string): string | undefined {
  if (!iso) return undefined
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// Fits the map to the given points and keeps Leaflet's size correct — the pane can mount at a size
// that isn't settled yet (it lives in a flex column that toggles), so we invalidate on mount + resize.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const raf = requestAnimationFrame(() => map.invalidateSize())
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [map])

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 13)
    } else {
      map.fitBounds(points, { padding: [40, 40] })
    }
  }, [map, points])

  return null
}

interface DayRouteMapProps {
  days: TripDay[]
  items: TripItem[]
  locations: Location[]
  selectedDayId: string | null
  onSelectDay: (dayId: string) => void
  theme: 'light' | 'dark'
  /** Desktop only: hide the map pane (the header on/off switch lives in the trip header). */
  onClose?: () => void
  /** Mobile only: switch back to the itinerary list (the stacked layout shows one at a time). */
  onBackToList?: () => void
}

export function DayRouteMap({ days, items, locations, selectedDayId, onSelectDay, theme, onClose, onBackToList }: DayRouteMapProps) {
  const dayIndex = Math.max(0, days.findIndex((d) => d.id === selectedDayId))
  const day = days[dayIndex] as TripDay | undefined

  const stops = useMemo(() => (day ? stopsForDay(day.id, items, locations) : []), [day, items, locations])
  const points = useMemo(() => stops.map((s) => [s.coords.latitude, s.coords.longitude] as [number, number]), [stops])

  // Road-following route from OSRM, refetched when the ordered stops change. Falls back to null (the
  // straight-line polyline below) on any failure. A stable key over the coordinates drives the effect.
  const pointsKey = points.map((p) => p.join(',')).join(';')
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null)

  useEffect(() => {
    setRoutePath(null)
    if (stops.length < 2) return
    const controller = new AbortController()
    fetchRoutePath(stops.map((s) => s.coords), controller.signal).then((path) => {
      if (!controller.signal.aborted) setRoutePath(path)
    })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey])

  const line = routePath ?? points
  const isFallbackLine = routePath === null && points.length >= 2
  const fitPoints = routePath ?? points

  const dayLabel = day ? day.name || `Day ${dayIndex + 1}` : ''
  const dateLabel = formatDayDate(day?.date)

  return (
    <div className="flex h-full w-full flex-col bg-white/40 dark:bg-black/20">
      {/* Header: day nav + stop count (+ desktop close). */}
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10">
        {onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            aria-label="Back to itinerary list"
            title="Back to list"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-black/10 px-2 py-1 text-xs font-medium text-ink/60 hover:text-harbor dark:border-white/10 dark:text-mist-light/60 lg:hidden"
          >
            <List size={14} /> List
          </button>
        ) : (
          <Route size={15} className="shrink-0 text-harbor" />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            type="button"
            onClick={() => days[dayIndex - 1] && onSelectDay(days[dayIndex - 1].id)}
            disabled={dayIndex <= 0}
            aria-label="Previous day"
            title="Previous day"
            className="shrink-0 rounded p-1 text-ink/50 hover:bg-harbor/10 hover:text-harbor disabled:cursor-not-allowed disabled:opacity-30 dark:text-mist-light/50"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-ink dark:text-mist-light">{dayLabel || 'Route'}</p>
            <p className="truncate text-[11px] text-ink/50 dark:text-mist-light/50">
              {dateLabel ? `${dateLabel} · ` : ''}
              {stops.length} mapped stop{stops.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => days[dayIndex + 1] && onSelectDay(days[dayIndex + 1].id)}
            disabled={dayIndex >= days.length - 1}
            aria-label="Next day"
            title="Next day"
            className="shrink-0 rounded p-1 text-ink/50 hover:bg-harbor/10 hover:text-harbor disabled:cursor-not-allowed disabled:opacity-30 dark:text-mist-light/50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide map"
            title="Hide map"
            className="hidden shrink-0 rounded p-1 text-ink/40 hover:bg-black/5 hover:text-ink dark:text-mist-light/40 dark:hover:bg-white/10 lg:block"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="relative flex-1">
        {days.length === 0 ? (
          <EmptyState icon={<Route size={26} />} text="Add days to your trip to see a route." />
        ) : stops.length === 0 ? (
          <EmptyState
            icon={<MapPin size={26} />}
            text="No mapped stops on this day yet. Add locations with coordinates to plot the route."
          />
        ) : (
          <MapContainer center={points[0]} zoom={13} zoomControl={false} className="h-full w-full">
            <TileLayer url={TILE_URLS[theme]} attribution={TILE_ATTRIBUTION} noWrap />
            <FitBounds points={fitPoints} />
            {line.length >= 2 && (
              <Polyline
                positions={line}
                pathOptions={{
                  color: HARBOR,
                  weight: 4,
                  opacity: 0.85,
                  // Dashed = straight-line fallback (OSRM unavailable), so the line reads as approximate.
                  dashArray: isFallbackLine ? '6 8' : undefined,
                }}
              />
            )}
            {stops.map((stop, idx) => (
              <Marker key={stop.id} position={[stop.coords.latitude, stop.coords.longitude]} icon={routeStopIcon(idx + 1)}>
                <Popup>
                  <div className="p-1 font-body">
                    <span className="text-xs font-semibold text-harbor">Stop {idx + 1}</span>
                    <p className="text-sm font-semibold text-ink dark:text-mist-light">{stop.name}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-ink/45 dark:text-mist-light/45">
      {icon}
      <p className="max-w-xs text-sm">{text}</p>
    </div>
  )
}
