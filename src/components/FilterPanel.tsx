import { Filter, X } from 'lucide-react'
import type { LocationFilters } from '../context/LocationContext'
import { StarRatingInput } from './StarRatingInput'

interface FilterPanelProps {
  filters: LocationFilters
  onChange: (filters: Partial<LocationFilters>) => void
  resultCount: number
}

export function FilterPanel({ filters, onChange, resultCount }: FilterPanelProps) {
  const hasActiveFilters = filters.category !== '' || filters.priority !== null

  return (
    <div className="glass-panel absolute left-4 top-4 z-[400] w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink dark:text-mist-light">
          <Filter size={15} /> Filter pins
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ category: '', priority: null })}
            className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">Category</span>
        <input
          type="text"
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="e.g. Culture, Food, Nature…"
          className="w-full rounded-lg border border-white/20 bg-white/40 px-3 py-1.5 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40"
        />
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
  )
}
