import { Filter, X } from 'lucide-react'
import type { LocationFilters } from '../context/LocationContext'

interface FilterPanelProps {
  filters: LocationFilters
  onChange: (filters: Partial<LocationFilters>) => void
  resultCount: number
}

const PRIORITIES = [1, 2, 3, 4, 5]

export function FilterPanel({ filters, onChange, resultCount }: FilterPanelProps) {
  const hasActiveFilters = filters.category !== '' || filters.priority !== null

  return (
    <div className="glass-panel absolute left-4 top-4 z-[400] w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-espresso dark:text-sand-light">
          <Filter size={15} /> Filter pins
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ category: '', priority: null })}
            className="flex items-center gap-1 text-xs font-medium text-terracotta hover:underline"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-espresso/70 dark:text-sand-light/70">Category</span>
        <input
          type="text"
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="e.g. Culture, Food, Nature…"
          className="w-full rounded-lg border border-white/20 bg-white/40 px-3 py-1.5 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:ring-2 focus:ring-terracotta dark:bg-black/30 dark:text-sand-light dark:placeholder:text-sand-light/40"
        />
      </label>

      <div className="mb-1">
        <span className="mb-1 block text-xs font-medium text-espresso/70 dark:text-sand-light/70">Priority</span>
        <div className="flex gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ priority: filters.priority === p ? null : p })}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                filters.priority === p
                  ? 'bg-terracotta text-white'
                  : 'bg-black/5 text-espresso/70 hover:bg-black/10 dark:bg-white/10 dark:text-sand-light/70 dark:hover:bg-white/20'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-espresso/60 dark:text-sand-light/60">{resultCount} location{resultCount === 1 ? '' : 's'} shown</p>
    </div>
  )
}
