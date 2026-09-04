import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Loader2,
  MapPin,
  MapPinPlus,
  X,
} from 'lucide-react'
import { useSuggestions } from '../hooks/useSuggestions'
import { LocationImage } from './LocationImage'
import type { Suggestion } from '../api/wikivoyage'
import type { LocationFormValues } from '../types/location'

// Wikivoyage intro sentences can run past the notes field's 500-char cap — trim before prefilling.
const MAX_NOTES = 480

// The carousel shows exactly PER_VIEW cards at rest and advances STEP cards per arrow click, looping
// infinitely in both directions.
//
// At rest it renders ONLY the PER_VIEW visible cards, so a partial/half card can never be parked in
// the viewport. To *slide*, a move renders a wider strip (PER_VIEW + STEP cards) holding both the
// outgoing and incoming cards, translates it by STEP cards, then commits `start` and drops back to the
// three-card resting state on exactly the same frame — so the slide is real but nothing lingers
// half-visible afterwards. The wider strip needs PER_VIEW + STEP distinct cards, so the slide only
// runs when there are at least that many suggestions; with fewer, a move just swaps instantly.
const PER_VIEW = 3
const STEP = 2
const SLIDE_MS = 300
const SHIFT_PCT = STEP * (100 / PER_VIEW) // how far to translate for a STEP-card slide

function toPrefill(suggestion: Suggestion): Partial<LocationFormValues> {
  const notes = suggestion.description
  return {
    name: suggestion.name,
    country: suggestion.country,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    notes: notes && notes.length > MAX_NOTES ? `${notes.slice(0, MAX_NOTES - 1).trimEnd()}…` : notes,
    images: suggestion.imageUrl ? [suggestion.imageUrl] : [],
  }
}

interface SuggestionTrayProps {
  /** Opens the add-location popup pre-filled with the chosen suggestion's data. */
  onSave: (prefill: Partial<LocationFormValues>) => void
}

