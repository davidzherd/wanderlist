import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Luggage, Plus, Trash2, MapPinPlus, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../context/LocationContext'
import * as tripsApi from '../api/trips'
import type { Trip } from '../types/trip'
import { TripFormSchema, CustomTripItemFormSchema, type TripFormValues, type CustomTripItemFormValues } from '../types/trip'
import { Skeleton } from '../components/Skeleton'
import { PdfExportButton } from '../components/PdfExportButton'
import { ToastStack } from '../components/Toast'
import { useToasts } from '../hooks/useToasts'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:ring-2 focus:ring-terracotta dark:border-white/10 dark:bg-black/30 dark:text-sand-light dark:placeholder:text-sand-light/40'

export function TripBuilderView() {
  const { user } = useAuth()
  const { locations } = useLocations()
  const { toasts, pushToast, dismissToast } = useToasts()

  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const exportRef = useRef<HTMLDivElement>(null)

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

  const tripForm = useForm<TripFormValues>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: { name: '' },
  })
  const itemForm = useForm<CustomTripItemFormValues>({
    resolver: zodResolver(CustomTripItemFormSchema),
    defaultValues: { name: '', country: '' },
  })

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null
  const usedLocationIds = new Set(selectedTrip?.items.map((i) => i.locationId).filter(Boolean))
  const availableLocations = locations.filter((loc) => !usedLocationIds.has(loc.id))

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

  const onAddExistingLocation = async () => {
    if (!user || !selectedTrip || !selectedLocationId) return
    const loc = locations.find((l) => l.id === selectedLocationId)
    if (!loc) return
    try {
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        locationId: loc.id,
        name: loc.name,
        country: loc.country,
        custom: false,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setSelectedLocationId('')
    } catch {
      pushToast('error', 'Could not add that location to the trip.')
    }
  }

  const onAddCustomItem = async (values: CustomTripItemFormValues) => {
    if (!user || !selectedTrip) return
    try {
      const updated = await tripsApi.addTripItem(user.email, selectedTrip.id, {
        name: values.name,
        country: values.country,
        custom: true,
      })
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      itemForm.reset()
    } catch {
      pushToast('error', 'Could not add that item to the trip.')
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
    <div className="grid h-full w-full grid-cols-1 gap-4 overflow-y-auto bg-sand-light p-4 dark:bg-espresso sm:grid-cols-[280px_1fr] sm:overflow-hidden sm:p-6">
      <aside className="glass-panel flex flex-col gap-4 rounded-2xl p-4 sm:overflow-y-auto">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-espresso dark:text-sand-light">
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
            className="shrink-0 rounded-lg bg-terracotta px-3 py-2 text-white transition-opacity hover:opacity-90"
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
          <p className="text-sm text-espresso/50 dark:text-sand-light/50">No trips yet — create your first one above.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trips.map((trip) => (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    trip.id === selectedTripId
                      ? 'bg-terracotta text-white'
                      : 'text-espresso/80 hover:bg-black/5 dark:text-sand-light/80 dark:hover:bg-white/10'
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
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-espresso/50 dark:text-sand-light/50">
            <Sparkles size={28} />
            <p>Select or create a trip to start building your itinerary.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h1 className="font-display text-xl font-semibold text-espresso dark:text-sand-light">{selectedTrip.name}</h1>
              <PdfExportButton targetRef={exportRef} fileName={selectedTrip.name.replace(/\s+/g, '-').toLowerCase()} />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex gap-2">
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Add from bucket list…</option>
                  {availableLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} — {loc.country}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onAddExistingLocation}
                  disabled={!selectedLocationId}
                  aria-label="Add location to trip"
                  className="shrink-0 rounded-lg bg-terracotta px-3 py-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MapPinPlus size={16} />
                </button>
              </div>

              <form onSubmit={itemForm.handleSubmit(onAddCustomItem)} className="flex gap-2">
                <input type="text" placeholder="Custom stop name…" {...itemForm.register('name')} className={inputClass} />
                <button
                  type="submit"
                  aria-label="Add custom item"
                  className="shrink-0 rounded-lg bg-amber px-3 py-2 text-white transition-opacity hover:opacity-90"
                >
                  <Plus size={16} />
                </button>
              </form>
            </div>

            <div ref={exportRef} className="flex-1 overflow-y-auto rounded-xl bg-white/40 p-4 dark:bg-black/20">
              <h3 className="mb-3 font-display text-lg font-semibold text-espresso dark:text-sand-light">{selectedTrip.name}</h3>
              {selectedTrip.items.length === 0 ? (
                <p className="text-sm text-espresso/50 dark:text-sand-light/50">
                  No stops yet. Add a saved location or a custom stop above.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {selectedTrip.items.map((item, idx) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-black/20"
                    >
                      <span className="flex items-center gap-2 text-sm text-espresso dark:text-sand-light">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta">
                          {idx + 1}
                        </span>
                        <span>
                          {item.name}
                          {item.country && <span className="text-espresso/50 dark:text-sand-light/50"> — {item.country}</span>}
                        </span>
                        {item.custom && (
                          <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-medium text-amber">custom</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label="Remove item"
                        className="shrink-0 text-espresso/40 hover:text-red-600 dark:text-sand-light/40 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </section>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
