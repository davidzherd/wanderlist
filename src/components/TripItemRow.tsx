import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bus,
  Car,
  CarTaxiFront,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  Hotel,
  Loader2,
  MapPin,
  Pencil,
  PenLine,
  Plane,
  Star,
  Trash2,
  TrainFront,
  type LucideIcon,
} from 'lucide-react'
import type { Location } from '../types/location'
import type { TransportItemFormValues, TripItem } from '../types/trip'
import { LocationImage } from './LocationImage'

export const TRANSPORT_LABELS: Record<NonNullable<TransportItemFormValues['transportType']>, string> = {
  plane: 'Flight',
  train: 'Train Ride',
  bus: 'Bus Ride',
  taxi: 'Taxi',
  car: 'Car',
}

export const TRANSPORT_ICONS: Record<NonNullable<TransportItemFormValues['transportType']>, LucideIcon> = {
  plane: Plane,
  train: TrainFront,
  bus: Bus,
  taxi: CarTaxiFront,
  car: Car,
}

function ItemIconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-harbor/10 text-harbor dark:bg-harbor/15">
      <Icon size={28} />
    </div>
  )
}

interface TripItemCardContentProps {
  item: TripItem
  index: number
  location?: Location
  onRemove: (itemId: string) => void
  onEdit?: (item: TripItem) => void
  onSaveToBucketlist?: (item: TripItem) => Promise<void> | void
}

