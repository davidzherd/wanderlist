import { useCallback, useEffect, useRef, useState } from 'react'

export type GeolocationStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable'

export interface UserPosition {
  latitude: number
  longitude: number
  accuracy: number // meters — radius of the accuracy circle
}

interface GeolocationState {
  position: UserPosition | null
  status: GeolocationStatus
  start: () => void
  stop: () => void
}

/**
 * Live "you are here" tracking via the browser Geolocation API.
 *
 * Deliberately never auto-starts and never persists anything: the permission prompt only fires when
 * `start()` is called (the Locate button), and a denial is not cached on our side — the user can tap
 * again and the browser will re-evaluate permission whenever they're ready. `watchPosition` keeps the
 * position fresh as the user moves; the watch is torn down on unmount.
 */
export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<UserPosition | null>(null)
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const watchIdRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }
    // Already watching — leave the existing watch running (the caller handles recentering).
    if (watchIdRef.current !== null) return

    setStatus('locating')
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus('active')
      },
      (err) => {
        stop()
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )
  }, [stop])

  // Tear the watch down when the consuming view unmounts.
  useEffect(() => stop, [stop])

  return { position, status, start, stop }
}
