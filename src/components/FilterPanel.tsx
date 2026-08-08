import { useState } from 'react'
import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react'
import type { LocationFilters } from '../context/LocationContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { StarRatingInput } from './StarRatingInput'

interface FilterPanelProps {
  filters: LocationFilters
  onChange: (filters: Partial<LocationFilters>) => void
  resultCount: number
}

export function FilterPanel({ filters, onChange, resultCount }: FilterPanelProps) {
  const isMobile = useIsMobile()
  const [isCollapsed, setIsCollapsed] = useState(isMobile)
  const hasActiveFilters = filters.search !== '' || filters.priority !== null

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
            onClick={() => onChange({ search: '', priority: null })}
            className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity,margin-top] duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'mt-3 max-h-96 opacity-100'
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
