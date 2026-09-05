import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Compass, Heart, Loader2, MapPin, Sparkles, X } from 'lucide-react'
import { LocationImage } from './LocationImage'
import { searchPexelsPhotos } from '../api/pexels'
import type { Suggestion } from '../api/wikivoyage'

// Horizontal drag (px) past which releasing commits a swipe. Below it, the card snaps back.
const SWIPE_THRESHOLD = 90
// Fly-off duration for a committed swipe, and how long the "It's a match" screen lingers before it
// auto-advances to the next card.
const EXIT_MS = 320
const MATCH_MS = 1600
// A profile shows up to this many photos; fetched from Pexels, deduped against the suggestion's own.
const MAX_CARD_IMAGES = 5

interface SuggestionSwiperProps {
  suggestions: Suggestion[]
  isLoading: boolean
  /** Save the suggestion to the bucket list (with the photos shown), then advance. */
  onSwipeRight: (suggestion: Suggestion, images: string[]) => void
  /** Drop the suggestion from the pool, then advance. */
  onSwipeLeft: (suggestion: Suggestion) => void
  onClose: () => void
}

// A full-screen, dating-app-style deck: one destination at a time, drag (or tap the buttons) right to
// save it to the bucket list, left to skip it. Scroll a card vertically to flip through its photos and
// read the blurb, like a profile.
export function SuggestionSwiper({ suggestions, isLoading, onSwipeRight, onSwipeLeft, onClose }: SuggestionSwiperProps) {
  // The swiper drives its OWN queue rather than reading the live pool directly. Saving a suggestion
  // adds a bucket-list location, which changes the pool's signature and makes useSuggestions reset and
  // refetch — reading it directly would yank the deck out from under the player after every save. The
  // queue advances locally on each swipe; background refills are merged in (below) so it can run dry
  // gracefully and top up.
  const [queue, setQueue] = useState<Suggestion[]>(() => suggestions)
  const actionedRef = useRef<Set<string>>(new Set())
  const current = queue[0] as Suggestion | undefined

  // Merge in any suggestions from the live pool we haven't already queued or acted on (initial load +
  // background top-ups). Never removes — removal is driven only by the player's own swipes.
  useEffect(() => {
    setQueue((prev) => {
      const have = new Set<string>([...prev.map((s) => s.name), ...actionedRef.current])
      const additions = suggestions.filter((s) => !have.has(s.name))
      return additions.length ? [...prev, ...additions] : prev
    })
  }, [suggestions])

  const [drag, setDrag] = useState(0) // live horizontal offset of the top card, px (0 = at rest)
  const [dragging, setDragging] = useState(false)
  const [exiting, setExiting] = useState<{ suggestion: Suggestion; images: string[]; dir: 1 | -1 } | null>(null)
  const [matched, setMatched] = useState<Suggestion | null>(null)
  const busy = exiting !== null || matched !== null

  // Photos for the current card, fetched from Pexels and cached by name so re-showing is instant.
  const [images, setImages] = useState<string[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const cacheRef = useRef<Map<string, string[]>>(new Map())

  useEffect(() => {
    if (!current) {
      setImages([])
      return
    }
    const seed = current.imageUrl ? [current.imageUrl] : []
    const cached = cacheRef.current.get(current.name)
    if (cached) {
      setImages(cached)
      return
    }
    setImages(seed)
    setImagesLoading(true)
    let cancelled = false
    searchPexelsPhotos(`${current.name} ${current.country}`, 8)
      .then((photos) => {
        if (cancelled) return
        const merged = [...new Set([...seed, ...photos.map((p) => p.url)])].slice(0, MAX_CARD_IMAGES)
        const final = merged.length ? merged : seed
        cacheRef.current.set(current.name, final)
        setImages(final)
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [current?.name, current?.country]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer-drag bookkeeping. Axis is locked on the first meaningful move so a vertical drag scrolls
  // the photos (touch-action: pan-y handles that natively) while a horizontal drag swipes the card.
  const startRef = useRef({ x: 0, y: 0 })
  const axisRef = useRef<'h' | 'v' | null>(null)
  const activeRef = useRef(false)

  const onPointerDown = (e: ReactPointerEvent) => {
    if (busy || !current) return
    activeRef.current = true
    axisRef.current = null
    startRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!activeRef.current || busy) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (axisRef.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axisRef.current === 'h') setDragging(true)
    }
    if (axisRef.current === 'v') return // let the photos scroll
    setDrag(dx)
  }

  const endDrag = () => {
    if (!activeRef.current) return
    activeRef.current = false
    setDragging(false)
    const dx = drag
    axisRef.current = null
    if (dx > SWIPE_THRESHOLD) commit(1)
    else if (dx < -SWIPE_THRESHOLD) commit(-1)
    else setDrag(0)
  }

  const commit = (dir: 1 | -1) => {
    if (!current || busy) return
    const suggestion = current
    const imgs = images
    setDrag(0)
    // Advance the local queue now (revealing the next card underneath) and capture the outgoing card
    // so it can fly off on top. Report the action upstream to persist the save / dismissal.
    actionedRef.current.add(suggestion.name)
    setQueue((prev) => prev.slice(1))
    setExiting({ suggestion, images: imgs, dir })
    if (dir === 1) onSwipeRight(suggestion, imgs)
    else onSwipeLeft(suggestion)
    window.setTimeout(() => {
      setExiting(null)
      if (dir === 1) setMatched(suggestion)
    }, EXIT_MS)
  }

  const rotation = drag / 18
  const saveHint = Math.max(0, Math.min(drag / SWIPE_THRESHOLD, 1))
  const skipHint = Math.max(0, Math.min(-drag / SWIPE_THRESHOLD, 1))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Discover places"
      className="fixed inset-0 z-[1200] flex flex-col bg-mist-light/95 backdrop-blur-sm dark:bg-ink/85 sm:items-center sm:justify-center sm:bg-transparent sm:p-6 sm:backdrop-blur-none dark:sm:bg-transparent"
    >
      {/* Full-screen on mobile; a centered, contained large popup from `sm` up so the card isn't a
          lonely narrow strip on a wide screen. The stage + chrome are theme-aware — light surface with
          dark text in light mode, dark surface with light text in dark mode. */}
      <div className="relative flex w-full flex-1 flex-col overflow-hidden sm:h-[86vh] sm:max-h-[760px] sm:w-full sm:max-w-md sm:flex-none sm:rounded-3xl sm:border sm:border-black/10 sm:bg-white/55 sm:shadow-2xl sm:backdrop-blur-2xl dark:sm:border-white/10 dark:sm:bg-ink dark:sm:backdrop-blur-none">
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink dark:text-mist-light">
            <Sparkles size={18} className="text-harbor dark:text-brass-100" /> Discover places
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-black/5 p-2 text-ink transition-colors hover:bg-black/10 dark:bg-white/10 dark:text-mist-light dark:hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col px-4 pb-3 sm:max-w-none">
        <div className="relative min-h-0 flex-1">
          {current ? (
            <>
              {/* Base card = the current (top-of-deck) suggestion. */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl shadow-2xl">
                <ProfileCard suggestion={current} images={images} imagesLoading={imagesLoading} />
              </div>

              {/* Draggable layer sits on top of the base card and carries the swipe gesture + stamps.
                  While a card is flying off (exiting) this layer is replaced by the exiting overlay. */}
              {!exiting && (
                <div
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{
                    transform: `translateX(${drag}px) rotate(${rotation}deg)`,
                    transition: dragging ? 'none' : 'transform 250ms ease',
                    touchAction: 'pan-y',
                  }}
                  className="absolute inset-0 cursor-grab overflow-hidden rounded-3xl shadow-2xl active:cursor-grabbing"
                >
                  <ProfileCard suggestion={current} images={images} imagesLoading={imagesLoading} />
                  <Stamp kind="save" opacity={saveHint} />
                  <Stamp kind="skip" opacity={skipHint} />
                </div>
              )}

              {/* Exiting overlay: the just-swiped card animating off screen. */}
              {exiting && <ExitingCard data={exiting} />}
            </>
          ) : (
            <EmptyState isLoading={isLoading} onClose={onClose} />
          )}
        </div>

        {current && (
          <div className="mt-4 flex shrink-0 items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => commit(-1)}
              disabled={busy}
              aria-label="Skip this place"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-red-500 shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
            >
              <X size={26} strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => commit(1)}
              disabled={busy}
              aria-label="Save this place to my bucket list"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-harbor shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
            >
              <Heart size={26} fill="currentColor" strokeWidth={0} />
            </button>
          </div>
          )}
        </div>

        {matched && <MatchScreen suggestion={matched} onDone={() => setMatched(null)} />}
      </div>
    </div>
  )
}

// One destination "profile": a scrollable column that interleaves photos with the place's text —
// first photo, then name/country, then a second photo, then the blurb, then the rest of the photos.
// Photos are rounded and gap-separated so they read as distinct shots, not one long strip. On desktop
// they're taller to fill the wider popup. touch-action: pan-y lets a vertical drag scroll here while a
// horizontal drag (caught by the parent layer) swipes the whole card.
function ProfileCard({
  suggestion,
  images,
  imagesLoading,
}: {
  suggestion: Suggestion
  images: string[]
  imagesLoading: boolean
}) {
  const imgClass = 'w-full shrink-0 rounded-2xl object-cover h-64 sm:h-96'
  // The photos that come after the name/country and description blocks.
  const trailingImages = images.slice(2)

  return (
    <div
      className="trip-scroll flex h-full flex-col gap-3 overflow-y-auto overscroll-contain bg-white/45 p-3 backdrop-blur-2xl dark:bg-ink dark:backdrop-blur-none"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Photo 1 */}
      <LocationImage src={images[0]} alt={suggestion.name} className={imgClass} />

      {/* Name + country */}
      <div className="shrink-0 px-1">
        <h3 className="font-display text-2xl font-semibold leading-tight text-ink dark:text-mist-light">
          {suggestion.name}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink/70 dark:text-mist-light/70">
          <MapPin size={14} className="shrink-0 text-harbor" /> {suggestion.country}
        </p>
      </div>

      {/* Photo 2 */}
      {images[1] && (
        <LocationImage src={images[1]} alt={`${suggestion.name} photo 2`} className={imgClass} />
      )}

      {/* Description */}
      {suggestion.description && (
        <p className="shrink-0 px-1 text-sm leading-relaxed text-ink/75 dark:text-mist-light/75">
          {suggestion.description}
        </p>
      )}

      {/* Remaining photos */}
      {trailingImages.map((url, i) => (
        <LocationImage key={`${url}-${i}`} src={url} alt={`${suggestion.name} photo ${i + 3}`} className={imgClass} />
      ))}

      {imagesLoading && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-2 text-xs text-ink/50 dark:text-mist-light/50">
          <Loader2 size={14} className="animate-spin" /> finding more photos…
        </div>
      )}
    </div>
  )
}

