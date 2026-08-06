import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Luggage,
  MapPin,
  MapPinPlus,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../context/LocationContext'
import { useIsMobile } from '../hooks/useIsMobile'
import * as tripsApi from '../api/trips'
import { geocodeSearch } from '../api/geocode'
import { searchFirstPexelsPhoto } from '../api/pexels'
import { ApiError } from '../api/client'
import type { Location, NominatimResult } from '../types/location'
import type { Trip, TripItem, TripItemKind, NoteItemFormValues, TransportItemFormValues, LodgingItemFormValues } from '../types/trip'
import { TripFormSchema, type TripFormValues } from '../types/trip'
import { Skeleton } from '../components/Skeleton'
import { PdfExportButton } from '../components/PdfExportButton'
import { LocationImage } from '../components/LocationImage'
import { TripToolsBar } from '../components/TripToolsBar'
import { TripToolPopup } from '../components/TripToolPopup'
import { TripDaySection } from '../components/TripDaySection'
import { TRANSPORT_LABELS, TripItemRowOverlay } from '../components/TripItemRow'
import { AddDayButton } from '../components/AddDayButton'
import { DateRangePicker } from '../components/DateRangePicker'
import { ToastStack } from '../components/Toast'
import { useToasts } from '../hooks/useToasts'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

const UNSCHEDULED_CONTAINER = 'container:unscheduled'
const containerIdForDay = (dayId: string) => `container:${dayId}`
const getContainerId = (item: TripItem) => (item.dayId ? containerIdForDay(item.dayId) : UNSCHEDULED_CONTAINER)

