import { useEffect, useState } from 'react'

// Phones and tablets (< Tailwind's `lg`, 1024px) share the mobile design: bottom sheets, docks, the maps-style
// map page. Components that branch on this should use `lg:` (not `sm:`) for their desktop-only classes.
export const MOBILE_BREAKPOINT = 1024

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handleChange = () => setIsMobile(mql.matches)
    handleChange()
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [breakpoint])

  return isMobile
}
