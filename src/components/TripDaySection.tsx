import { Fragment } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import type { Location } from '../types/location'
import type { TripItem } from '../types/trip'
import { TripItemRow } from './TripItemRow'
import { TripSegmentConnector } from './TripSegmentConnector'
import { InlineNameEditor } from './InlineNameEditor'
import type { Coordinates } from '../utils/travelEstimate'

/**
 * Coordinates for a place stop, or null if it has none: custom stops carry their
 * own snapshotted lat/lng, linked stops read them from their bucket-list location,
 * and non-place items (notes, transport, lodging) have neither.
 */
function finiteCoords(latitude: number | undefined, longitude: number | undefined): Coordinates | null {
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : null
}

function coordsForItem(item: TripItem, locations: Location[]): Coordinates | null {
  if (item.kind !== 'location') return null
  const own = finiteCoords(item.latitude, item.longitude)
  if (own) return own
  const linked = item.locationId ? locations.find((l) => l.id === item.locationId) : undefined
  return linked ? finiteCoords(linked.latitude, linked.longitude) : null
}

// A flight the user placed between two stops IS the travel for that leg — so we
// suppress the auto walk/drive estimate (and the "too far apart" nudge) for a pair
// with a flight between them, rather than estimating a nonsensical road trip.
function isFlight(item: TripItem): boolean {
  return item.kind === 'transport' && item.transportType === 'plane'
}

