import type { Coordinates } from '../utils/travelEstimate'

// Road-following route geometry from OSRM's public demo server (router.project-osrm.org): free,
// keyless, CORS-enabled, but NO SLA and fair-use only — fine for the handful of requests a day-route
// map makes on demand. Every path FAILS SOFT: <2 points, network error, non-2xx, abort, or an
// unexpected shape all resolve to null so the caller draws straight lines between the stops instead.
// Never throws.

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

// In-memory cache of successful routes, keyed by the exact ordered coordinate path. Switching days
// back and forth — or any two days sharing the same stops in the same order — reuses the result
// instead of re-hitting OSRM's fair-use demo server. Only successes are cached, so a transient
// failure can still recover on the next visit. Lives for the session (a page reload clears it), which
// is plenty: a day's route only changes when its stops or their order change, which produces a new key.
const routeCache = new Map<string, [number, number][]>()

/**
 * Returns the driving route through `coords` (in order) as [lat, lng] pairs ready for a Leaflet
 * Polyline, or null when a route can't be fetched. Identical routes are served from an in-memory
 * cache. Pass an AbortSignal to cancel a stale in-flight request when the selected day / stops change.
 */
export async function fetchRoutePath(coords: Coordinates[], signal?: AbortSignal): Promise<[number, number][] | null> {
  if (coords.length < 2) return null
  const path = coords.map((c) => `${c.longitude},${c.latitude}`).join(';')

  const cached = routeCache.get(path)
  if (cached) return cached

  try {
    const res = await fetch(`${OSRM_URL}/${path}?overview=full&geometries=geojson`, { signal })
    if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`)
    const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] }
    const line = data.routes?.[0]?.geometry?.coordinates
    if (!Array.isArray(line) || line.length === 0) throw new Error('OSRM response had no geometry')
    // GeoJSON is [lon, lat]; Leaflet wants [lat, lon].
    const latLngs = line.map(([lon, lat]) => [lat, lon] as [number, number])
    routeCache.set(path, latLngs)
    return latLngs
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    console.error(err)
    return null
  }
}
