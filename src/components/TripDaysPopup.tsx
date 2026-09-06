import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Hotel, Loader2, MapPin, PenLine, X } from 'lucide-react'
import type { Trip, TripItem } from '../types/trip'
import { TRANSPORT_ICONS } from './TripItemRow'

function formatDayDate(iso?: string): string | undefined {
  if (!iso) return undefined
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function ItemLine({ item }: { item: TripItem }) {
  const Icon =
    item.kind === 'location'
      ? MapPin
      : item.kind === 'note'
        ? PenLine
        : item.kind === 'transport'
          ? TRANSPORT_ICONS[item.transportType ?? 'plane']
          : Hotel
  return (
    <li className="flex items-center gap-2 py-1 text-xs text-ink/70 dark:text-mist-light/70">
      <Icon size={13} className="shrink-0 text-harbor" />
      <span className="truncate">{item.name}</span>
    </li>
  )
}

interface DayCardProps {
  dayId: string
  label: string
  dateLabel?: string
  items: TripItem[]
  isOpen: boolean
  onToggleOpen: () => void
  mode: 'reorder' | 'move'
  isSelected?: boolean
  onSelect?: () => void
}

/** One day rendered as a collapsed card; the chevron expands it to reveal its items. */
function DayCard({
  dayId,
  label,
  dateLabel,
  items,
  isOpen,
  onToggleOpen,
  mode,
  isSelected,
  onSelect,
}: DayCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dayId,
    disabled: mode !== 'reorder',
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white/60 dark:bg-black/20 ${
        isDragging ? 'opacity-40' : ''
      } ${
        mode === 'move' && isSelected
          ? 'border-harbor ring-1 ring-harbor'
          : 'border-black/10 dark:border-white/10'
      }`}
    >
      <div className="flex items-center gap-2 p-2.5">
        {mode === 'reorder' ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${label} to reorder`}
            title={`Drag ${label} to reorder`}
            className="shrink-0 cursor-grab touch-none self-stretch px-0.5 text-ink/30 hover:text-ink/60 active:cursor-grabbing dark:text-mist-light/30 dark:hover:text-mist-light/60"
          >
            <GripVertical size={16} />
          </button>
        ) : (
          <input
            type="radio"
            name="move-target-day"
            checked={Boolean(isSelected)}
            onChange={onSelect}
            aria-label={`Move to ${label}`}
            title={`Move to ${label}`}
            className="h-4 w-4 shrink-0 accent-harbor"
          />
        )}

        <button
          type="button"
          onClick={mode === 'move' ? onSelect : onToggleOpen}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="truncate font-display text-sm font-semibold text-ink dark:text-mist-light">{label}</span>
          {dateLabel && (
            <span className="shrink-0 text-xs font-normal text-ink/50 dark:text-mist-light/50">· {dateLabel}</span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleOpen}
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          title={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={isOpen}
          className="shrink-0 rounded-lg p-1 text-ink/50 hover:bg-black/5 dark:text-mist-light/50 dark:hover:bg-white/10"
        >
          <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-black/5 px-3 pb-2 pt-1 dark:border-white/5">
          {items.length === 0 ? (
            <p className="py-1 text-xs italic text-ink/40 dark:text-mist-light/40">No items in this day.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <ItemLine key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

interface TripDaysPopupProps {
  mode: 'reorder' | 'move'
  trip: Trip
  /** In 'move' mode, the item being relocated (its current day is pre-selected). */
  itemToMove?: TripItem
  onClose: () => void
  onSaveReorder: (orderedDayIds: string[]) => Promise<void>
  onSaveMove: (itemId: string, dayId: string) => Promise<void>
}

export function TripDaysPopup({ mode, trip, itemToMove, onClose, onSaveReorder, onSaveMove }: TripDaysPopupProps) {
  const [orderedDayIds, setOrderedDayIds] = useState<string[]>(() => trip.days.map((d) => d.id))
  const [selectedDayId, setSelectedDayId] = useState<string | null>(itemToMove?.dayId ?? null)
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const daysById = useMemo(() => new Map(trip.days.map((d) => [d.id, d])), [trip.days])
  // Dates are positional (slot 0 = earliest) and stay chronological as cards move, so a card's date
  // is read from its live position, not its own day — this keeps dates updating live during a drag.
  const datesByPosition = useMemo(() => trip.days.map((d) => d.date), [trip.days])
  const itemsByDayId = useMemo(() => {
    const map = new Map<string, TripItem[]>()
    for (const item of trip.items) {
      if (!item.dayId) continue
      const list = map.get(item.dayId) ?? []
      list.push(item)
      map.set(item.dayId, list)
    }
    return map
  }, [trip.items])

  const originalOrder = trip.days.map((d) => d.id)
  const orderChanged = orderedDayIds.some((id, i) => id !== originalOrder[i])
  const moveChanged = mode === 'move' && selectedDayId !== null && selectedDayId !== (itemToMove?.dayId ?? null)
  const canSave = mode === 'reorder' ? orderChanged : moveChanged

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedDayIds((ids) => {
      const from = ids.indexOf(String(active.id))
      const to = ids.indexOf(String(over.id))
      return from === -1 || to === -1 ? ids : arrayMove(ids, from, to)
    })
  }

  const handleSave = async () => {
    if (!canSave || isSaving) return
    setIsSaving(true)
    try {
      if (mode === 'reorder') {
        await onSaveReorder(orderedDayIds)
      } else if (selectedDayId) {
        await onSaveMove(itemToMove!.id, selectedDayId)
      }
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  // Row order to render: the live drag order for reorder, plain order for move.
  const renderIds = mode === 'reorder' ? orderedDayIds : originalOrder

  const cards = renderIds.map((dayId, index) => {
    const day = daysById.get(dayId)
    if (!day) return null
    const label = day.name || `Day ${index + 1}`
    return (
      <DayCard
        key={dayId}
        dayId={dayId}
        label={label}
        dateLabel={formatDayDate(datesByPosition[index])}
        items={itemsByDayId.get(dayId) ?? []}
        isOpen={openDayId === dayId}
        onToggleOpen={() => setOpenDayId((prev) => (prev === dayId ? null : dayId))}
        mode={mode}
        isSelected={selectedDayId === dayId}
        onSelect={() => setSelectedDayId(dayId)}
      />
    )
  })

  const title = mode === 'reorder' ? 'Reorder days' : 'Move to a day'
  const subtitle =
    mode === 'reorder'
      ? 'Drag a day to change its position. Dates stay in order.'
      : `Choose a day to move “${itemToMove?.name ?? 'this item'}” to.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-mist-light p-5 dark:bg-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink dark:text-mist-light">{title}</h2>
            <p className="mt-0.5 text-xs text-ink/60 dark:text-mist-light/60">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="shrink-0 text-ink/50 hover:text-ink dark:text-mist-light/50 dark:hover:text-mist-light"
          >
            <X size={18} />
          </button>
        </div>

        <div className="trip-scroll -mx-1 flex-1 overflow-y-auto px-1">
          {trip.days.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/50 dark:text-mist-light/50">This trip has no days yet.</p>
          ) : (
            // Always wrapped so DayCard's useSortable has its SortableContext; in 'move' mode each
            // card disables dragging and shows a radio instead of a grip, so no drag can start.
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={renderIds} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">{cards}</ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-harbor px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving && <Loader2 size={15} className="animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  )
}
