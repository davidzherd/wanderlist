import { MapContainer, TileLayer } from 'react-leaflet'
import { TILE_ATTRIBUTION, TILE_URLS } from './Map'

interface LandingMiniMapProps {
  theme: 'light' | 'dark'
  center: [number, number]
  zoom: number
  className?: string
}

/**
 * A non-interactive Leaflet map for marketing/mockup use on the landing page — same CARTO tile
 * source as the real map view, just with all interaction disabled so it reads as a static image.
 * `.leaflet-container` is `position: relative` but has no z-index of its own, so without an
 * explicit z-index here its internal panes (tiles/markers go up to z-index 600+) leak out and
 * paint above sibling overlays (pin dots, popup cards) that don't set a z-index themselves —
 * `absolute inset-0 z-0` pins the whole map to its own stacking context instead.
 */
export function LandingMiniMap({ theme, center, zoom, className = '' }: LandingMiniMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`absolute inset-0 z-0 ${className}`}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl={false}
    >
      <TileLayer url={TILE_URLS[theme]} attribution={TILE_ATTRIBUTION} noWrap />
    </MapContainer>
  )
}
