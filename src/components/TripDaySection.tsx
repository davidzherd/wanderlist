import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Trash2 } from 'lucide-react'
import type { Location } from '../types/location'
import type { TripItem } from '../types/trip'
import { TripItemRow } from './TripItemRow'

interface TripDaySectionProps {
  containerId: string
  title: string
  dateLabel?: string
  items: TripItem[]
  locations: Location[]
  onRemoveItem: (itemId: string) => void
  onRemoveDay?: () => void
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void
  isFirstSection: boolean
  isLastSection: boolean
}

export function TripDaySection({
  containerId,
  title,
  dateLabel,
  items,
  locations,
  onRemoveItem,
  onRemoveDay,
  onMoveItem,
  isFirstSection,
  isLastSection,
}: TripDaySectionProps) {
  const { setNodeRef } = useDroppable({ id: containerId })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h4 className="font-display text-sm font-semibold text-ink dark:text-mist-light">
          {title}
          {dateLabel && <span className="ml-1.5 font-normal text-ink/50 dark:text-mist-light/50">· {dateLabel}</span>}
        </h4>
        {onRemoveDay && items.length === 0 && (
          <button
            type="button"
            onClick={onRemoveDay}
            aria-label={`Remove ${title}`}
            className="text-ink/40 hover:text-red-600 dark:text-mist-light/40 dark:hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <SortableContext id={containerId} items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="flex min-h-[3.5rem] flex-col gap-2 rounded-lg">
          {items.length === 0 ? (
            <li className="rounded-lg border border-dashed border-black/10 p-3 text-center text-xs text-ink/40 dark:border-white/10 dark:text-mist-light/40">
              Drop a stop here
            </li>
          ) : (
            items.map((item, idx) => (
              <TripItemRow
                key={item.id}
                item={item}
                index={idx}
                location={item.locationId ? locations.find((l) => l.id === item.locationId) : undefined}
                onRemove={onRemoveItem}
                canMoveUp={!(idx === 0 && isFirstSection)}
                canMoveDown={!(idx === items.length - 1 && isLastSection)}
                onMoveUp={() => onMoveItem(item.id, 'up')}
                onMoveDown={() => onMoveItem(item.id, 'down')}
              />
            ))
          )}
        </ol>
      </SortableContext>
    </div>
  )
}
