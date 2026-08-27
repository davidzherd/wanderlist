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
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Luggage,
  MapPin,
  MapPinPlus,
  Pencil,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../context/LocationContext'
import { useIsMobile } from '../hooks/useIsMobile'
import * as tripsApi from '../api/trips'
import { geocodeSearch } from '../api/geocode'
import { searchFirstPexelsPhoto } from '../api/pexels'
import { ApiError } from '../api/client'
import type { Location, NominatimResult } from '../types/location'
import type {
  Trip,
  TripItem,
  NoteItemFormValues,
  TransportItemFormValues,
  LodgingItemFormValues,
  LocationItemFormValues,
} from '../types/trip'
import { TripFormSchema, type TripFormValues } from '../types/trip'
import { PdfExportButton } from '../components/PdfExportButton'
import { LocationImage } from '../components/LocationImage'
import { TripToolsBar } from '../components/TripToolsBar'
import { TripToolPopup, type TripToolPopupState } from '../components/TripToolPopup'
import { TripDaySection } from '../components/TripDaySection'
import { TripsSidebarContent } from '../components/TripsSidebarContent'
import { TRANSPORT_LABELS, TripItemRowOverlay } from '../components/TripItemRow'
import { BucketlistCelebration } from '../components/BucketlistCelebration'
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
  const { locations, addLocation } = useLocations()
  const { toasts, pushToast, dismissToast } = useToasts()

  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [toolPopup, setToolPopup] = useState<TripToolPopupState | null>(null)
  const [isBucketBarCollapsed, setIsBucketBarCollapsed] = useState(false)
  const [isEditingTripName, setIsEditingTripName] = useState(false)
  const [tripNameDraft, setTripNameDraft] = useState('')
  const [isTripsMenuOpen, setIsTripsMenuOpen] = useState(false)
  const [customStopQuery, setCustomStopQuery] = useState('')
  const [customStopResults, setCustomStopResults] = useState<NominatimResult[]>([])
  const [isSearchingCustomStop, setIsSearchingCustomStop] = useState(false)
  const [customStopError, setCustomStopError] = useState<string | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<TripItem | null>(null)
  const [celebration, setCelebration] = useState<{ name: string; imageUrl?: string } | null>(null)
  const dragStartTripRef = useRef<Trip | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const bucketTrayRef = useRef<HTMLDivElement>(null)
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
      const result = await tripsApi.fetchTrips()
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
    setIsEditingTripName(false)
  }, [selectedTripId])

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

  const hasBucketTray = Boolean(selectedTrip && searchResults.length > 0)
  useEffect(() => {
    const el = bucketTrayRef.current
    if (!el) return
    // React attaches JSX onWheel listeners as passive, which silently no-ops preventDefault —
    // this needs a real native listener so vertical wheel scroll can be redirected horizontally.
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [hasBucketTray])

  const onCreateTrip = async (values: TripFormValues) => {
    if (!user) return
    try {
      const created = await tripsApi.createTrip(values.name)
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
      await tripsApi.deleteTrip(id)
      setTrips((prev) => prev.filter((t) => t.id !== id))
      setSelectedTripId((prev) => (prev === id ? null : prev))
    } catch {
      pushToast('error', 'Could not delete trip.')
    }
  }

  const onRenameTrip = async (tripId: string, name: string) => {
    if (!user) return
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      pushToast('error', 'Trip name must be at least 2 characters.')
      return
    }
    try {
      const updated = await tripsApi.renameTrip(tripId, trimmed)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setIsEditingTripName(false)
    } catch {
      pushToast('error', 'Could not rename that trip.')
    }
  }

  const onAddExistingLocation = async (loc: Location) => {
    if (!user || !selectedTrip) return
    try {
      let imageUrl: string | undefined = loc.images[0]
      if (!imageUrl) {
        const photo = await searchFirstPexelsPhoto(`${loc.name} ${loc.country}`)
        imageUrl = photo?.url
      }
      const updated = await tripsApi.addTripItem(selectedTrip.id, {
        kind: 'location',
        locationId: loc.id,
        name: loc.name,
        country: loc.country,
        custom: false,
        imageUrl,
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
      const updated = await tripsApi.addTripItem(selectedTrip.id, {
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
      const updated = await tripsApi.addTripItem(selectedTrip.id, {
        kind: 'note',
        name: values.title,
        description: values.description,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Note added to trip.')
    } catch {
      pushToast('error', 'Could not add that note.')
    }
  }

  const onAddTransport = async (values: TransportItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(selectedTrip.id, {
        kind: 'transport',
        name: TRANSPORT_LABELS[values.transportType],
        transportType: values.transportType,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        price: values.price,
        description: values.description,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Transport added to trip.')
    } catch {
      pushToast('error', 'Could not add that transport.')
    }
  }

  const onAddLodging = async (values: LodgingItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(selectedTrip.id, {
        kind: 'lodging',
        name: values.name,
        description: values.description,
        checkInTime: values.checkInTime,
        checkOutTime: values.checkOutTime,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Lodging added to trip.')
    } catch {
      pushToast('error', 'Could not add that lodging.')
    }
  }

  const onAddLocation = async (values: LocationItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      let imageUrl = values.imageUrl
      if (!imageUrl) {
        const photo = await searchFirstPexelsPhoto(`${values.name} ${values.country ?? ''}`.trim())
        imageUrl = photo?.url
      }
      const updated = await tripsApi.addTripItem(selectedTrip.id, {
        kind: 'location',
        name: values.name,
        country: values.country,
        description: values.description,
        imageUrl,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', `${values.name} added to the trip.`)
    } catch {
      pushToast('error', 'Could not add that location.')
    }
  }

  const onEditNote = async (itemId: string, values: NoteItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.updateTripItem(selectedTrip.id, itemId, {
        name: values.title,
        description: values.description,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Note updated.')
    } catch {
      pushToast('error', 'Could not update that note.')
    }
  }

  const onEditTransport = async (itemId: string, values: TransportItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.updateTripItem(selectedTrip.id, itemId, {
        name: TRANSPORT_LABELS[values.transportType],
        transportType: values.transportType,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        price: values.price,
        description: values.description,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Transport updated.')
    } catch {
      pushToast('error', 'Could not update that transport.')
    }
  }

  const onEditLodging = async (itemId: string, values: LodgingItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.updateTripItem(selectedTrip.id, itemId, {
        name: values.name,
        description: values.description,
        checkInTime: values.checkInTime,
        checkOutTime: values.checkOutTime,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Lodging updated.')
    } catch {
      pushToast('error', 'Could not update that lodging.')
    }
  }

  const onEditLocation = async (itemId: string, values: LocationItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.updateTripItem(selectedTrip.id, itemId, {
        name: values.name,
        country: values.country,
        description: values.description,
        imageUrl: values.imageUrl,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setToolPopup(null)
      pushToast('success', 'Location updated.')
    } catch {
      pushToast('error', 'Could not update that location.')
    }
  }

  const onRemoveItem = async (itemId: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.removeTripItem(selectedTrip.id, itemId)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      pushToast('error', 'Could not remove that item.')
    }
  }

  // Promote a custom trip stop into a real bucket-list location, then re-link the trip item to it.
  // A bucket-list Location needs coordinates + a country (a custom stop stores neither reliably),
  // so we geocode the stop's name to fill those in; category/priority get sensible defaults the
  // user can refine later from the map.
  const onSaveToBucketlist = async (item: TripItem) => {
    if (!user || !selectedTrip) return
    // Save any location stop not already backed by an existing bucket-list location — that covers
    // never-saved custom stops and items whose saved location was later deleted (locationId may
    // still be set locally but no longer resolves to a real location).
    if (item.kind !== 'location') return
    if (item.locationId && locations.some((l) => l.id === item.locationId)) return
    try {
      let latitude = 0
      let longitude = 0
      let country = item.country ?? ''
      const [match] = await geocodeSearch(`${item.name} ${item.country ?? ''}`.trim())
      if (match) {
        latitude = Number(match.lat)
        longitude = Number(match.lon)
        if (!country) country = match.address?.country ?? match.display_name.split(',').pop()?.trim() ?? ''
      }

      const created = await addLocation({
        name: item.name,
        country: country || 'Unknown',
        category: 'Custom',
        priority: 3,
        latitude,
        longitude,
        notes: item.description,
        images: item.imageUrl ? [item.imageUrl] : [],
      })

      const updated = await tripsApi.updateTripItem(selectedTrip.id, item.id, {
        locationId: created.id,
        custom: false,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setCelebration({ name: created.name, imageUrl: created.images[0] })
    } catch {
      pushToast('error', 'Could not save that location to your bucket list.')
    }
  }

  const onDateRangeChange = async (startDate?: string, endDate?: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.updateTripDates(selectedTrip.id, startDate, endDate)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      pushToast('error', err instanceof ApiError ? err.message : 'Could not update trip dates.')
    }
  }

  const onAddDay = async () => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripDay(selectedTrip.id)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      pushToast('error', err instanceof ApiError ? err.message : 'Could not add a day.')
    }
  }

  const onRemoveDay = async (dayId: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.removeTripDay(selectedTrip.id, dayId)
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
      const updated = await tripsApi.reorderTripItems(dragStartTrip.id, nextItems)
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
        const updated = await tripsApi.reorderTripItems(trip.id, items)
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
        const withNewDay = await tripsApi.addTripDay(selectedTrip.id)
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
    <div className="grid h-full w-full grid-cols-1 gap-4 overflow-y-auto bg-mist-light p-4 dark:bg-ink lg:grid-cols-[280px_1fr] lg:overflow-hidden lg:p-6">
      <aside className="glass-panel trip-scroll hidden flex-col gap-4 rounded-2xl p-4 lg:flex lg:overflow-y-auto">
        <TripsSidebarContent
          trips={trips}
          isLoading={isLoading}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          onDeleteTrip={onDeleteTrip}
          tripForm={tripForm}
          onCreateTrip={onCreateTrip}
        />
      </aside>

      <button
        type="button"
        onClick={() => setIsTripsMenuOpen(true)}
        aria-label="Open your trips"
        className="fixed left-0 top-1/2 z-40 flex -translate-y-1/2 items-center justify-center rounded-r-2xl bg-harbor p-3 text-white shadow-lg transition-[padding] hover:pr-4 lg:hidden"
      >
        <Luggage size={20} />
      </button>

      <div
        aria-hidden={!isTripsMenuOpen}
        className={`trip-scroll absolute inset-0 z-[1000] flex flex-col gap-4 overflow-y-auto bg-mist-light p-4 shadow-2xl transition-transform duration-300 ease-out dark:bg-ink lg:hidden ${
          isTripsMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsTripsMenuOpen(false)}
          aria-label="Close trips menu"
          className="absolute right-4 top-4 text-ink/50 hover:text-ink dark:text-mist-light/50 dark:hover:text-mist-light"
        >
          <X size={20} />
        </button>
        <TripsSidebarContent
          trips={trips}
          isLoading={isLoading}
          selectedTripId={selectedTripId}
          onSelectTrip={(id) => {
            setSelectedTripId(id)
            setIsTripsMenuOpen(false)
          }}
          onDeleteTrip={onDeleteTrip}
          tripForm={tripForm}
          onCreateTrip={async (values) => {
            await onCreateTrip(values)
            setIsTripsMenuOpen(false)
          }}
        />
      </div>

      <section className="glass-panel flex flex-col overflow-hidden rounded-2xl p-6">
        {!selectedTrip ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink/50 dark:text-mist-light/50">
            <Sparkles size={28} />
            <p>Select or create a trip to start building your itinerary.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {isEditingTripName ? (
                  <>
                    <input
                      type="text"
                      value={tripNameDraft}
                      onChange={(e) => setTripNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onRenameTrip(selectedTrip.id, tripNameDraft)
                        if (e.key === 'Escape') setIsEditingTripName(false)
                      }}
                      autoFocus
                      className={`${inputClass} max-w-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => onRenameTrip(selectedTrip.id, tripNameDraft)}
                      aria-label="Save trip name"
                      className="shrink-0 text-harbor hover:opacity-80"
                    >
                      <Check size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <h1 className="truncate font-display text-xl font-semibold text-ink dark:text-mist-light">
                      {selectedTrip.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setTripNameDraft(selectedTrip.name)
                        setIsEditingTripName(true)
                      }}
                      aria-label="Rename trip"
                      className="shrink-0 text-ink/40 hover:text-harbor dark:text-mist-light/40 dark:hover:text-harbor-light"
                    >
                      <Pencil size={15} />
                    </button>
                  </>
                )}
              </div>
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
                        onEditItem={(item) => setToolPopup({ mode: 'edit', item })}
                        onSaveToBucketlist={onSaveToBucketlist}
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
                      onEditItem={(item) => setToolPopup({ mode: 'edit', item })}
                      onSaveToBucketlist={onSaveToBucketlist}
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
          <div className="relative max-w-full sm:max-w-[calc(100vw-2rem)]">
            <div aria-hidden="true" className="glow-border animate-glow-pulse" />
            <div className="glass-panel pointer-events-auto relative z-10 flex max-w-full flex-col gap-2 rounded-2xl p-3 shadow-lg">
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
              <div ref={bucketTrayRef} className="trip-scroll flex max-w-full gap-3 overflow-x-auto pt-1">
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
                    <LocationImage src={loc.images[0]} alt={loc.name} />
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
        </div>
      )}

      {selectedTrip && (
        <TripToolsBar
          isOpen={isToolsOpen}
          onToggle={() => setIsToolsOpen((prev) => !prev)}
          onSelect={(kind) => setToolPopup({ mode: 'add', kind })}
        />
      )}

      {selectedTrip && toolPopup && (
        <TripToolPopup
          state={toolPopup}
          onClose={() => setToolPopup(null)}
          onAddNote={onAddNote}
          onAddTransport={onAddTransport}
          onAddLodging={onAddLodging}
          onAddLocation={onAddLocation}
          onEditNote={onEditNote}
          onEditTransport={onEditTransport}
          onEditLodging={onEditLodging}
          onEditLocation={onEditLocation}
        />
      )}

      {celebration && (
        <BucketlistCelebration
          name={celebration.name}
          imageUrl={celebration.imageUrl}
          onClose={() => setCelebration(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