// A floating bottom tray of researched destinations, styled to match the Trips bucket-list bar.
// Hidden entirely while there's nothing (yet) to show, so it never occupies the map for no reason.
export function SuggestionTray({ onSave }: SuggestionTrayProps) {
  const { suggestions, isLoading, dismiss } = useSuggestions()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [start, setStart] = useState(0) // index of the leftmost visible card, in [0, n)
  const [anim, setAnim] = useState<1 | -1 | null>(null) // in-flight slide direction, else null

  const n = suggestions.length
  const canPage = n > PER_VIEW
  const canSlide = n >= PER_VIEW + STEP

  const rowRef = useRef<HTMLDivElement | null>(null)
  const animatingRef = useRef(false)

  const at = (i: number) => suggestions[(((i % n) + n) % n)] // wrapped lookup

  // Keep `start` in range as cards are dismissed or a refill lands (no-op if already valid).
  useEffect(() => {
    setStart((s) => (n > 0 ? Math.min(s, n - 1) : 0))
  }, [n])

  // Run the slide when a move is requested, then commit `start` and clear `anim` on the same frame the
  // animation ends. useLayoutEffect starts the animation before paint so the first frame is the
  // "from" position (never a flash of the end state).
  useLayoutEffect(() => {
    if (anim === null) return
    const el = rowRef.current
    let done = false
    const commit = () => {
      if (done) return // one-shot: finish and a late cancel() must not double-advance `start`
      done = true
      setStart((s) => (((s + anim * STEP) % n) + n) % n)
      setAnim(null)
      animatingRef.current = false
    }
    if (!el) {
      commit()
      return
    }
    // Forward: strip is [start … start+4], slide 0 → -SHIFT_PCT. Backward: strip is [start-2 … start+2],
    // slide -SHIFT_PCT → 0. Either way the resting three cards start in view and the new pair slides in.
    const from = anim === 1 ? 0 : -SHIFT_PCT
    const to = anim === 1 ? -SHIFT_PCT : 0
    const animation = el.animate(
      [{ transform: `translateX(${from}%)` }, { transform: `translateX(${to}%)` }],
      { duration: SLIDE_MS, easing: 'ease-in-out', fill: 'backwards' },
    )
    animation.onfinish = commit
    // Fallback: if `onfinish` never fires (e.g. a backgrounded tab pauses the animation clock), still
    // commit so the carousel can't get stuck mid-slide. The one-shot guard makes whichever runs second
    // a no-op.
    const fallback = setTimeout(commit, SLIDE_MS + 80)
    return () => {
      clearTimeout(fallback)
      animation.cancel() // cleanup only fires after commit flipped `anim`; guard blocks re-commit
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim])

  const shift = (dir: 1 | -1) => {
    if (!canPage || animatingRef.current) return
    if (!canSlide) {
      setStart((s) => (((s + dir * STEP) % n) + n) % n)
      return
    }
    animatingRef.current = true
    setAnim(dir)
  }

  const showLoading = isLoading && suggestions.length === 0
  if (!showLoading && suggestions.length === 0) return null

  // The cards to render, and the row's resting transform. During a slide we render the wider strip and
  // rest it at the animation's end position, so when the Web Animation finishes (fill: none) the
  // element reverts to exactly what we're about to commit — no flicker at the handoff.
  let windowStart = start
  let windowLen = PER_VIEW
  let baseTransform = 0
  if (anim === 1) {
    windowStart = start
    windowLen = PER_VIEW + STEP
    baseTransform = -SHIFT_PCT
  } else if (anim === -1) {
    windowStart = start - STEP
    windowLen = PER_VIEW + STEP
    baseTransform = 0
  }
  const visible = canPage
    ? Array.from({ length: windowLen }, (_, i) => at(windowStart + i))
    : suggestions

  // `z-[800]` sits above Leaflet's map panes (tiles 200 … popups 700), which share this stacking
  // context because `.leaflet-container` doesn't create one — at a lower z the map paints over the
  // tray and hides it (while the panes' `pointer-events:none` still lets clicks/inspector through,
  // so it looks "present but invisible"). Kept below the Add button (z-900), which it's offset from.
  // `sm:right-24` keeps the tray clear of that floating Add button (fixed bottom-6 right-6).
  return (
    <div className="pointer-events-none fixed inset-x-2 bottom-2 z-[800] flex justify-center sm:right-24">
      <div className="relative w-full max-w-3xl">
        <div aria-hidden="true" className="glow-border animate-glow-pulse" />
        <div className="glass-panel pointer-events-auto relative z-10 flex w-full max-w-full flex-col gap-2 rounded-2xl p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand relevant locations' : 'Collapse relevant locations'}
              className="flex flex-1 items-center gap-2 px-1 text-left"
            >
              <Compass size={15} className="shrink-0 text-harbor" />
              <span className="text-xs font-semibold text-ink dark:text-mist-light">
                Relevant locations for you
              </span>
              {showLoading ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-ink/50 dark:text-mist-light/50">
                  <Loader2 size={11} className="animate-spin" /> finding ideas…
                </span>
              ) : (
                <span className="text-[11px] font-medium text-ink/50 dark:text-mist-light/50">
                  based on your bucket list
                </span>
              )}
              {isCollapsed ? (
                <ChevronUp size={18} className="ml-auto shrink-0 text-ink/50 dark:text-mist-light/50" />
              ) : (
                <ChevronDown size={18} className="ml-auto shrink-0 text-ink/50 dark:text-mist-light/50" />
              )}
            </button>
          </div>

          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
              isCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
            }`}
          >
            {showLoading ? (
              <p className="px-1 py-6 text-center text-xs text-ink/50 dark:text-mist-light/50">
                Researching destinations in the countries you love…
              </p>
            ) : (
              <div className="flex items-stretch gap-1 pt-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  aria-label="Previous suggestions"
                  className={`glass-panel flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-ink transition-colors hover:bg-white/20 dark:text-mist-light ${
                    canPage ? '' : 'invisible'
                  }`}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div
                    ref={rowRef}
                    className="flex items-stretch"
                    style={{ transform: `translateX(${baseTransform}%)` }}
                  >
                    {visible.map((s) => (
                      <div
                        key={`${s.name}-${s.country}`}
                        className="shrink-0 basis-1/3 px-1 sm:px-1.5"
                      >
                        <div className="relative flex h-full flex-col rounded-xl border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-black/30 sm:p-3">
                          <button
                            type="button"
                            onClick={() => dismiss(s.name)}
                            aria-label={`Dismiss ${s.name}`}
                            className="absolute right-1.5 top-1.5 z-[1] rounded-full bg-black/45 p-0.5 text-white transition-colors hover:bg-black/70"
                          >
                            <X size={12} />
                          </button>
                          <LocationImage
                            src={s.imageUrl}
                            alt={s.name}
                            className="mb-2 h-20 w-full rounded-lg object-cover sm:h-28"
                          />
                          <h3 className="truncate font-display text-xs font-semibold text-ink dark:text-mist-light sm:text-sm">
                            {s.name}
                          </h3>
                          <p className="mb-1 flex items-center gap-1 text-[11px] text-ink/70 dark:text-mist-light/70 sm:text-xs">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{s.country}</span>
                          </p>
                          {s.description && (
                            <p className="mb-2 line-clamp-2 text-[11px] text-ink/70 dark:text-mist-light/70 sm:text-xs">
                              {s.description}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => onSave(toPrefill(s))}
                            className="mt-auto flex w-full items-center justify-center gap-1 rounded-lg bg-harbor px-2 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 sm:gap-1.5 sm:py-1.5 sm:text-xs"
                          >
                            <MapPinPlus size={12} className="shrink-0" /> Save
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => shift(1)}
                  aria-label="Next suggestions"
                  className={`glass-panel flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-ink transition-colors hover:bg-white/20 dark:text-mist-light ${
                    canPage ? '' : 'invisible'
                  }`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
