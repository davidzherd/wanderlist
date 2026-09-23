import { useState } from 'react'
import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react'
import { DEFAULT_FILTERS, type LocationFilters, type VisitedFilter } from '../context/LocationContext'
import { useIsMobile } from '../hooks/useIsMobile'
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
  const [isCollapsed, setIsCollapsed] = useState(isMobile)
  const hasActiveFilters =
    filters.search !== '' || filters.priority !== null || filters.tags.length > 0 || filters.visited !== 'all'

  return (
    <div className="glass-panel absolute left-4 top-4 z-[400] w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-expanded={!isCollapsed}
          className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink dark:text-mist-light"
        >
          <Filter size={15} /> Filter pins
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity,margin-top] duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'mt-3 max-h-[70vh] overflow-y-auto opacity-100'
        }`}
      >
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">Search</span>
          <span className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-mist-light/40" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Search by name or country…"
              className="w-full rounded-lg border border-white/20 bg-white/40 py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40"
            />
          </span>
        </label>

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

        <p className="mt-3 text-xs text-ink/60 dark:text-mist-light/60">{resultCount} location{resultCount === 1 ? '' : 's'} shown</p>
      </div>
    </div>
  )
}
