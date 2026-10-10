'use client'

import dynamic from 'next/dynamic'

// ssr: false — the app touches window/localStorage/Leaflet at import time, so it only runs in the browser.
const App = dynamic(() => import('../../src/App'), { ssr: false })

export function ClientApp() {
  return <App />
}
