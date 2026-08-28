import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Location } from '../types/location'
import { LocationImage } from './LocationImage'

interface FlyToListCardProps {
  loc: Location
  /** Where the animation starts — the tray card's on-screen rect. */
  from: DOMRect
  /** Where it lands — the Unscheduled list's on-screen rect. */
  to: DOMRect
  onDone: () => void
}

// Keeps the flight endpoint on-screen even when the target list is scrolled out of
// view, so the card visibly "lands" near where the list sits rather than flying off.
const EDGE_MARGIN = 48

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * A portaled "ghost" of a bucket-list card that flies from the tray, pops toward the
 * middle of the screen, then settles into the Unscheduled list — visible confirmation
 * that "Add to trip" worked even though the list is hidden behind the tray. Purely
 * cosmetic and pointer-transparent; it runs once then unmounts via onDone.
 */
export function FlyToListCard({ loc, from, to, onDone }: FlyToListCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      onDone()
      return
    }

    const originX = from.left + from.width / 2
    const originY = from.top + from.height / 2
    const viewCenter = `translate(${window.innerWidth / 2 - originX}px, ${window.innerHeight / 2 - originY}px)`

    const targetX = clamp(to.left + to.width / 2, EDGE_MARGIN, window.innerWidth - EDGE_MARGIN)
    const targetY = clamp(to.top + EDGE_MARGIN, EDGE_MARGIN, window.innerHeight - EDGE_MARGIN)
    const targetShift = `translate(${targetX - originX}px, ${targetY - originY}px)`

    const anim = el.animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0 },
        { transform: `${viewCenter} scale(1.12)`, opacity: 1, offset: 0.45 },
        { transform: `${targetShift} scale(0.5)`, opacity: 0, offset: 1 },
      ],
      { duration: 850, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    )
    anim.onfinish = onDone

    return () => anim.cancel()
    // Runs once for this flight — the component is remounted (keyed) per click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', left: from.left, top: from.top, width: from.width, zIndex: 1200 }}
      className="pointer-events-none flex flex-col rounded-xl border border-black/10 bg-white/90 p-3 shadow-2xl backdrop-blur-sm dark:border-white/10 dark:bg-[#333]/90"
    >
      <LocationImage src={loc.images[0]} alt={loc.name} className="mb-2 h-24 w-full rounded-lg object-cover" />
      <p className="truncate font-display text-sm font-semibold text-ink dark:text-mist-light">{loc.name}</p>
    </div>,
    document.body,
  )
}