function TripItemCardContent({ item, index, location, onRemove, onEdit, onSaveToBucketlist }: TripItemCardContentProps) {
  const hasTimeRange = Boolean(item.departureTime || item.arrivalTime)
  const [isSavingToBucketlist, setIsSavingToBucketlist] = useState(false)
  // A location stop with no bucket-list record behind it — either a never-saved custom stop, or
  // one whose saved location was later deleted (its soft FK is nulled, but the item stays). Both
  // read as "Custom" and can be (re-)saved to the bucket list. Keying off the resolved `location`
  // rather than the stored `custom` flag catches the deleted-location case too.
  const isUnsavedLocation = item.kind === 'location' && !location
  const canSaveToBucketlist = Boolean(onSaveToBucketlist) && isUnsavedLocation

  const handleSaveToBucketlist = async () => {
    if (!onSaveToBucketlist || isSavingToBucketlist) return
    setIsSavingToBucketlist(true)
    try {
      await onSaveToBucketlist(item)
    } finally {
      setIsSavingToBucketlist(false)
    }
  }
  const sublines: JSX.Element[] = []

  if (item.kind === 'location') {
    if (item.country) {
      sublines.push(
        <p key="country" className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
          <MapPin size={11} /> {item.country}
        </p>,
      )
    }
    if (hasTimeRange) {
      sublines.push(
        <p key="time" className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
          <Clock size={11} /> {item.departureTime || '—'} → {item.arrivalTime || '—'}
        </p>,
      )
    }
  } else if (item.kind === 'note') {
    if (hasTimeRange) {
      sublines.push(
        <p key="time" className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
          <Clock size={11} /> {item.departureTime || '—'} → {item.arrivalTime || '—'}
        </p>,
      )
    }
  } else if (item.kind === 'transport') {
    if (hasTimeRange || item.price != null) {
      sublines.push(
        <p key="time" className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
          <Clock size={11} /> {item.departureTime || '—'} → {item.arrivalTime || '—'}
          {item.price != null && ` · $${item.price}`}
        </p>,
      )
    }
  } else if (item.kind === 'lodging') {
    sublines.push(
      <p key="time" className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
        <Clock size={11} /> In {item.checkInTime || '—'} · Out {item.checkOutTime || '—'}
      </p>,
    )
  }
  const subline = sublines.length > 0 ? <>{sublines}</> : null

  const kindChipLabel = item.kind !== 'location' ? item.kind : isUnsavedLocation ? 'Custom' : null
  const description =
    item.kind === 'location'
      ? location?.notes ||
        item.description ||
        (item.custom ? 'Custom stop — no bucket-list description.' : 'No description added.')
      : item.description || 'No description added.'

  return (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full bg-harbor/15 text-xs font-semibold text-harbor">
        {index + 1}
      </span>
      {item.kind === 'location' ? (
        <LocationImage
          src={location?.imageUrl ?? item.imageUrl}
          alt={item.name}
          className="h-20 w-28 shrink-0 rounded-lg object-cover"
        />
      ) : item.kind === 'note' ? (
        <ItemIconTile icon={PenLine} />
      ) : item.kind === 'transport' ? (
        <ItemIconTile icon={TRANSPORT_ICONS[item.transportType ?? 'plane']} />
      ) : (
        <ItemIconTile icon={Hotel} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-ink dark:text-mist-light">{item.name}</p>
            {subline}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            {canSaveToBucketlist && (
              <button
                type="button"
                onClick={handleSaveToBucketlist}
                disabled={isSavingToBucketlist}
                aria-label="Save to bucket list"
                title="Save to bucket list"
                className="text-ink/40 hover:text-brass disabled:cursor-not-allowed dark:text-mist-light/40 dark:hover:text-brass"
              >
                {isSavingToBucketlist ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="Remove item"
              className="text-ink/40 hover:text-red-600 dark:text-mist-light/40 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                aria-label="Edit item"
                className="text-ink/40 hover:text-harbor dark:text-mist-light/40 dark:hover:text-harbor-light"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {location?.category && (
            <span className="rounded-full bg-harbor/10 px-2 py-0.5 text-[10px] font-medium text-harbor">
              {location.category}
            </span>
          )}
          {kindChipLabel && (
            <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-medium text-brass">
              {kindChipLabel}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-ink/70 dark:text-mist-light/70">{description}</p>
      </div>
    </>
  )
}

const cardClass = 'flex gap-3 rounded-xl border border-black/5 bg-white/60 p-3 dark:border-white/10 dark:bg-black/20'
const dragHandleClass =
  'flex shrink-0 cursor-grab touch-none items-center self-stretch px-0.5 text-ink/30 hover:text-ink/60 active:cursor-grabbing dark:text-mist-light/30 dark:hover:text-mist-light/60'
const moveButtonClass =
  'flex h-5 w-5 items-center justify-center rounded text-ink/50 transition-colors hover:bg-harbor/10 hover:text-harbor disabled:cursor-not-allowed disabled:text-ink/15 disabled:hover:bg-transparent dark:text-mist-light/50 dark:disabled:text-mist-light/15'

interface MoveArrowsProps {
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

function MoveArrows({ canMoveUp, canMoveDown, onMoveUp, onMoveDown }: MoveArrowsProps) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
      <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label="Move up" className={moveButtonClass}>
        <ChevronUp size={15} />
      </button>
      <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label="Move down" className={moveButtonClass}>
        <ChevronDown size={15} />
      </button>
    </div>
  )
}

interface TripItemRowProps {
  item: TripItem
  index: number
  location?: Location
  onRemove: (itemId: string) => void
  onEdit: (item: TripItem) => void
  onSaveToBucketlist?: (item: TripItem) => Promise<void> | void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function TripItemRow({
  item,
  index,
  location,
  onRemove,
  onEdit,
  onSaveToBucketlist,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: TripItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li ref={setNodeRef} style={style} className={`${cardClass} ${isDragging ? 'opacity-40' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder" className={dragHandleClass}>
        <GripVertical size={16} />
      </button>
      <MoveArrows canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      <TripItemCardContent
        item={item}
        index={index}
        location={location}
        onRemove={onRemove}
        onEdit={onEdit}
        onSaveToBucketlist={onSaveToBucketlist}
      />
    </li>
  )
}

/** Static, non-interactive rendering used inside dnd-kit's DragOverlay while an item is being dragged. */
export function TripItemRowOverlay({ item, index, location }: Pick<TripItemRowProps, 'item' | 'index' | 'location'>) {
  return (
    <li className={`${cardClass} shadow-lg`}>
      <span className={dragHandleClass}>
        <GripVertical size={16} />
      </span>
      <TripItemCardContent item={item} index={index} location={location} onRemove={() => {}} />
    </li>
  )
}
