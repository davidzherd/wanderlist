import L from 'leaflet'
import 'leaflet.markercluster'

export function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  const size = count < 10 ? 40 : count < 30 ? 48 : 56

  return L.divIcon({
    html: `<div class="wl-cluster-icon" style="width:${size}px;height:${size}px;">${count}</div>`,
    className: 'wl-cluster-wrapper',
    iconSize: L.point(size, size, true),
  })
}

export function createMarkerIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div class="wl-marker-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg></div>`,
    className: 'wl-marker-wrapper',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}
