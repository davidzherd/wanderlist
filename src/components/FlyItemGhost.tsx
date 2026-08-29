import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface FlyItemGhostProps {
  /** Short label shown in the ghost — the item's title/name. */
  label: string
  /** Where it lands — the Unscheduled list's on-screen rect. */
  to: DOMRect
  onDone: () => void
}

// Keeps the flight endpoint on-screen even when the target list is scrolled out of view.
const EDGE_MARGIN = 48

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * A portaled "ghost" pill that pops from the center of the screen (where a tool popup just was) and
 * flies into the Unscheduled list — the same immediate "added!" cue the bucket-list tray uses
 * (FlyToListCard), but generic over any trip-item kind (note/transport/lodging/custom location)
 * rather than a location card. Purely cosmetic and pointer-transparent; runs once then unmounts.
 */
export function FlyItemGhost({ label, to, onDone }: FlyItemGhostProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      onDone()
      return
    }

    const originX = window.innerWidth / 2
    const originY = window.innerHeight / 2
    const targetX = clamp(to.left + to.width / 2, EDGE_MARGIN, window.innerWidth - EDGE_MARGIN)
    const targetY = clamp(to.top + EDGE_MARGIN, EDGE_MARGIN, window.innerHeight - EDGE_MARGIN)
    const targetShift = `translate(${targetX - originX}px, ${targetY - originY}px)`

    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.9)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: 0.25 },
        { transform: `translate(-50%, -50%) ${targetShift} scale(0.5)`, opacity: 0, offset: 1 },
      ],
      { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    )
    anim.onfinish = onDone

    return () => anim.cancel()
    // Runs once for this flight — the component is remounted (keyed) per add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', left: '50%', top: '50%', zIndex: 1200 }}
      className="pointer-events-none flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-4 py-2 shadow-2xl backdrop-blur-sm dark:border-white/10 dark:bg-[#333]/90"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-harbor" />
      <span className="max-w-[200px] truncate font-display text-sm font-semibold text-ink dark:text-mist-light">{label}</span>
    </div>,
    document.body,
  )
}
