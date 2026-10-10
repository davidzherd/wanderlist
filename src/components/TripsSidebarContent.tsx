import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Luggage, Pencil, Plus, Trash2, X } from 'lucide-react'
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
  /** When set, each row gets a pencil that turns its name into an inline editor (used by the mobile trips sheet). */
  onRenameTrip?: (id: string, name: string) => Promise<boolean>
  /** Hide the "Your trips" heading — e.g. inside a BottomSheet that already titles it. */
  hideHeading?: boolean
}

export function TripsSidebarContent({
  trips,
  isLoading,
  selectedTripId,
  onSelectTrip,
  onDeleteTrip,
  onCreateTrip,
  onRenameTrip,
  hideHeading = false,
}: TripsSidebarContentProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const saveRename = async () => {
    if (!renamingId || !onRenameTrip) return
    if (await onRenameTrip(renamingId, renameDraft)) setRenamingId(null)
  }

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
      {!hideHeading && (
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink dark:text-mist-light">
          <Luggage size={16} /> Your trips
        </h2>
      )}

      <form onSubmit={tripForm.handleSubmit(handleCreate)} className="flex gap-2">
        <input type="text" placeholder="New trip name…" {...tripForm.register('name')} className={inputClass} />
        <button
          type="submit"
          aria-label="Create trip"
          title="Create trip"
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
              {renamingId === trip.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveRename()
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    autoFocus
                    aria-label={`Rename ${trip.name}`}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => void saveRename()}
                    aria-label="Save trip name"
                    title="Save trip name"
                    className="shrink-0 rounded-lg p-2 text-harbor hover:bg-harbor/10"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    aria-label="Cancel rename"
                    title="Cancel rename"
                    className="shrink-0 rounded-lg p-2 text-ink/50 hover:bg-black/5 dark:text-mist-light/50 dark:hover:bg-white/10"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
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
                  {onRenameTrip && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Rename ${trip.name}`}
                      title={`Rename ${trip.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setRenameDraft(trip.name)
                        setRenamingId(trip.id)
                      }}
                      className="ml-auto shrink-0 p-1 opacity-60 hover:opacity-100"
                    >
                      <Pencil size={13} />
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${trip.name}`}
                    title={`Delete ${trip.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteTrip(trip.id)
                    }}
                    className="ml-2 shrink-0 opacity-60 hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