// The tilted "SAVE"/"SKIP" stamp that fades in as the card is dragged toward that choice.
function Stamp({ kind, opacity }: { kind: 'save' | 'skip'; opacity: number }) {
  const isSave = kind === 'save'
  return (
    <span
      style={{ opacity }}
      className={`pointer-events-none absolute top-8 rounded-lg border-4 px-3 py-1 font-display text-2xl font-extrabold uppercase tracking-wider ${
        isSave
          ? 'left-6 -rotate-12 border-harbor text-harbor'
          : 'right-6 rotate-12 border-red-500 text-red-500'
      }`}
    >
      {isSave ? 'Save' : 'Skip'}
    </span>
  )
}

// A snapshot of the swiped card, mounted for one beat and animated off screen in the swipe direction.
function ExitingCard({ data }: { data: { suggestion: Suggestion; images: string[]; dir: 1 | -1 } }) {
  const [off, setOff] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOff(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const tx = data.dir === 1 ? '130%' : '-130%'
  const rot = data.dir === 1 ? '20deg' : '-20deg'
  return (
    <div
      style={{
        transform: off ? `translateX(${tx}) rotate(${rot})` : 'translateX(0) rotate(0)',
        opacity: off ? 0 : 1,
        transition: `transform ${EXIT_MS}ms ease-out, opacity ${EXIT_MS}ms ease-out`,
      }}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl shadow-2xl"
    >
      <ProfileCard suggestion={data.suggestion} images={data.images} imagesLoading={false} />
      <Stamp kind={data.dir === 1 ? 'save' : 'skip'} opacity={1} />
    </div>
  )
}

// Celebratory beat after a save, then it auto-advances (or tap to continue now).
function MatchScreen({ suggestion, onDone }: { suggestion: Suggestion; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, MATCH_MS)
    return () => window.clearTimeout(t)
  }, [onDone])
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onDone}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onDone()
      }}
      aria-label="Continue to the next place"
      className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-5 bg-gradient-to-b from-harbor to-ink p-6 text-center text-white animate-match-pop"
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15">
        <Heart size={52} fill="currentColor" strokeWidth={0} className="animate-heart-beat text-brass-100" />
      </span>
      <div>
        <h3 className="font-display text-3xl font-bold">It’s a match!</h3>
        <p className="mt-2 text-white/90">
          <span className="font-semibold">{suggestion.name}</span> is now on your bucket list.
        </p>
      </div>
      <span className="text-xs font-medium text-white/60">Tap to continue</span>
    </div>
  )
}

function EmptyState({ isLoading, onClose }: { isLoading: boolean; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-ink">
      {isLoading ? (
        <>
          <Loader2 size={32} className="animate-spin text-harbor" />
          <p className="text-sm text-ink/60 dark:text-mist-light/60">Researching destinations you might love…</p>
        </>
      ) : (
        <>
          <Compass size={36} className="text-harbor" />
          <div>
            <h3 className="font-display text-lg font-semibold text-ink dark:text-mist-light">You’re all caught up</h3>
            <p className="mt-1 text-sm text-ink/60 dark:text-mist-light/60">
              No more suggestions right now. Add more places to your bucket list to discover new ideas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-full bg-harbor px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </>
      )}
    </div>
  )
}