interface TripDaySectionProps {
  containerId: string
  title: string
  dateLabel?: string
  items: TripItem[]
  locations: Location[]
  onRemoveItem: (itemId: string) => void
  onEditItem: (item: TripItem) => void
  onSaveToBucketlist?: (item: TripItem) => Promise<void> | void
  onRemoveDay?: () => void
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void
  /** Duplicate an item in place. Provided for real days only (never Unscheduled). */
  onDuplicateItem?: (item: TripItem) => void
  /** Open the "move this item to another day" picker. Omitted when there's no other day to move to. */
  onMoveItemToDay?: (item: TripItem) => void
  /** Rename this day. Provided for real days only — the Unscheduled bin isn't nameable. */
  onRenameDay?: (name: string) => void
  /** Open the reorder-days picker (the header switch button). Real days only. */
  onReorderDays?: () => void
  /** Travel estimates only make sense between stops in a planned day — off for the Unscheduled bin. */
  showTravelEstimates?: boolean
  /** When empty, the text shown in place of the (PDF-hidden) drop target in the exported PDF. */
  pdfEmptyLabel?: string
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
  onEditItem,
  onSaveToBucketlist,
  onRemoveDay,
  onMoveItem,
  onDuplicateItem,
  onMoveItemToDay,
  onRenameDay,
  onReorderDays,
  showTravelEstimates = true,
  pdfEmptyLabel,
  isFirstSection,
  isLastSection,
}: TripDaySectionProps) {
  const { setNodeRef } = useDroppable({ id: containerId })

  // For each item, the coordinates of the nearest PRECEDING stop that has coordinates,
  // and whether a flight sits between that stop and this item. Non-place items (notes,
  // transport, coordless lodging) don't have coordinates, so they're skipped rather than
  // breaking the chain: a "location → note → location" day still shows one estimate
  // spanning the two real places. But a flight in the gap means the user has already
  // planned that leg, so its pair gets no estimate. Built in list order so reordering
  // re-derives both for free.
  const fromCoordsByIndex: (Coordinates | null)[] = []
  const flightBeforeByIndex: boolean[] = []
  let precedingCoords: Coordinates | null = null
  let flightSincePreceding = false
  for (const item of items) {
    fromCoordsByIndex.push(precedingCoords)
    flightBeforeByIndex.push(flightSincePreceding)
    const own = coordsForItem(item, locations)
    if (own) {
      precedingCoords = own
      flightSincePreceding = false // a new place stop starts a fresh segment
    } else if (isFlight(item)) {
      flightSincePreceding = true
    }
  }

  // Only location stops are numbered; notes/transport/lodging get no badge and don't advance the
  // count, so a day reads "1 · note · 2" rather than skipping numbers.
  const stopNumberByIndex: (number | undefined)[] = []
  let stopCount = 0
  for (const item of items) {
    stopNumberByIndex.push(item.kind === 'location' ? ++stopCount : undefined)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {onRenameDay ? (
            <InlineNameEditor
              value={title}
              onSave={onRenameDay}
              maxLength={50}
              ariaLabelEdit={`Rename ${title}`}
              ariaLabelSave="Save day name"
              inputClassName="rounded-lg border border-black/10 bg-white/60 px-2 py-1 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light max-w-[10rem]"
              pencilSize={13}
              checkSize={16}
              trailing={
                dateLabel ? (
                  <span className="shrink-0 font-normal text-ink/50 dark:text-mist-light/50">· {dateLabel}</span>
                ) : undefined
              }
            />
          ) : (
            <h4 className="font-display text-sm font-semibold text-ink dark:text-mist-light">
              {title}
              {dateLabel && <span className="ml-1.5 font-normal text-ink/50 dark:text-mist-light/50">· {dateLabel}</span>}
            </h4>
          )}
          {onReorderDays && (
            <button
              type="button"
              onClick={onReorderDays}
              aria-label="Reorder days"
              title="Reorder days"
              className="pdf-hide shrink-0 text-ink/40 hover:text-harbor dark:text-mist-light/40 dark:hover:text-harbor-light"
            >
              <ArrowLeftRight size={13} />
            </button>
          )}
        </div>
        {onRemoveDay && items.length === 0 && (
          <button
            type="button"
            onClick={onRemoveDay}
            aria-label={`Remove ${title}`}
            title={`Remove ${title}`}
            className="pdf-hide shrink-0 text-ink/40 hover:text-red-600 dark:text-mist-light/40 dark:hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <SortableContext id={containerId} items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="flex min-h-[3.5rem] flex-col gap-2 rounded-lg">
          {items.length === 0 ? (
            <>
              {/* Interactive drop target — on screen only, never in the exported PDF. */}
              <li className="pdf-hide rounded-lg border border-dashed border-black/10 p-3 text-center text-xs text-ink/40 dark:border-white/10 dark:text-mist-light/40">
                Drop a stop here
              </li>
              {/* PDF-only stand-in so an empty planned day reads as intentional rather than blank. */}
              {pdfEmptyLabel && (
                <li className="pdf-only hidden p-3 text-center text-xs italic text-ink/50 dark:text-mist-light/50">
                  {pdfEmptyLabel}
                </li>
              )}
            </>
          ) : (
            items.map((item, idx) => {
              // Estimate shown before this stop when both it and the nearest preceding
              // place stop resolve to coordinates (notes/transport in between are skipped,
              // see fromCoordsByIndex above).
              const fromCoords = fromCoordsByIndex[idx]
              const toCoords = coordsForItem(item, locations)
              return (
                <Fragment key={item.id}>
                  {showTravelEstimates && fromCoords && toCoords && !flightBeforeByIndex[idx] && (
                    <TripSegmentConnector from={fromCoords} to={toCoords} itemId={item.id} />
                  )}
                  <TripItemRow
                    item={item}
                    stopNumber={stopNumberByIndex[idx]}
                    location={item.locationId ? locations.find((l) => l.id === item.locationId) : undefined}
                    onRemove={onRemoveItem}
                    onEdit={onEditItem}
                    onSaveToBucketlist={onSaveToBucketlist}
                    onDuplicate={onDuplicateItem}
                    onMoveToDay={onMoveItemToDay}
                    canMoveUp={!(idx === 0 && isFirstSection)}
                    canMoveDown={!(idx === items.length - 1 && isLastSection)}
                    onMoveUp={() => onMoveItem(item.id, 'up')}
                    onMoveDown={() => onMoveItem(item.id, 'down')}
                  />
                </Fragment>
              )
            })
          )}
        </ol>
      </SortableContext>
    </div>
  )
}
