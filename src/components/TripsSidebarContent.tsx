import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Luggage, Plus, Trash2 } from 'lucide-react'
import { TripFormSchema, type Trip, type TripFormValues } from '../types/trip'
import { Skeleton } from './Skeleton'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

interface TripsSidebarContentProps {
  trips: Trip[]
  isLoading: boolean
  selectedTripId: string | null
  onSelectTrip: (id: string) => void
  onDeleteTrip: (id: string) => void
  onCreateTrip: (values: TripFormValues) => Promise<boolean>
}

export function TripsSidebarContent({
  trips,
  isLoading,
  selectedTripId,
  onSelectTrip,
  onDeleteTrip,
  onCreateTrip,
}: TripsSidebarContentProps) {
  const tripForm = useForm<TripFormValues>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: { name: '' },
  })

  const handleCreate = async (values: TripFormValues) => {
    const created = await onCreateTrip(values)
    if (created) tripForm.reset()
  }

  return (
    <>
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink dark:text-mist-light">
        <Luggage size={16} /> Your trips
      </h2>

      <form onSubmit={tripForm.handleSubmit(handleCreate)} className="flex gap-2">
        <input type="text" placeholder="New trip name…" {...tripForm.register('name')} className={inputClass} />
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
                onClick={() => onSelectTrip(trip.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  trip.id === selectedTripId
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
    </>
  )
}
