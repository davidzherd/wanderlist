import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Bus,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Hotel,
  Loader2,
  Luggage,
  MapPin,
  MapPinPlus,
  PenLine,
  Plane,
  Plus,
  Search,
  Sparkles,
  Star,
  TrainFront,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../context/LocationContext'
import { useIsMobile } from '../hooks/useIsMobile'
import * as tripsApi from '../api/trips'
import { geocodeSearch } from '../api/geocode'
import type { Location, NominatimResult } from '../types/location'
import type { Trip, TripItemKind, NoteItemFormValues, TransportItemFormValues, LodgingItemFormValues } from '../types/trip'
import { TripFormSchema, type TripFormValues } from '../types/trip'
import { Skeleton } from '../components/Skeleton'
import { PdfExportButton } from '../components/PdfExportButton'
import { LocationImage } from '../components/LocationImage'
import { TripToolsBar } from '../components/TripToolsBar'
import { TripToolPopup } from '../components/TripToolPopup'
import { ToastStack } from '../components/Toast'
import { useToasts } from '../hooks/useToasts'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

const TRANSPORT_LABELS: Record<NonNullable<TransportItemFormValues['transportType']>, string> = {
  plane: 'Plane',
  train: 'Train',
  bus: 'Bus',
}

const TRANSPORT_ICONS: Record<NonNullable<TransportItemFormValues['transportType']>, LucideIcon> = {
  plane: Plane,
  train: TrainFront,
  bus: Bus,
}

function ItemIconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-harbor/10 text-harbor dark:bg-harbor/15">
      <Icon size={28} />
    </div>
  )
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
  const exportRef = useRef<HTMLDivElement>(null)
  const customStopDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const isMobile = useIsMobile()

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
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        kind: 'location',
        name: shortName,
        country,
        custom: true,
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

  return (
    <div className="grid h-full w-full grid-cols-1 gap-4 overflow-y-auto bg-mist-light p-4 dark:bg-ink sm:grid-cols-[280px_1fr] sm:overflow-hidden sm:p-6">
      <aside className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:overflow-y-auto">
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <h1 className="font-display text-xl font-semibold text-ink dark:text-mist-light">{selectedTrip.name}</h1>
              <PdfExportButton targetRef={exportRef} fileName={selectedTrip.name.replace(/\s+/g, '-').toLowerCase()} />
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
              className={`flex-1 overflow-y-auto rounded-xl bg-white/40 dark:bg-black/20 ${searchResults.length > 0 ? (isBucketBarCollapsed ? 'pb-16' : 'pb-56') : ''
                }`}
            >
              <div ref={exportRef} className="p-4">
                <h3 className="mb-3 font-display text-lg font-semibold text-ink dark:text-mist-light">{selectedTrip.name}</h3>
                {selectedTrip.items.length === 0 ? (
                  <p className="text-sm text-ink/50 dark:text-mist-light/50">
                    No stops yet. Add a saved location or a custom stop above.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {selectedTrip.items.map((item, idx) => {
                      const loc = item.locationId ? locations.find((l) => l.id === item.locationId) : undefined

                      let subline: JSX.Element | null = null
                      if (item.kind === 'location') {
                        if (item.country) {
                          subline = (
                            <p className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
                              <MapPin size={11} /> {item.country}
                            </p>
                          )
                        }
                      } else if (item.kind === 'transport') {
                        subline = (
                          <p className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
                            <Clock size={11} /> {item.departureTime || '—'} → {item.arrivalTime || '—'}
                          </p>
                        )
                      } else if (item.kind === 'lodging') {
                        subline = (
                          <p className="flex items-center gap-1 text-xs text-ink/60 dark:text-mist-light/60">
                            <Clock size={11} /> In {item.checkInTime || '—'} · Out {item.checkOutTime || '—'}
                          </p>
                        )
                      }

                      const kindChipLabel = item.kind !== 'location' ? item.kind : item.custom ? 'custom' : null
                      const description =
                        item.kind === 'location'
                          ? loc?.notes || (item.custom ? 'Custom stop — no bucket-list description.' : 'No description added.')
                          : item.description || 'No description added.'

                      return (
                        <li
                          key={item.id}
                          className="flex gap-3 rounded-xl border border-black/5 bg-white/60 p-3 dark:border-white/10 dark:bg-black/20"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full bg-harbor/15 text-xs font-semibold text-harbor">
                            {idx + 1}
                          </span>
                          {item.kind === 'location' ? (
                            <LocationImage
                              src={loc?.imageUrl}
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
                                <p className="truncate font-display text-sm font-semibold text-ink dark:text-mist-light">
                                  {item.name}
                                </p>
                                {subline}
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.id)}
                                aria-label="Remove item"
                                className="shrink-0 text-ink/40 hover:text-red-600 dark:text-mist-light/40 dark:hover:text-red-400"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {loc?.category && (
                                <span className="rounded-full bg-harbor/10 px-2 py-0.5 text-[10px] font-medium text-harbor">
                                  {loc.category}
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
                        </li>
                      )
                    })}
                  </ol>
                )}
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
