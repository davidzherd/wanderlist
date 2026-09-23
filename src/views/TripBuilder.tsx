import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  Luggage,
  Map as MapIcon,
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
import type { Location } from '../types/location'
import { DEFAULT_CURRENCY } from '../data/currencies'
import { isStayPlaced, bannersForDay } from '../utils/lodging'
import type {
  Trip,
  TripItem,
  NoteItemFormValues,
  TransportItemFormValues,
  LodgingItemFormValues,
  LocationItemFormValues,
} from '../types/trip'
import { type TripFormValues } from '../types/trip'
import { PdfExportButton } from '../components/PdfExportButton'
import { LocationImage } from '../components/LocationImage'
import { TripToolsBar } from '../components/TripToolsBar'
import { TripToolPopup, type TripToolPopupState } from '../components/TripToolPopup'
import { clearToolDraft } from '../components/tripToolDraft'
import { FlyItemGhost } from '../components/FlyItemGhost'
import { TripDaySection } from '../components/TripDaySection'
import { TripDaysPopup } from '../components/TripDaysPopup'
import { FlyToListCard } from '../components/FlyToListCard'
import { Logo } from '../components/Logo'
import { TripsSidebarContent } from '../components/TripsSidebarContent'
import { TRANSPORT_LABELS, TripItemRowOverlay } from '../components/TripItemRow'
import { BucketlistCelebration } from '../components/BucketlistCelebration'
import { AddDayButton } from '../components/AddDayButton'
import { DateRangePicker } from '../components/DateRangePicker'
import { CurrencySelect } from '../components/CurrencySelect'
import { TripCostSummary } from '../components/TripCostSummary'
import { UnplacedStays } from '../components/UnplacedStays'
import { DayRouteMap } from '../components/DayRouteMap'
import { useTheme } from '../hooks/useTheme'
import { ToastStack } from '../components/Toast'
import { TagChips } from '../components/TagChips'
import { useToasts } from '../hooks/useToasts'
import { useExchangeRates } from '../hooks/useExchangeRates'

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
  const [activeDragItem, setActiveDragItem] = useState<TripItem | null>(null)
  const [daysPopup, setDaysPopup] = useState<{ mode: 'reorder' } | { mode: 'move'; item: TripItem } | null>(null)
  const [celebration, setCelebration] = useState<{ name: string; imageUrl?: string } | null>(null)
  const dragStartTripRef = useRef<Trip | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const bucketTrayRef = useRef<HTMLDivElement>(null)
  const unscheduledRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const { theme } = useTheme()

  // Day-route map. Below the lg breakpoint (where the layout stacks) it's a List|Map tab; at/above
  // it it's a right-side pane with a header on/off switch (persisted). `selectedDayId` is the day the
  // map focuses — it drives ONLY the map, never the list, so drag-and-drop is untouched.
  const isMapStacked = useIsMobile(1024)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [isMapOpen, setIsMapOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wanderlist.tripMapOpen') !== 'false'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('wanderlist.tripMapOpen', String(isMapOpen))
    } catch {
      /* storage blocked — non-fatal */
    }
  }, [isMapOpen])

  // Desktop map pane width (px), adjustable via the drag divider and persisted. Clamped on drag.
  const sectionRef = useRef<HTMLElement>(null)
  const [mapWidth, setMapWidth] = useState<number>(() => {
    try {
      const stored = Number(localStorage.getItem('wanderlist.tripMapWidth'))
      return Number.isFinite(stored) && stored > 0 ? stored : 460
    } catch {
      return 460
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('wanderlist.tripMapWidth', String(mapWidth))
    } catch {
      /* storage blocked — non-fatal */
    }
  }, [mapWidth])

  // Per-day accordion collapse (session state) + focusing a day on the map.
  const [collapsedDayIds, setCollapsedDayIds] = useState<Set<string>>(() => new Set())
  const toggleDayCollapsed = (dayId: string) =>
    setCollapsedDayIds((prev) => {
      const next = new Set(prev)
      if (next.has(dayId)) next.delete(dayId)
      else next.add(dayId)
      return next
    })
  const focusDay = (dayId: string) => {
    setSelectedDayId(dayId)
    // On desktop, picking a day should surface it — open the map pane if it's off. On mobile the user
    // stays in the list (they switch to the map tab themselves); the selection is remembered.
    if (!isMapStacked) setIsMapOpen(true)
  }

  const startMapResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const section = sectionRef.current
    if (!section) return
    const onMove = (ev: PointerEvent) => {
      const rect = section.getBoundingClientRect()
      // Map hugs the right edge; width grows as the cursor moves left. Leave room for the list.
      const next = rect.right - ev.clientX
      setMapWidth(Math.max(300, Math.min(next, rect.width - 340)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // A bucket-list card mid-flight from the tray to the Unscheduled list (visual "added!" cue).
  const [flyingCard, setFlyingCard] = useState<{ loc: Location; from: DOMRect; to: DOMRect } | null>(null)
  const clearFlyingCard = useCallback(() => setFlyingCard(null), [])

  // A tool item (note/transport/lodging/custom location) mid-flight from a just-closed tool popup to
  // the Unscheduled list — same "added!" cue as the tray, but generic. `nonce` keys the ghost so
  // rapid successive adds each remount and re-run the flight.
  const [toolFly, setToolFly] = useState<{ label: string; to: DOMRect; nonce: number } | null>(null)
  const clearToolFly = useCallback(() => setToolFly(null), [])

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

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null

  // Daily FX rates for cost totals, keyed to the trip's home currency. Fail-soft: `rateStatus` is
  // 'failed' only when no table could be loaded at all (offline + no cache), in which case totals
  // fall back to native per-item amounts. DEFAULT_CURRENCY keeps the hook order stable when no trip
  // is selected (the summary/day-totals just aren't rendered then).
  const homeCurrency = selectedTrip?.currency ?? DEFAULT_CURRENCY
  const { table: rateTable, status: rateStatus } = useExchangeRates(homeCurrency)

  const usedLocationIds = new Set(selectedTrip?.items.map((i) => i.locationId).filter(Boolean))
  const availableLocations = locations.filter((loc) => !usedLocationIds.has(loc.id))

  const trimmedQuery = locationQuery.trim().toLowerCase()
  const searchResults = trimmedQuery
    ? availableLocations.filter(
      (loc) => loc.name.toLowerCase().includes(trimmedQuery) || loc.country.toLowerCase().includes(trimmedQuery),
    )
    : availableLocations

  // Tray is visible whenever there are unused spots to filter (the filter input lives in it now);
  // the scrollable card row only exists when the current filter actually matches something.
  const showBucketTray = Boolean(selectedTrip && availableLocations.length > 0)
  const trayHasCards = Boolean(selectedTrip && searchResults.length > 0)
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
  }, [trayHasCards])

  const onCreateTrip = async (values: TripFormValues): Promise<boolean> => {
    if (!user) return false
    try {
      const created = await tripsApi.createTrip(values.name)
      setTrips((prev) => [...prev, created])
      setSelectedTripId(created.id)
      pushToast('success', `Trip "${created.name}" created.`)
      return true
    } catch {
      pushToast('error', 'Could not create trip.')
      return false
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

  // Every add — tray or tool, any item kind — should land at the TOP of Unscheduled and scroll into
  // view, so the item appears right where the fly animation points. addTripItem appends at the end,
  // so pull the new item (the one whose id wasn't in `existingIds`) to global index 0; grouping is by
  // day, so this makes it first within Unscheduled while every other item keeps its relative order.
  // The reordered order is then persisted; a persist failure is non-fatal (only the order is at risk).
  const revealNewUnscheduledItem = async (updated: Trip, existingIds: Set<string>) => {
    const newItem = updated.items.find((i) => !existingIds.has(i.id))
    const reordered = newItem ? [newItem, ...updated.items.filter((i) => i.id !== newItem.id)] : updated.items
    setTrips((prev) => prev.map((t) => (t.id === updated.id ? { ...updated, items: reordered } : t)))
    requestAnimationFrame(() => unscheduledRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    if (newItem) {
      try {
        const persisted = await tripsApi.reorderTripItems(updated.id, reordered)
        setTrips((prev) => prev.map((t) => (t.id === persisted.id ? persisted : t)))
      } catch {
        // The item is added; only its ordering didn't persist. Non-fatal — leave the optimistic order.
      }
    }
  }

  const onAddExistingLocation = async (loc: Location) => {
    if (!user || !selectedTrip) return
    const existingIds = new Set(selectedTrip.items.map((i) => i.id))
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
      await revealNewUnscheduledItem(updated, existingIds)
    } catch {
      pushToast('error', 'Could not add that location to the trip.')
    }
  }

  // Adds a bucket-list location from the tray, kicking off the fly-to-Unscheduled
  // animation first (immediate feedback) then the async save in parallel. Falls back
  // to a toast when we can't animate (missing rects, or reduced-motion preference).
  const handleAddFromTray = (loc: Location, buttonEl: HTMLElement) => {
    const card = buttonEl.closest('[data-tray-card]')
    const target = unscheduledRef.current
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (card && target && !prefersReduced) {
      setFlyingCard({ loc, from: card.getBoundingClientRect(), to: target.getBoundingClientRect() })
    } else {
      pushToast('success', `${loc.name} added to the trip.`)
    }
    void onAddExistingLocation(loc)
  }

  // Kick off the fly-to-Unscheduled "added!" cue (unless reduced-motion). Called at the moment the
  // user submits a tool form, before the async save, so adding feels instant instead of waiting on
  // the API. No-op-with-toast fallback is handled by the caller.
  const startToolFly = (label: string) => {
    const target = unscheduledRef.current
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (target && !prefersReduced) {
      setToolFly({ label, to: target.getBoundingClientRect(), nonce: Date.now() })
    }
  }

  const onAddNote = async (values: NoteItemFormValues) => {
    if (!user || !selectedTrip) return
    const trip = selectedTrip
    const existingIds = new Set(trip.items.map((i) => i.id))
    // Optimistic feel: fly the cue and close the form immediately; save in the background. Only on
    // failure do we reopen the form (its draft is still stored, so the fields come back prefilled).
    startToolFly(values.title)
    setToolPopup(null)
    try {
      const updated = await tripsApi.addTripItem(trip.id, {
        kind: 'note',
        name: values.title,
        description: values.description,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        price: values.price,
        currency: values.currency || undefined,
        custom: true,
      })
      await revealNewUnscheduledItem(updated, existingIds)
      clearToolDraft('note')
      pushToast('success', 'Note added to trip.')
    } catch {
      setToolPopup({ mode: 'add', kind: 'note' })
      pushToast('error', 'Could not add that note. Your details are still here — try again.')
    }
  }

  const onAddTransport = async (values: TransportItemFormValues) => {
    if (!user || !selectedTrip) return
    const trip = selectedTrip
    const existingIds = new Set(trip.items.map((i) => i.id))
    startToolFly(TRANSPORT_LABELS[values.transportType])
    setToolPopup(null)
    try {
      const updated = await tripsApi.addTripItem(trip.id, {
        kind: 'transport',
        name: TRANSPORT_LABELS[values.transportType],
        transportType: values.transportType,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        price: values.price,
        currency: values.currency || undefined,
        description: values.description,
        custom: true,
      })
      await revealNewUnscheduledItem(updated, existingIds)
      clearToolDraft('transport')
      pushToast('success', 'Transport added to trip.')
    } catch {
      setToolPopup({ mode: 'add', kind: 'transport' })
      pushToast('error', 'Could not add that transport. Your details are still here — try again.')
    }
  }

  const onAddLodging = async (values: LodgingItemFormValues) => {
    if (!user || !selectedTrip) return
    const trip = selectedTrip
    // A stay is date-driven, not a positioned card, so it doesn't fly into Unscheduled like other
    // tools — just save and let it surface as day banners (if dated) or a "stay to schedule" entry.
    setToolPopup(null)
    try {
      const updated = await tripsApi.addTripItem(trip.id, {
        kind: 'lodging',
        name: values.name,
        description: values.description,
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        checkInTime: values.checkInTime,
        checkOutTime: values.checkOutTime,
        price: values.price,
        currency: values.currency || undefined,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      clearToolDraft('lodging')
      const placed = isStayPlaced(
        updated.items.find((i) => !trip.items.some((o) => o.id === i.id)) ?? ({} as TripItem),
        new Set(updated.days.map((d) => d.date).filter((d): d is string => Boolean(d))),
      )
      pushToast('success', placed ? 'Stay added to your itinerary.' : 'Stay saved — add dates to place it on your days.')
    } catch {
      setToolPopup({ mode: 'add', kind: 'lodging' })
      pushToast('error', 'Could not add that lodging. Your details are still here — try again.')
    }
  }

  const onAddLocation = async (values: LocationItemFormValues) => {
    if (!user || !selectedTrip) return
    const trip = selectedTrip
    const existingIds = new Set(trip.items.map((i) => i.id))
    startToolFly(values.name)
    setToolPopup(null)
    try {
      let imageUrl = values.imageUrl
      if (!imageUrl) {
        const photo = await searchFirstPexelsPhoto(`${values.name} ${values.country ?? ''}`.trim())
        imageUrl = photo?.url
      }
      const updated = await tripsApi.addTripItem(trip.id, {
        kind: 'location',
        name: values.name,
        country: values.country,
        description: values.description,
        imageUrl,
        departureTime: values.departureTime,
        arrivalTime: values.arrivalTime,
        price: values.price,
        currency: values.currency || undefined,
        // Present when the location was picked from the modal's place search — keeps coordinates so
        // the custom stop can feed travel estimates.
        latitude: values.latitude,
        longitude: values.longitude,
        custom: true,
      })
      await revealNewUnscheduledItem(updated, existingIds)
      clearToolDraft('location')
      pushToast('success', `${values.name} added to the trip.`)
    } catch {
      setToolPopup({ mode: 'add', kind: 'location' })
      pushToast('error', 'Could not add that location. Your details are still here — try again.')
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
        price: values.price,
        currency: values.currency || undefined,
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
        currency: values.currency || undefined,
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
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        checkInTime: values.checkInTime,
        checkOutTime: values.checkOutTime,
        price: values.price,
        currency: values.currency || undefined,
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
        price: values.price,
        currency: values.currency || undefined,
        latitude: values.latitude,
        longitude: values.longitude,
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

  // Duplicates an item: inserts an exact copy (same day, same fields) directly after the original.
  // addTripItem appends at the end, so we pull the new copy up to sit right below its source, then
  // persist the order (a persist failure is non-fatal — the copy exists, only its position is at risk).
  const onDuplicateItem = async (item: TripItem) => {
    if (!user || !selectedTrip) return
    const trip = selectedTrip
    const existingIds = new Set(trip.items.map((i) => i.id))
    try {
      const { id: _id, ...copy } = item
      void _id
      const updated = await tripsApi.addTripItem(trip.id, copy)
      const newItem = updated.items.find((i) => !existingIds.has(i.id))
      if (!newItem) {
        setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        return
      }
      const withoutNew = updated.items.filter((i) => i.id !== newItem.id)
      const originalIdx = withoutNew.findIndex((i) => i.id === item.id)
      const reordered =
        originalIdx === -1
          ? updated.items
          : [...withoutNew.slice(0, originalIdx + 1), newItem, ...withoutNew.slice(originalIdx + 1)]
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? { ...updated, items: reordered } : t)))
      try {
        const persisted = await tripsApi.reorderTripItems(updated.id, reordered)
        setTrips((prev) => prev.map((t) => (t.id === persisted.id ? persisted : t)))
      } catch {
        // The copy is added; only its ordering didn't persist. Non-fatal — leave the optimistic order.
      }
    } catch {
      pushToast('error', 'Could not duplicate that item.')
    }
  }

  const onRenameDay = async (dayId: string, name: string) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.renameTripDay(selectedTrip.id, dayId, name)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      pushToast('error', 'Could not rename that day.')
    }
  }

  const onReorderDays = async (orderedDayIds: string[]) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.reorderTripDays(selectedTrip.id, orderedDayIds)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      pushToast('error', 'Could not reorder the days.')
    }
  }

  // Moves an item to the end of the chosen day (used by the move-to-day picker). Reuses the same
  // edge-move + reorder-persist path as the up/down arrows crossing into another day.
  const onMoveItemToDay = async (itemId: string, dayId: string) => {
    if (!user || !selectedTrip) return
    const item = selectedTrip.items.find((i) => i.id === itemId)
    if (!item) return
    const nextItems = moveToEdgeOfContainer(selectedTrip.items, item, containerIdForDay(dayId), 'end')
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? { ...t, items: nextItems } : t)))
    try {
      const updated = await tripsApi.reorderTripItems(selectedTrip.id, nextItems)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? selectedTrip : t)))
      pushToast('error', 'Could not move that item.')
    }
  }

  // Promote a custom trip stop into a real bucket-list location, then re-link the trip item to it.
  // A bucket-list Location needs coordinates + a country (a custom stop stores neither reliably),
  // so we geocode the stop's name to fill those in; tags/priority get sensible defaults the
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
        tags: ['Custom'],
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

  const onChangeCurrency = async (currency: string) => {
    if (!user || !selectedTrip) return
    // Optimistic: reflect the new default immediately, then persist. Roll back on failure.
    const previous = selectedTrip
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? { ...t, currency } : t)))
    try {
      const updated = await tripsApi.updateTripCurrency(selectedTrip.id, currency)
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setTrips((prev) => prev.map((t) => (t.id === previous.id ? previous : t)))
      pushToast('error', 'Could not change the trip currency.')
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
        if (i.kind !== 'lodging' && getContainerId(i) === overContainer) lastIdx = idx
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
    const containerItemIds = items.filter((i) => i.kind !== 'lodging' && getContainerId(i) === containerId).map((i) => i.id)
    const reorderedIds = arrayMove(containerItemIds, fromIndex, toIndex)
    const itemById = new Map(items.map((i) => [i.id, i]))
    let cursor = 0
    return items.map((item) => (getContainerId(item) === containerId ? itemById.get(reorderedIds[cursor++])! : item))
  }

  /** Moves `activeItem` to the very start or end of `containerId`, for the up/down arrow buttons crossing into a different day. */
  const moveToEdgeOfContainer = (items: TripItem[], activeItem: TripItem, containerId: string, edge: 'start' | 'end'): TripItem[] => {
    const containerItems = items.filter((i) => i.id !== activeItem.id && i.kind !== 'lodging' && getContainerId(i) === containerId)
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
      const containerItemIds = selectedTrip.items.filter((i) => i.kind !== 'lodging' && getContainerId(i) === overContainer).map((i) => i.id)
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
    const containerItems = selectedTrip.items.filter((i) => i.kind !== 'lodging' && getContainerId(i) === containerId)
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

  // Lodging is now date-driven, not a positioned card: a stay whose dates cover at least one dated
  // day ("placed") renders as auto banners on those days and is excluded from the card lists. A stay
  // that isn't placed yet (no dates, or dates matching no dated day) falls back to an editable card
  // in Unscheduled so it's never lost — fix its dates there to place it.
  const stays = selectedTrip ? selectedTrip.items.filter((i) => i.kind === 'lodging') : []
  const dayDates = new Set<string>()
  if (selectedTrip) for (const d of selectedTrip.days) if (d.date) dayDates.add(d.date)
  const placedStayIds = new Set(stays.filter((s) => isStayPlaced(s, dayDates)).map((s) => s.id))
  // Placed stays render as day banners; the rest as a small "Stays to schedule" list. Either way
  // lodging stays out of the sortable board (see itemsByContainer + the DnD helpers, which all skip
  // lodging) so a date-driven stay can never throw off drag-and-drop index math.
  const unplacedStays = stays.filter((s) => !placedStayIds.has(s.id))

  const itemsByContainer = new Map<string, TripItem[]>()
  if (selectedTrip) {
    for (const item of selectedTrip.items) {
      if (item.kind === 'lodging') continue // lodging is date-driven, never a positioned card
      const cid = getContainerId(item)
      const list = itemsByContainer.get(cid) ?? []
      list.push(item)
      itemsByContainer.set(cid, list)
    }
  }

  // Map layout: the focused day, and which panes show. When no day is picked (or the pick is stale),
  // default to the first day holding a location stop (bucket-list or custom) so the map opens on
  // something to show; days with only notes/transport/lodging are skipped. Falls back to the first
  // day when no day has a location. On desktop the list always shows and the map is gated by the
  // on/off switch; when stacked it's one or the other via the List|Map tab.
  const mapDayId = selectedTrip
    ? selectedDayId && selectedTrip.days.some((d) => d.id === selectedDayId)
      ? selectedDayId
      : (selectedTrip.days.find((d) => selectedTrip.items.some((i) => i.dayId === d.id && i.kind === 'location')) ??
          selectedTrip.days[0])?.id ?? null
    : null
  const showMap = Boolean(selectedTrip) && (isMapStacked ? mobileView === 'map' : isMapOpen)
  const mobileMapActive = isMapStacked && mobileView === 'map'

  return (
    <div className={`grid h-full w-full grid-cols-1 gap-4 bg-mist-light p-0 dark:bg-ink lg:grid-cols-[280px_1fr] lg:overflow-hidden lg:p-6 ${mobileMapActive ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <aside className="glass-panel trip-scroll hidden flex-col gap-4 rounded-2xl p-4 lg:flex lg:overflow-y-auto">
        <TripsSidebarContent
          trips={trips}
          isLoading={isLoading}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          onDeleteTrip={onDeleteTrip}
          onCreateTrip={onCreateTrip}
        />
      </aside>

      <button
        type="button"
        onClick={() => setIsTripsMenuOpen(true)}
        aria-label="Open your trips"
        title="Open your trips"
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
          title="Close trips menu"
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
          onCreateTrip={async (values) => {
            const created = await onCreateTrip(values)
            if (created) setIsTripsMenuOpen(false)
            return created
          }}
        />
      </div>

      <section ref={sectionRef} className="glass-panel flex flex-col overflow-hidden rounded-none p-0 lg:flex-row lg:rounded-2xl">
        {!selectedTrip ? (
          <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 text-center text-ink/50 dark:text-mist-light/50">
            <Sparkles size={28} />
            <p>Select or create a trip to start building your itinerary.</p>
          </div>
        ) : (
          <>
            <div className={`min-w-0 flex-1 flex-col overflow-hidden p-0 lg:flex lg:p-6 ${mobileMapActive ? 'hidden' : 'flex'}`}>
            <div className="mb-3 flex items-center justify-between gap-3 px-3 pt-3 lg:px-0 lg:pt-0">
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
                      title="Save trip name"
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
                      title="Rename trip"
                      className="shrink-0 text-ink/40 hover:text-harbor dark:text-mist-light/40 dark:hover:text-harbor-light"
                    >
                      <Pencil size={15} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Desktop: on/off switch for the side map pane (persisted). */}
                <button
                  type="button"
                  onClick={() => setIsMapOpen((v) => !v)}
                  aria-pressed={isMapOpen}
                  aria-label={isMapOpen ? 'Hide route map' : 'Show route map'}
                  title={isMapOpen ? 'Hide route map' : 'Show route map'}
                  className={`hidden shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors lg:inline-flex ${
                    isMapOpen
                      ? 'border-harbor bg-harbor/10 text-harbor'
                      : 'border-black/10 text-ink/60 hover:text-harbor dark:border-white/10 dark:text-mist-light/60'
                  }`}
                >
                  <MapIcon size={14} /> Map
                </button>
                {/* Mobile: switch to the map tab. */}
                <button
                  type="button"
                  onClick={() => setMobileView('map')}
                  aria-label="Show route map"
                  title="Show route map"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-ink/60 hover:text-harbor dark:border-white/10 dark:text-mist-light/60 lg:hidden"
                >
                  <MapIcon size={14} /> Map
                </button>
                <PdfExportButton targetRef={exportRef} fileName={selectedTrip.name.replace(/\s+/g, '-').toLowerCase()} />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 lg:px-0">
              <div className="flex flex-wrap items-center gap-3">
                <DateRangePicker startDate={selectedTrip.startDate} endDate={selectedTrip.endDate} onChange={onDateRangeChange} />
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink/60 dark:text-mist-light/60">
                  <span className="pdf-hide">Currency</span>
                  <CurrencySelect value={selectedTrip.currency} onChange={onChangeCurrency} className="pdf-hide" />
                </label>
              </div>
              <TripCostSummary items={selectedTrip.items} home={selectedTrip.currency} table={rateTable} status={rateStatus} />
            </div>

            <div
              className={`trip-scroll flex-1 overflow-y-auto rounded-xl bg-white/40 dark:bg-black/20 ${showBucketTray ? (isBucketBarCollapsed ? 'pb-20' : 'pb-56') : ''
                }`}
            >
              <div ref={exportRef} className="px-3 py-2 lg:p-4">
                {/* PDF-only "Created with" credit at the very top of the first page. */}
                <div className="pdf-only mb-5 hidden">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-ink/60 dark:text-mist-light/60">Created with</span>
                    <Logo className="h-7 w-7" />
                  </div>
                </div>
                {/* Title for the exported PDF only — hidden on screen (the editable name in the
                    header already shows it there), revealed during capture via `.pdf-export`. */}
                <h2 className="pdf-only mb-4 hidden font-display text-2xl font-semibold text-ink dark:text-mist-light">{selectedTrip.name}</h2>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragEnd={onDragEnd}
                >
                  <div className="flex flex-col gap-5">
                    <UnplacedStays
                      stays={unplacedStays}
                      tripCurrency={selectedTrip.currency}
                      onEdit={(item) => setToolPopup({ mode: 'edit', item })}
                      onRemove={onRemoveItem}
                    />
                    {selectedTrip.days.map((day, idx) => {
                      const banners = bannersForDay(day.date, stays)
                      return (
                      <TripDaySection
                        key={day.id}
                        containerId={containerIdForDay(day.id)}
                        title={day.name || `Day ${idx + 1}`}
                        dateLabel={formatDayDate(day.date)}
                        items={itemsByContainer.get(containerIdForDay(day.id)) ?? []}
                        locations={locations}
                        tripCurrency={selectedTrip.currency}
                        rateTable={rateTable}
                        topBanners={banners.top}
                        bottomBanners={banners.bottom}
                        collapsible
                        collapsed={collapsedDayIds.has(day.id)}
                        onToggleCollapse={() => toggleDayCollapsed(day.id)}
                        isFocused={showMap && mapDayId === day.id}
                        onFocus={() => focusDay(day.id)}
                        onRemoveItem={onRemoveItem}
                        onEditItem={(item) => setToolPopup({ mode: 'edit', item })}
                        onSaveToBucketlist={onSaveToBucketlist}
                        onRemoveDay={() => onRemoveDay(day.id)}
                        onMoveItem={onMoveItem}
                        onDuplicateItem={onDuplicateItem}
                        onMoveItemToDay={
                          selectedTrip.days.length >= 2 ? (item) => setDaysPopup({ mode: 'move', item }) : undefined
                        }
                        onRenameDay={(name) => onRenameDay(day.id, name)}
                        onReorderDays={selectedTrip.days.length >= 2 ? () => setDaysPopup({ mode: 'reorder' }) : undefined}
                        pdfEmptyLabel="Nothing planned for this day."
                        isFirstSection={idx === 0}
                        isLastSection={false}
                      />
                      )
                    })}
                    <div className="flex justify-center pdf-hide">
                      <AddDayButton onAdd={onAddDay} />
                    </div>
                    {/* An empty Unscheduled bin is a drop target with no itinerary value — omit it from the PDF. */}
                    <div ref={unscheduledRef} className={(itemsByContainer.get(UNSCHEDULED_CONTAINER)?.length ?? 0) === 0 ? 'pdf-hide' : undefined}>
                      <TripDaySection
                        containerId={UNSCHEDULED_CONTAINER}
                        title="Unscheduled"
                        items={itemsByContainer.get(UNSCHEDULED_CONTAINER) ?? []}
                        locations={locations}
                        tripCurrency={selectedTrip.currency}
                        rateTable={rateTable}
                        onRemoveItem={onRemoveItem}
                        onEditItem={(item) => setToolPopup({ mode: 'edit', item })}
                        onSaveToBucketlist={onSaveToBucketlist}
                        onMoveItem={onMoveItem}
                        onMoveItemToDay={
                          selectedTrip.days.length >= 1 ? (item) => setDaysPopup({ mode: 'move', item }) : undefined
                        }
                        showTravelEstimates={false}
                        isFirstSection={false}
                        isLastSection={true}
                      />
                    </div>
                  </div>
                  <DragOverlay>
                    {activeDragItem ? (
                      <ul className="pointer-events-none w-72">
                        <TripItemRowOverlay
                          item={activeDragItem}
                          tripCurrency={selectedTrip.currency}
                          stopNumber={
                            activeDragItem.kind === 'location'
                              ? selectedTrip.items.filter(
                                  (i) =>
                                    getContainerId(i) === getContainerId(activeDragItem) && i.kind === 'location',
                                ).findIndex((i) => i.id === activeDragItem.id) + 1
                              : undefined
                          }
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
            </div>
            {showMap && (
              <>
                {/* Desktop-only drag handle to resize the map pane. */}
                <div
                  onPointerDown={startMapResize}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize map"
                  title="Drag to resize the map"
                  className="hidden w-1.5 shrink-0 cursor-col-resize bg-black/5 transition-colors hover:bg-harbor/40 dark:bg-white/5 lg:block"
                />
                <div
                  className="flex min-h-0 w-full flex-1 flex-col lg:flex-none lg:border-l lg:border-black/10 dark:lg:border-white/10"
                  style={isMapStacked ? undefined : { width: mapWidth }}
                >
                  <DayRouteMap
                    days={selectedTrip.days}
                    items={selectedTrip.items}
                    locations={locations}
                    selectedDayId={mapDayId}
                    onSelectDay={setSelectedDayId}
                    theme={theme}
                    onClose={isMapStacked ? undefined : () => setIsMapOpen(false)}
                    onBackToList={isMapStacked ? () => setMobileView('list') : undefined}
                  />
                </div>
              </>
            )}
          </>
        )}
      </section>

      {showBucketTray && !mobileMapActive && (
        <div className="pointer-events-none fixed inset-x-0 bottom-2 z-40 flex justify-center px-2">
          <div className="relative w-full max-w-full">
            <div aria-hidden="true" className="glow-border animate-glow-pulse" />
            <div className="glass-panel pointer-events-auto relative z-10 flex w-full max-w-full flex-col gap-2 rounded-2xl p-3 shadow-lg">
              {/* Header: collapsed shows just the count; open reveals the filter (next to the tray it controls). */}
              <div className="flex items-center justify-between gap-2">
                {isBucketBarCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsBucketBarCollapsed(false)}
                    aria-expanded={false}
                    aria-label="Expand bucket-list tray"
                    className="flex flex-1 items-center justify-between gap-3 px-1 text-left"
                  >
                    <span className="text-xs font-medium text-ink/60 dark:text-mist-light/60">
                      {searchResults.length} bucket-list spot{searchResults.length === 1 ? '' : 's'}
                    </span>
                    <ChevronUp size={18} className="shrink-0 text-ink/50 dark:text-mist-light/50" />
                  </button>
                ) : (
                  <>
                    <div className="relative w-44 sm:w-56">
                      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-harbor/60" />
                      <input
                        type="text"
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        placeholder="Filter your bucketlist…"
                        className="w-full rounded-lg border border-harbor/40 bg-white/60 py-1 pl-7 pr-2 text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-harbor/40 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBucketBarCollapsed(true)}
                      aria-expanded
                      aria-label="Collapse bucket-list tray"
                      title="Collapse bucket-list tray"
                      className="shrink-0 rounded-lg p-1 text-ink/50 hover:bg-black/5 dark:text-mist-light/50 dark:hover:bg-white/10"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </>
                )}
              </div>
              <div
                className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isBucketBarCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
                  }`}
              >
                {trayHasCards ? (
                  <div ref={bucketTrayRef} className="trip-scroll flex max-w-full gap-2 overflow-x-auto pt-1 sm:gap-3">
                    {searchResults.map((loc) => (
                      <div
                        key={loc.id}
                        data-tray-card
                        className="flex w-40 shrink-0 flex-col rounded-xl border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-black/30 sm:w-52 sm:p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h3 className="truncate font-display text-xs font-semibold text-ink dark:text-mist-light sm:text-sm">
                            {loc.name}
                          </h3>
                          <span className="flex shrink-0 items-center gap-0.5 text-brass">
                            {Array.from({ length: loc.priority }).map((_, i) => (
                              <Star key={i} size={9} fill="currentColor" strokeWidth={0} />
                            ))}
                          </span>
                        </div>
                        <LocationImage src={loc.images[0]} alt={loc.name} className="mb-2 h-20 w-full rounded-lg object-cover sm:h-28" />
                        <p className="mb-1 flex items-center gap-1 text-[11px] text-ink/70 dark:text-mist-light/70 sm:text-xs">
                          <MapPin size={11} /> {loc.country}
                        </p>
                        <TagChips
                          tags={loc.tags}
                          limit={2}
                          className="mb-2"
                          chipClassName="rounded-full bg-harbor/10 px-2 py-0.5 text-[10px] font-medium text-harbor"
                        />
                        {loc.notes && (
                          <p className="mb-2 line-clamp-2 text-[11px] text-ink/70 dark:text-mist-light/70 sm:text-xs">{loc.notes}</p>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleAddFromTray(loc, e.currentTarget)}
                          className="mt-auto flex w-full items-center justify-center gap-1 rounded-lg bg-harbor px-2 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 sm:gap-1.5 sm:py-1.5 sm:text-xs"
                        >
                          <MapPinPlus size={12} /> Add to trip
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-4 text-center text-xs text-ink/50 dark:text-mist-light/50">
                    No saved spots match “{locationQuery}”.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTrip && !mobileMapActive && (
        <TripToolsBar
          isOpen={isToolsOpen}
          onToggle={() => setIsToolsOpen((prev) => !prev)}
          onSelect={(kind) => {
            setToolPopup({ mode: 'add', kind })
            setIsToolsOpen(false)
          }}
        />
      )}

      {selectedTrip && toolPopup && (
        <TripToolPopup
          state={toolPopup}
          tripCurrency={selectedTrip.currency}
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

      {selectedTrip && daysPopup && (
        <TripDaysPopup
          mode={daysPopup.mode}
          trip={selectedTrip}
          itemToMove={daysPopup.mode === 'move' ? daysPopup.item : undefined}
          onClose={() => setDaysPopup(null)}
          onSaveReorder={onReorderDays}
          onSaveMove={onMoveItemToDay}
        />
      )}

      {celebration && (
        <BucketlistCelebration
          name={celebration.name}
          imageUrl={celebration.imageUrl}
          onClose={() => setCelebration(null)}
        />
      )}

      {flyingCard && (
        <FlyToListCard
          key={`${flyingCard.loc.id}-${flyingCard.from.top}`}
          loc={flyingCard.loc}
          from={flyingCard.from}
          to={flyingCard.to}
          onDone={clearFlyingCard}
        />
      )}

      {toolFly && (
        <FlyItemGhost key={toolFly.nonce} label={toolFly.label} to={toolFly.to} onDone={clearToolFly} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
