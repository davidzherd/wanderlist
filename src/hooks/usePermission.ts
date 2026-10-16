import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * - granted / prompt / denied: the browser's Permissions API answer.
 * - per-use: the browser has no such permission to query (clipboard on Safari/Firefox) — it asks on each use.
 * - unknown: no Permissions API at all (older Safari for location); we can still try to trigger the prompt.
 */
export type PermissionStatusValue = 'granted' | 'prompt' | 'denied' | 'per-use' | 'unknown'

export type AppPermission = 'geolocation' | 'clipboard-read'

/**
 * Live status of a browser permission plus a `request()` that pops the browser's own prompt when it still can.
 * Browsers never re-prompt once a permission is blocked — `request()` then just leaves it 'denied', and the UI
 * should explain how to unblock it in the site settings.
 */
export function usePermission(name: AppPermission) {
  const [status, setStatus] = useState<PermissionStatusValue>('unknown')
  // When the Permissions API answers, its change events are the truth after a prompt (a dismissed prompt fails the
  // same way a "Block" does, so guessing from the error would be wrong). Only without it do we infer from the result.
  const isQueryableRef = useRef(false)

  useEffect(() => {
    if (!navigator.permissions?.query) {
      setStatus(name === 'clipboard-read' ? 'per-use' : 'unknown')
      return
    }
    let permissionStatus: PermissionStatus | null = null
    const sync = () => permissionStatus && setStatus(permissionStatus.state)
    navigator.permissions
      .query({ name } as PermissionDescriptor)
      .then((result) => {
        permissionStatus = result
        isQueryableRef.current = true
        sync()
        result.addEventListener('change', sync)
      })
      // An unknown permission name throws (clipboard-read outside Chromium).
      .catch(() => setStatus(name === 'clipboard-read' ? 'per-use' : 'unknown'))
    return () => permissionStatus?.removeEventListener('change', sync)
  }, [name])

  const request = useCallback(async () => {
    if (name === 'geolocation') {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            if (!isQueryableRef.current) setStatus('granted')
            resolve()
          },
          (err) => {
            if (!isQueryableRef.current && err.code === err.PERMISSION_DENIED) setStatus('denied')
            resolve()
          },
        )
      })
      return
    }
    // Reading the clipboard is what triggers its prompt; the contents are ignored. Its status only exists where the
    // Permissions API knows it (Chromium), so the change listener above covers the result.
    try {
      await navigator.clipboard.read()
    } catch {
      /* blocked, dismissed or empty — the status listener reflects whichever it was */
    }
  }, [name])

  return { status, request }
}