function formatDayDate(iso?: string): string | undefined {
  if (!iso) return undefined
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function TripBuilderView() {
  const { user } = useAuth()
  const { locations } = useLocations()
  const { toasts, pushToast, dismissToast } = useToasts()

  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<Exclude<TripItemKind, 'location'> | null>(null)
  const [isBucketBarCollapsed, setIsBucketBarCollapsed] = useState(false)
  const [customStopQuery, setCustomStopQuery] = useState('')
  const [customStopResults, setCustomStopResults] = useState<NominatimResult[]>([])
  const [isSearchingCustomStop, setIsSearchingCustomStop] = useState(false)
  const [customStopError, setCustomStopError] = useState<string | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<TripItem | null>(null)
  const dragStartTripRef = useRef<Trip | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const customStopDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const isMobile = useIsMobile()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const loadTrips = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const result = await tripsApi.fetchTrips(user.email)
      setTrips(result)
      setSelectedTripId((prev) => prev ?? result[0]?.id ?? null)
    } catch {
      pushToast('error', 'Could not load your trips.')
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  useEffect(() => {
    if (isToolsOpen && isMobile) setIsBucketBarCollapsed(true)
  }, [isToolsOpen, isMobile])

  useEffect(() => {
    if (customStopDebounceRef.current) clearTimeout(customStopDebounceRef.current)
    if (customStopQuery.trim().length < 3) {
      setCustomStopResults([])
      return
    }
    customStopDebounceRef.current = setTimeout(async () => {
      setIsSearchingCustomStop(true)
      setCustomStopError(null)
      try {
        const found = await geocodeSearch(customStopQuery)
        setCustomStopResults(found)
      } catch (err) {
        setCustomStopError(err instanceof Error ? err.message : 'Geocoding lookup failed')
        setCustomStopResults([])
      } finally {
        setIsSearchingCustomStop(false)
      }
    }, 400)
    return () => {
      if (customStopDebounceRef.current) clearTimeout(customStopDebounceRef.current)
    }
  }, [customStopQuery])

  const tripForm = useForm<TripFormValues>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: { name: '' },
  })

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null
  const usedLocationIds = new Set(selectedTrip?.items.map((i) => i.locationId).filter(Boolean))
  const availableLocations = locations.filter((loc) => !usedLocationIds.has(loc.id))

  const trimmedQuery = locationQuery.trim().toLowerCase()
  const searchResults = trimmedQuery
    ? availableLocations.filter(
      (loc) => loc.name.toLowerCase().includes(trimmedQuery) || loc.country.toLowerCase().includes(trimmedQuery),
    )
    : availableLocations

  const onCreateTrip = async (values: TripFormValues) => {
    if (!user) return
    try {
      const created = await tripsApi.createTrip(user.email, values.name)
      setTrips((prev) => [...prev, created])
      setSelectedTripId(created.id)
      tripForm.reset()
      pushToast('success', `Trip "${created.name}" created.`)
    } catch {
      pushToast('error', 'Could not create trip.')
    }
  }

  const onDeleteTrip = async (id: string) => {
    if (!user) return
    try {
      await tripsApi.deleteTrip(user.email, id)
      setTrips((prev) => prev.filter((t) => t.id !== id))
      setSelectedTripId((prev) => (prev === id ? null : prev))
    } catch {
      pushToast('error', 'Could not delete trip.')
    }
  }

  const onAddExistingLocation = async (loc: Location) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        kind: 'location',
        locationId: loc.id,
        name: loc.name,
        country: loc.country,
        custom: false,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      pushToast('error', 'Could not add that location to the trip.')
    }
  }

  const onSelectCustomStop = async (result: NominatimResult) => {
    if (!user || !selectedTrip) return
    const shortName = result.display_name.split(',')[0]
    const country = result.address?.country ?? result.display_name.split(',').pop()?.trim() ?? ''
    try {
      const photo = await searchFirstPexelsPhoto(`${shortName} ${country}`)
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        kind: 'location',
        name: shortName,
        country,
        custom: true,
        imageUrl: photo?.url,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setCustomStopQuery('')
      setCustomStopResults([])
      pushToast('success', `${shortName} added to the trip.`)
    } catch {
      pushToast('error', 'Could not add that stop to the trip.')
    }
  }

  const onAddNote = async (values: NoteItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        kind: 'note',
        name: values.title,
        description: values.description,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setActiveTool(null)
      pushToast('success', 'Note added to trip.')
    } catch {
      pushToast('error', 'Could not add that note.')
    }
  }

  const onAddTransport = async (values: TransportItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        kind: 'transport',
        name: TRANSPORT_LABELS[values.transportType],
        transportType: values.transportType,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        description: values.description,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setActiveTool(null)
      pushToast('success', 'Transport added to trip.')
    } catch {
      pushToast('error', 'Could not add that transport.')
    }
  }

  const onAddLodging = async (values: LodgingItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        kind: 'lodging',
        name: values.name,
        description: values.description,
        checkInTime: values.checkInTime,
        checkOutTime: values.checkOutTime,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setActiveTool(null)
      pushToast('success', 'Lodging added to trip.')
    } catch {
      pushToast('error', 'Could not add that lodging.')
    }
  }

  const onRemoveItem = async (itemId: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.removeTripItem(user.email, selectedTrip.id, itemId)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      pushToast('error', 'Could not remove that item.')
    }
  }

  const onDateRangeChange = async (startDate?: string, endDate?: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.updateTripDates(user.email, selectedTrip.id, startDate, endDate)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      pushToast('error', err instanceof ApiError ? err.message : 'Could not update trip dates.')
    }
  }

  const onAddDay = async () => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripDay(user.email, selectedTrip.id)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      pushToast('error', err instanceof ApiError ? err.message : 'Could not add a day.')
    }
  }

  const onRemoveDay = async (dayId: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.removeTripDay(user.email, selectedTrip.id, dayId)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      pushToast('error', err instanceof ApiError ? err.message : 'Could not remove that day.')
    }
  }

  const findContainer = (id: string): string | undefined => {
    if (!selectedTrip) return undefined
    if (id === UNSCHEDULED_CONTAINER || selectedTrip.days.some((d) => containerIdForDay(d.id) === id)) return id
    const item = selectedTrip.items.find((i) => i.id === id)
    return item ? getContainerId(item) : undefined
  }

  /** Whether the dragged item's current center sits below the hovered item's center — i.e. it should land after (not before) that item. Without this, hovering the last item in a list can never place the dragged item after it. */
  const isInsertingAfterOver = (event: DragOverEvent | DragEndEvent): boolean => {
    const { active, over } = event
    const activeRect = active.rect.current.translated
    if (!over || !activeRect) return false
    return activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
  }

  /** Moves `activeItem` into `overContainer`, positioned relative to `overId` (an item id, or the container id itself when dropped on empty space). */
  const moveItemToContainer = (
    items: TripItem[],
    activeItem: TripItem,
    overContainer: string,
    overId: string,
    insertAfterOver: boolean,
  ): TripItem[] => {
    const targetDayId = overContainer === UNSCHEDULED_CONTAINER ? undefined : overContainer.replace('container:', '')
    const withoutActive = items.filter((i) => i.id !== activeItem.id)
    const movedItem: TripItem = { ...activeItem, dayId: targetDayId }

    let insertAt: number
    if (overId === overContainer) {
      let lastIdx = -1
      withoutActive.forEach((i, idx) => {
        if (getContainerId(i) === overContainer) lastIdx = idx
      })
      insertAt = lastIdx + 1
    } else {
      const overIdx = withoutActive.findIndex((i) => i.id === overId)
      insertAt = overIdx === -1 ? withoutActive.length : overIdx + (insertAfterOver ? 1 : 0)
    }

    return [...withoutActive.slice(0, insertAt), movedItem, ...withoutActive.slice(insertAt)]
  }

  /** Reorders items within a single container from `fromIndex` to `toIndex`, leaving every other container's items untouched. */
  const swapWithinContainer = (items: TripItem[], containerId: string, fromIndex: number, toIndex: number): TripItem[] => {
    const containerItemIds = items.filter((i) => getContainerId(i) === containerId).map((i) => i.id)
    const reorderedIds = arrayMove(containerItemIds, fromIndex, toIndex)
    const itemById = new Map(items.map((i) => [i.id, i]))
    let cursor = 0
    return items.map((item) => (getContainerId(item) === containerId ? itemById.get(reorderedIds[cursor++])! : item))
  }

  /** Moves `activeItem` to the very start or end of `containerId`, for the up/down arrow buttons crossing into a different day. */
  const moveToEdgeOfContainer = (items: TripItem[], activeItem: TripItem, containerId: string, edge: 'start' | 'end'): TripItem[] => {
    const containerItems = items.filter((i) => i.id !== activeItem.id && getContainerId(i) === containerId)
    if (edge === 'end' || containerItems.length === 0) {
      return moveItemToContainer(items, activeItem, containerId, containerId, true)
    }
    return moveItemToContainer(items, activeItem, containerId, containerItems[0].id, false)
  }

  const onDragStart = (event: DragStartEvent) => {
    const item = selectedTrip?.items.find((i) => i.id === event.active.id)
    setActiveDragItem(item ?? null)
    dragStartTripRef.current = selectedTrip
  }

  /** Moves the dragged item into the hovered day/unscheduled bucket live, so the preview shows where it will land — dnd-kit keeps each container's SortableContext separate, so without this the placeholder never leaves the source list. */
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !selectedTrip) return

    const activeContainer = findContainer(String(active.id))
    const overContainer = findContainer(String(over.id))
    const activeItem = selectedTrip.items.find((i) => i.id === active.id)
    if (!activeContainer || !overContainer || !activeItem || activeContainer === overContainer) return

    const nextItems = moveItemToContainer(
      selectedTrip.items,
      activeItem,
      overContainer,
      String(over.id),
      isInsertingAfterOver(event),
    )
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? { ...t, items: nextItems } : t)))
  }

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)
    const dragStartTrip = dragStartTripRef.current
    dragStartTripRef.current = null
    if (!over || !selectedTrip || !user || !dragStartTrip) return

    const activeContainer = findContainer(String(active.id))
    const overContainer = findContainer(String(over.id))
    const activeItem = selectedTrip.items.find((i) => i.id === active.id)
    if (!activeContainer || !overContainer || !activeItem) return

    let nextItems: TripItem[]
    if (activeContainer !== overContainer) {
      // Safety net: normally onDragOver already relocated the item live; this covers a drag that ends before that fires.
      nextItems = moveItemToContainer(selectedTrip.items, activeItem, overContainer, String(over.id), isInsertingAfterOver(event))
    } else {
      // Same container: mirror dnd-kit's own sortable preview exactly — a plain index swap, not a half-hovered insert —
      // so the drop lands wherever the preview showed, instead of requiring an extra pixel threshold past it.
      const containerItemIds = selectedTrip.items.filter((i) => getContainerId(i) === overContainer).map((i) => i.id)
      const activeIndex = containerItemIds.indexOf(String(active.id))
      const overIndex = containerItemIds.indexOf(String(over.id))

      nextItems =
        activeIndex === -1 || overIndex === -1 || activeIndex === overIndex
          ? selectedTrip.items
          : swapWithinContainer(selectedTrip.items, overContainer, activeIndex, overIndex)
    }

    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? { ...t, items: nextItems } : t)))

    try {
      const updated = await tripsApi.reorderTripItems(user.email, dragStartTrip.id, nextItems)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setTrips((prev) => prev.map((t) => (t.id === dragStartTrip.id ? dragStartTrip : t)))
      pushToast('error', 'Could not reorder that item.')
    }
  }

  /**
   * Up/down arrow click handler. The chain is Day 1 → Day 2 → … → Day N → Unscheduled (Unscheduled always exists,
   * so it acts as a permanent "Day N+1" — moving down off the last real day never needs to create one). The one
   * case that does create a day: moving up from Unscheduled's first item when there are no days yet at all.
   */
  const onMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    if (!user || !selectedTrip) return
    const item = selectedTrip.items.find((i) => i.id === itemId)
    if (!item) return

    const containerId = getContainerId(item)
    const containerItems = selectedTrip.items.filter((i) => getContainerId(i) === containerId)
    const itemIndex = containerItems.findIndex((i) => i.id === itemId)

    const commit = async (trip: Trip, items: TripItem[]) => {
      setTrips((prev) => prev.map((t) => (t.id === trip.id ? { ...trip, items } : t)))
      try {
        const updated = await tripsApi.reorderTripItems(user.email, trip.id, items)
        setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } catch {
        setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? selectedTrip : t)))
        pushToast('error', 'Could not move that item.')
      }
    }

    if (direction === 'up') {
      if (itemIndex > 0) {
        await commit(selectedTrip, swapWithinContainer(selectedTrip.items, containerId, itemIndex, itemIndex - 1))
        return
      }
      if (containerId !== UNSCHEDULED_CONTAINER) {
        const dayIdx = selectedTrip.days.findIndex((d) => containerIdForDay(d.id) === containerId)
        if (dayIdx <= 0) return // first item of Day 1 — up arrow should be disabled in this state
        const target = containerIdForDay(selectedTrip.days[dayIdx - 1].id)
        await commit(selectedTrip, moveToEdgeOfContainer(selectedTrip.items, item, target, 'end'))
        return
      }
      if (selectedTrip.days.length > 0) {
        const target = containerIdForDay(selectedTrip.days[selectedTrip.days.length - 1].id)
        await commit(selectedTrip, moveToEdgeOfContainer(selectedTrip.items, item, target, 'end'))
        return
      }
      // No days exist yet: create Day 1, then move the item into it.
      try {
        const withNewDay = await tripsApi.addTripDay(user.email, selectedTrip.id)
        const target = containerIdForDay(withNewDay.days[withNewDay.days.length - 1].id)
        await commit(withNewDay, moveToEdgeOfContainer(withNewDay.items, item, target, 'end'))
      } catch (err) {
        pushToast('error', err instanceof ApiError ? err.message : 'Could not create a day.')
      }
      return
    }

    // direction === 'down'
    if (itemIndex < containerItems.length - 1) {
      await commit(selectedTrip, swapWithinContainer(selectedTrip.items, containerId, itemIndex, itemIndex + 1))
      return
    }
    if (containerId === UNSCHEDULED_CONTAINER) return // last item of Unscheduled — down arrow should be disabled in this state
    const dayIdx = selectedTrip.days.findIndex((d) => containerIdForDay(d.id) === containerId)
    const target =
      dayIdx < selectedTrip.days.length - 1 ? containerIdForDay(selectedTrip.days[dayIdx + 1].id) : UNSCHEDULED_CONTAINER
    await commit(selectedTrip, moveToEdgeOfContainer(selectedTrip.items, item, target, 'start'))
  }

  const itemsByContainer = new Map<string, TripItem[]>()
  if (selectedTrip) {
    for (const item of selectedTrip.items) {
      const cid = getContainerId(item)
      const list = itemsByContainer.get(cid) ?? []
      list.push(item)
      itemsByContainer.set(cid, list)
    }
  }

  return (
    <div className="grid h-full w-full grid-cols-1 gap-4 overflow-y-auto bg-mist-light p-4 dark:bg-ink sm:grid-cols-[280px_1fr] sm:overflow-hidden sm:p-6">
      <aside className="glass-panel trip-scroll flex flex-col gap-4 rounded-2xl p-4 sm:overflow-y-auto">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink dark:text-mist-light">
          <Luggage size={16} /> Your trips
        </h2>

        <form onSubmit={tripForm.handleSubmit(onCreateTrip)} className="flex gap-2">
          <input
            type="text"
            placeholder="New trip name…"
            {...tripForm.register('name')}
            className={inputClass}
          />
          <button
            type="submit"
            aria-label="Create trip"
            className="shrink-0 rounded-lg bg-harbor px-3 py-2 text-white transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
          </button>
        </form>
        {tripForm.formState.errors.name && (
          <p className="-mt-2 text-xs text-red-600 dark:text-red-400">{tripForm.formState.errors.name.message}</p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : trips.length === 0 ? (
          <p className="text-sm text-ink/50 dark:text-mist-light/50">No trips yet — create your first one above.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trips.map((trip) => (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${trip.id === selectedTripId
                    ? 'bg-harbor text-white'
                    : 'text-ink/80 hover:bg-black/5 dark:text-mist-light/80 dark:hover:bg-white/10'
                    }`}
                >
                  <span className="truncate">{trip.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteTrip(trip.id)
                    }}
                    className="ml-2 shrink-0 opacity-60 hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="glass-panel flex flex-col overflow-hidden rounded-2xl p-6">
        {!selectedTrip ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink/50 dark:text-mist-light/50">
            <Sparkles size={28} />
            <p>Select or create a trip to start building your itinerary.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h1 className="font-display text-xl font-semibold text-ink dark:text-mist-light">{selectedTrip.name}</h1>
              <PdfExportButton targetRef={exportRef} fileName={selectedTrip.name.replace(/\s+/g, '-').toLowerCase()} />
            </div>

            <div className="mb-4">
              <DateRangePicker startDate={selectedTrip.startDate} endDate={selectedTrip.endDate} onChange={onDateRangeChange} />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
              <div className="flex flex-col gap-2">
                <span className="px-1 text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-mist-light/50">
                  FILTER YOUR BUCKETLIST
                </span>
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-harbor/60"
                  />
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder="Search a country or location name…"
                    className={`${inputClass} border-harbor/40 pl-8 focus:ring-harbor dark:border-harbor/40`}
                  />
                </div>

                {availableLocations.length === 0 ? (
                  <p className="px-1 text-xs text-ink/50 dark:text-mist-light/50">
                    All your bucket-list spots are already on this trip.
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="px-1 text-xs text-ink/50 dark:text-mist-light/50">
                    No saved spots match “{locationQuery}”.
                  </p>
                ) : (
                  <p className="px-1 text-xs text-ink/50 dark:text-mist-light/50">
                    {searchResults.length} spot{searchResults.length === 1 ? '' : 's'} — pick one from the tray below.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="px-1 text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-mist-light/50">
                  Search anywhere outside the bucketlist
                </span>
                <div className="relative">
                  <Globe
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-mist-light/40"
                  />
                  <input
                    type="text"
                    value={customStopQuery}
                    onChange={(e) => setCustomStopQuery(e.target.value)}
                    placeholder="Search for a city, landmark, or country…"
                    className={`${inputClass} pl-8`}
                  />
                  {isSearchingCustomStop && (
                    <Loader2
                      size={15}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink/40 dark:text-mist-light/40"
                    />
                  )}
                </div>

                {customStopError && <p className="px-1 text-xs text-red-600 dark:text-red-400">{customStopError}</p>}

                {customStopResults.length > 0 && (
                  <ul className="max-h-40 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10 dark:divide-white/5 dark:border-white/10">
                    {customStopResults.map((result, idx) => (
                      <li key={`${result.lat}-${result.lon}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => onSelectCustomStop(result)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-harbor/10 dark:text-mist-light"
                        >
                          <MapPin size={14} className="mt-0.5 shrink-0 text-harbor" />
                          <span>{result.display_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div
              className={`trip-scroll flex-1 overflow-y-auto rounded-xl bg-white/40 dark:bg-black/20 ${searchResults.length > 0 ? (isBucketBarCollapsed ? 'pb-16' : 'pb-56') : ''
                }`}
            >
              <div ref={exportRef} className="p-4">
                <h3 className="mb-4 font-display text-lg font-semibold text-ink dark:text-mist-light">{selectedTrip.name}</h3>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragEnd={onDragEnd}
                >
                  <div className="flex flex-col gap-5">
                    {selectedTrip.days.map((day, idx) => (
                      <TripDaySection
                        key={day.id}
                        containerId={containerIdForDay(day.id)}
                        title={`Day ${idx + 1}`}
                        dateLabel={formatDayDate(day.date)}
                        items={itemsByContainer.get(containerIdForDay(day.id)) ?? []}
                        locations={locations}
                        onRemoveItem={onRemoveItem}
                        onRemoveDay={() => onRemoveDay(day.id)}
                        onMoveItem={onMoveItem}
                        isFirstSection={idx === 0}
                        isLastSection={false}
                      />
                    ))}
                    <div className="flex justify-center">
                      <AddDayButton onAdd={onAddDay} />
                    </div>
                    <TripDaySection
                      containerId={UNSCHEDULED_CONTAINER}
                      title="Unscheduled"
                      items={itemsByContainer.get(UNSCHEDULED_CONTAINER) ?? []}
                      locations={locations}
                      onRemoveItem={onRemoveItem}
                      onMoveItem={onMoveItem}
                      isFirstSection={false}
                      isLastSection={true}
                    />
                  </div>
                  <DragOverlay>
                    {activeDragItem ? (
                      <ul className="pointer-events-none w-72">
                        <TripItemRowOverlay
                          item={activeDragItem}
                          index={0}
                          location={
                            activeDragItem.locationId
                              ? locations.find((l) => l.id === activeDragItem.locationId)
                              : undefined
                          }
                        />
                      </ul>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </>
        )}
      </section>

      {selectedTrip && searchResults.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="glass-panel pointer-events-auto flex max-w-full flex-col gap-2 rounded-2xl p-3 shadow-lg sm:max-w-[calc(100vw-2rem)]">
            <button
              type="button"
              onClick={() => setIsBucketBarCollapsed((prev) => !prev)}
              aria-expanded={!isBucketBarCollapsed}
              className="flex items-center justify-between gap-3 px-1 text-left"
            >
              <span className="text-xs font-medium text-ink/60 dark:text-mist-light/60">
                {searchResults.length} bucket-list spot{searchResults.length === 1 ? '' : 's'}
              </span>
              <span className="text-ink/50 dark:text-mist-light/50">
                {isBucketBarCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>
            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isBucketBarCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
                }`}
            >
              <div className="flex max-w-full gap-3 overflow-x-auto pt-1">
                {searchResults.map((loc) => (
                  <div
                    key={loc.id}
                    className="w-52 shrink-0 rounded-xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-black/30"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="truncate font-display text-sm font-semibold text-ink dark:text-mist-light">
                        {loc.name}
                      </h3>
                      <span className="flex shrink-0 items-center gap-0.5 text-brass">
                        {Array.from({ length: loc.priority }).map((_, i) => (
                          <Star key={i} size={10} fill="currentColor" strokeWidth={0} />
                        ))}
                      </span>
                    </div>
                    <LocationImage src={loc.imageUrl} alt={loc.name} />
                    <p className="mb-1 flex items-center gap-1 text-xs text-ink/70 dark:text-mist-light/70">
                      <MapPin size={11} /> {loc.country}
                    </p>
                    <p className="mb-2 inline-block rounded-full bg-harbor/10 px-2 py-0.5 text-[10px] font-medium text-harbor">
                      {loc.category}
                    </p>
                    {loc.notes && (
                      <p className="mb-2 line-clamp-2 text-xs text-ink/70 dark:text-mist-light/70">{loc.notes}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onAddExistingLocation(loc)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-harbor px-2 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    >
                      <MapPinPlus size={13} /> Add to trip
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTrip && (
        <TripToolsBar
          isOpen={isToolsOpen}
          onToggle={() => setIsToolsOpen((prev) => !prev)}
          onSelect={(kind) => setActiveTool(kind)}
        />
      )}

      {selectedTrip && activeTool && (
        <TripToolPopup
          kind={activeTool}
          onClose={() => setActiveTool(null)}
          onAddNote={onAddNote}
          onAddTransport={onAddTransport}
          onAddLodging={onAddLodging}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
