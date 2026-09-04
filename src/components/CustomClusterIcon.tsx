import L from 'leaflet'
import 'leaflet.markercluster'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_PIN_COLOR, getPinContrastColor, TRAVEL_ICON_MAP } from './pinStyle'

// Lucide icons are React components, but the marker is a raw-HTML Leaflet divIcon, so render the
// icon to a static SVG string once and cache it per name+color (createMarkerIcon runs for every
// marker on every map render).
const iconMarkupCache = new Map<string, string>()

function renderIconMarkup(name: string, color: string): string {
  const cacheKey = `${name}|${color}`
  const cached = iconMarkupCache.get(cacheKey)
  if (cached) return cached
  const Icon = TRAVEL_ICON_MAP[name]
  if (!Icon) return ''
  const markup = renderToStaticMarkup(createElement(Icon, { size: 16, color, strokeWidth: 2.5 }))
  iconMarkupCache.set(cacheKey, markup)
  return markup
}

export function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  const size = count < 10 ? 40 : count < 30 ? 48 : 56

  return L.divIcon({
    html: `<div class="wl-cluster-icon" style="width:${size}px;height:${size}px;">${count}</div>`,
    className: 'wl-cluster-wrapper',
    iconSize: L.point(size, size, true),
  })
}

// The live "you are here" marker: a pulsing dot in the app's harbor accent (not the generic Google
// blue), sized so its center sits exactly on the user's coordinates. The pulse ring is a pseudo-
// element animated in index.css.
export function createUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    html: '<div class="wl-user-dot"></div>',
    className: 'wl-user-dot-wrapper',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export function createMarkerIcon(color?: string, emoji?: string, icon?: string): L.DivIcon {
  const fill = color || DEFAULT_PIN_COLOR
  const contrast = getPinContrastColor(fill)
  // The teardrop is rotated -45deg, so its content is counter-rotated 45deg to sit upright.
  // Priority: emoji, then a line icon, then the original dot — the dot and icons are colored
  // for contrast so they stay visible on light pins.
  let inner: string
  if (emoji) {
    inner = `<span class="wl-marker-emoji">${emoji}</span>`
  } else if (icon && TRAVEL_ICON_MAP[icon]) {
    inner = renderIconMarkup(icon, contrast)
  } else {
    inner = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${contrast}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>`
  }

  return L.divIcon({
    html: `<div class="wl-marker-icon" style="background:${fill}">${inner}</div>`,
    className: 'wl-marker-wrapper',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}
