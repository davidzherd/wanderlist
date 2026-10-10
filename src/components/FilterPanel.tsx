import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { DEFAULT_FILTERS, type LocationFilters, type VisitedFilter } from '../context/LocationContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { BottomSheet } from './BottomSheet'
import { StarRatingInput } from './StarRatingInput'
import { TagInput } from './TagInput'

interface FilterPanelProps {
  filters: LocationFilters
  onChange: (filters: Partial<LocationFilters>) => void
  resultCount: number
  // Every tag in use across the user's locations — the only values the tag filter offers.
  allTags: string[]
}

const VISITED_OPTIONS: { value: VisitedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'visited', label: 'Visited' },
  { value: 'not-visited', label: 'Not visited' },
]

export function FilterPanel({ filters, onChange, resultCount, allTags }: FilterPanelProps) {
  const isMobile = useIsMobile()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Desktop dropdown closes on Esc or a click outside the bar + panel (the mobile sheet handles its own closing).
  useEffect(() => {
    if (!isSheetOpen || isMobile) return
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsSheetOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSheetOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isSheetOpen, isMobile])
  const hasActiveFilters =
    filters.search !== '' || filters.priority !== null || filters.tags.length > 0 || filters.visited !== 'all'

  const countLabel = `${resultCount} location${resultCount === 1 ? '' : 's'} shown`

  // Filter controls (tags, visited, priority), shared by the desktop dropdown and the mobile BottomSheet.
  const fields = (
    <>

      <div className="mb-3">
        <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">Tags</span>
        <TagInput
          value={filters.tags}
          onChange={(tags) => onChange({ tags })}
          suggestions={allTags}
          allowCreate={false}
          ariaLabel="Filter by tags"
          placeholder={allTags.length ? 'Pick tags…' : 'No tags yet'}
          className="rounded-lg border border-white/20 bg-white/40 px-2 py-1.5 focus-within:ring-2 focus-within:ring-harbor dark:bg-black/30"
        />
      </div>

      <div className="mb-3">
        <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">Visited</span>
        <div role="radiogroup" aria-label="Visited" className="grid grid-cols-3 gap-1 rounded-lg bg-white/30 p-0.5 dark:bg-black/30">
          {VISITED_OPTIONS.map((opt) => {
            const isSelected = filters.visited === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange({ visited: opt.value })}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-harbor text-white shadow-sm'
                    : 'text-ink/70 hover:bg-white/40 dark:text-mist-light/70 dark:hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-1">
        <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">Priority</span>
        <StarRatingInput
          value={filters.priority ?? 0}
          onChange={(p) => onChange({ priority: filters.priority === p ? null : p })}
        />
      </div>
    </>
  )

  // Maps-app style on every screen size: a search bar top-left of the map (full width on phones/tablets, ~360px on
  // desktop). Its sliders button opens the remaining filters — in the shared BottomSheet on phones/tablets, as a
  // dropdown panel under the bar on desktop. (The dropdown is deliberately not role="dialog": the regression
  // suite scopes lookups to an open dialog, and these controls belong to the page.)
  const clearButton = hasActiveFilters && (
    <button
      type="button"
      onClick={() => onChange(DEFAULT_FILTERS)}
      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-harbor/40 py-2.5 text-sm font-medium text-harbor transition-colors hover:bg-harbor/10"
    >
      <X size={14} /> Clear filters
    </button>
  )

  return (
    <div
      ref={containerRef}
      className={`absolute left-4 top-4 z-[400] ${isMobile ? 'right-4' : 'w-[min(360px,calc(100%-2rem))]'}`}
    >
      <div className="flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white/90 pl-4 pr-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#333]/90">
        <Search size={16} className="shrink-0 text-ink/40 dark:text-mist-light/40" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search your places"
          aria-label="Search your places"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none dark:text-mist-light dark:placeholder:text-mist-light/40"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange({ search: '' })}
            aria-label="Clear search"
            title="Clear search"
            className="shrink-0 rounded-full p-1.5 text-ink/40 hover:text-ink dark:text-mist-light/40 dark:hover:text-mist-light"
          >
            <X size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsSheetOpen((prev) => !prev)}
          aria-haspopup={isMobile ? 'dialog' : undefined}
          aria-expanded={isSheetOpen}
          aria-label="Filter pins"
          title="Filter pins"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-harbor transition-colors ${
            isSheetOpen && !isMobile ? 'bg-harbor/15' : 'bg-black/5 hover:bg-harbor/10 dark:bg-white/10'
          }`}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>

      {isMobile ? (
        <BottomSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} title="Filter pins" subtitle={countLabel}>
          <div className="trip-scroll overflow-y-auto px-4 pb-5 pt-4">
            {fields}
            {clearButton}
          </div>
        </BottomSheet>
      ) : (
        isSheetOpen && (
          <div className="trip-scroll mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-black/10 bg-white/90 p-4 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#333]/90">
            {fields}
            <p className="mt-3 text-xs text-ink/60 dark:text-mist-light/60">{countLabel}</p>
            {clearButton}
          </div>
        )
      )}
    </div>
  )
}
