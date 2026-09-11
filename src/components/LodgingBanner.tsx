import { Hotel, LogIn, LogOut, Moon, Trash2, type LucideIcon } from 'lucide-react'
import type { TripItem } from '../types/trip'
import type { StayBannerVariant } from '../utils/lodging'

const VARIANT_META: Record<StayBannerVariant, { icon: LucideIcon; label: string }> = {
  checkin: { icon: LogIn, label: 'Check in' },
  checkout: { icon: LogOut, label: 'Check out' },
  overnight: { icon: Moon, label: 'Sleep at' },
  wake: { icon: Hotel, label: 'Wake up at' },
}

/**
 * A slim, derived marker showing where a day starts or ends at a hotel. Not a draggable item — it's
 * computed from the stay's check-in/out dates (see utils/lodging). Clicking the body edits the stay;
 * the trash button removes it (both hidden from the exported PDF).
 */
export function LodgingBanner({
  item,
  variant,
  time,
  onEdit,
  onRemove,
}: {
  item: TripItem
  variant: StayBannerVariant
  time?: string
  onEdit?: (item: TripItem) => void
  onRemove?: (itemId: string) => void
}) {
  const { icon: Icon, label } = VARIANT_META[variant]

  return (
    <div className="pdf-card flex items-center gap-2 rounded-lg border border-brass/30 bg-brass/10 px-3 py-1.5 dark:border-brass/25 dark:bg-brass/10">
      <Icon size={14} className="shrink-0 text-brass" />
      <button
        type="button"
        onClick={onEdit ? () => onEdit(item) : undefined}
        disabled={!onEdit}
        className="pdf-card-text flex min-w-0 flex-1 items-baseline gap-1.5 text-left text-xs text-ink/80 disabled:cursor-default dark:text-mist-light/80"
      >
        <span className="font-medium text-brass">{label}</span>
        <span className="truncate font-medium text-ink dark:text-mist-light">{item.name}</span>
        {time && <span className="shrink-0 text-ink/50 dark:text-mist-light/50">· {time}</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name} stay`}
          title="Remove stay"
          className="pdf-hide shrink-0 text-ink/30 hover:text-red-600 dark:text-mist-light/30 dark:hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
