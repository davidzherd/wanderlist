import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageCarouselProps {
  images: string[]
  alt: string
  /** Classes for the positioning wrapper (controls the carousel's footprint). */
  containerClassName?: string
  /** Classes for the <img> itself. */
  imgClassName?: string
  /** Where the dot indicators sit. Portrait cards push them up so they clear the details block. */
  dotsClassName?: string
}

// A minimal image carousel for locations with more than one photo. Advances via the arrows, the dot
// indicators, a horizontal drag/swipe, or the scroll wheel — the last two matter because the arrows
// are small and users reach for a scroll/swipe gesture first. It lives inside a Leaflet popup, whose
// content node already has click- and scroll-propagation disabled, so wheel gestures here don't zoom
// the map and drags don't pan it; nav handlers still stopPropagation defensively. Renders a plain
// <img> (no per-image error fallback) since these are user-curated photos; callers use LocationImage
// for the empty/single case where the "No image added" placeholder still matters.
export function ImageCarousel({
  images,
  alt,
  containerClassName = 'relative mb-2 h-28 w-full',
  imgClassName = 'h-full w-full rounded-lg object-cover',
  dotsClassName = 'bottom-2',
}: ImageCarouselProps) {
  const [index, setIndex] = useState(0)
  const count = images.length

  // Guard against the active index dangling past the end if the image list shrinks.
  useEffect(() => {
    if (index > count - 1) setIndex(0)
  }, [count, index])

  const step = (dir: number) => setIndex((i) => (i + dir + count) % count)

  const goButton = (e: MouseEvent, dir: number) => {
    e.preventDefault()
    e.stopPropagation()
    step(dir)
  }

  // Pointer drag / swipe: remember where the press started, and on release turn a horizontal
  // movement past a small threshold into a step. Works for both touch and mouse drag.
  const dragStartX = useRef<number | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    dragStartX.current = e.clientX
  }
  const onPointerUp = (e: PointerEvent) => {
    if (dragStartX.current === null) return
    const dx = e.clientX - dragStartX.current
    dragStartX.current = null
    if (Math.abs(dx) > 30) {
      e.stopPropagation()
      step(dx < 0 ? 1 : -1)
    }
  }

  // Scroll wheel / trackpad: throttled so one gesture advances one photo rather than racing through.
  const lastWheel = useRef(0)
  const onWheel = (e: WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 8) return
    const now = Date.now()
    if (now - lastWheel.current < 250) return
    lastWheel.current = now
    e.stopPropagation()
    step(delta > 0 ? 1 : -1)
  }

  return (
    <div
      className={`${containerClassName} ${count > 1 ? 'cursor-grab touch-pan-y select-none active:cursor-grabbing' : ''}`}
      onPointerDown={count > 1 ? onPointerDown : undefined}
      onPointerUp={count > 1 ? onPointerUp : undefined}
      onPointerLeave={count > 1 ? () => (dragStartX.current = null) : undefined}
      onWheel={count > 1 ? onWheel : undefined}
    >
      <img
        src={images[Math.min(index, count - 1)]}
        alt={alt}
        draggable={false}
        className={imgClassName}
      />
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => goButton(e, -1)}
            aria-label="Previous photo"
            className="absolute left-1.5 top-1/2 z-[1] -translate-y-1/2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => goButton(e, 1)}
            aria-label="Next photo"
            className="absolute right-1.5 top-1/2 z-[1] -translate-y-1/2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight size={16} />
          </button>
          <div className={`absolute inset-x-0 z-[1] flex items-center justify-center gap-1 ${dotsClassName}`}>
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIndex(i)
                }}
                aria-label={`Go to photo ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
