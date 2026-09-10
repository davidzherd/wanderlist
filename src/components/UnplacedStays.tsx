import { Hotel, Pencil, Trash2 } from 'lucide-react'
import type { TripItem } from '../types/trip'
import { formatMoney } from '../data/currencies'

function formatShortDate(iso?: string): string | undefined {
  if (!iso) return undefined
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Stays that aren't anchored to a dated day yet (no dates, or dates matching no day) — shown as a
 * small non-draggable list so they're never lost. Editing one to add matching dates promotes it to
 * auto banners on the covered days. Kept out of the sortable board entirely (lodging is date-driven,
 * not positioned), so it never interferes with drag-and-drop.
 */
export function UnplacedStays({
  stays,
  tripCurrency,
  onEdit,
  onRemove,
}: {
  stays: TripItem[]
  tripCurrency: string
  onEdit: (item: TripItem) => void
  onRemove: (itemId: string) => void
}) {
  if (stays.length === 0) return null

  return (
    <div className="pdf-hide flex flex-col gap-2 rounded-xl border border-brass/25 bg-brass/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink/70 dark:text-mist-light/70">
        <Hotel size={13} className="text-brass" /> Stays to schedule
      </div>
      <ul className="flex flex-col gap-1.5">
        {stays.map((stay) => {
          const inDate = formatShortDate(stay.checkInDate)
          const outDate = formatShortDate(stay.checkOutDate)
          const range = inDate || outDate ? `${inDate ?? '—'} → ${outDate ?? '—'}` : 'No dates yet'
          return (
            <li
              key={stay.id}
              className="flex items-center gap-2 rounded-lg border border-black/5 bg-white/60 px-2.5 py-1.5 dark:border-white/10 dark:bg-black/20"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink dark:text-mist-light">{stay.name}</p>
                <p className="text-[11px] text-ink/55 dark:text-mist-light/55">
                  {range}
                  {stay.price != null && ` · ${formatMoney(stay.price, stay.currency ?? tripCurrency)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEdit(stay)}
                aria-label={`Edit ${stay.name} stay`}
                title="Edit stay"
                className="shrink-0 text-ink/40 hover:text-harbor dark:text-mist-light/40 dark:hover:text-harbor-light"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => onRemove(stay.id)}
                aria-label={`Remove ${stay.name} stay`}
                title="Remove stay"
                className="shrink-0 text-ink/40 hover:text-red-600 dark:text-mist-light/40 dark:hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] italic text-ink/45 dark:text-mist-light/45">
        Add check-in &amp; check-out dates (and set your trip dates) to place these on your days.
      </p>
    </div>
  )
}
