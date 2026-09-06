import { useEffect, useRef, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bus, Car, CarTaxiFront, ChevronDown, Globe, Loader2, MapPin, Plane, TrainFront, X, type LucideIcon } from 'lucide-react'
import {
  NoteItemFormSchema,
  TransportItemFormSchema,
  LodgingItemFormSchema,
  LocationItemFormSchema,
  type NoteItemFormValues,
  type TransportItemFormValues,
  type LodgingItemFormValues,
  type LocationItemFormValues,
  type TransportType,
  type TripItem,
  type TripItemKind,
} from '../types/trip'
import type { NominatimResult } from '../types/location'
import { useGeocodeSearch } from '../hooks/useGeocodeSearch'
import { TOOL_DEFS } from './TripToolsBar'
import { TimeInput } from './TimeInput'
import { withToolDraft, useToolDraftPersistence, clearToolDraft } from './tripToolDraft'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'
const labelClass = 'mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70'
const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400'
const submitClass =
  'mt-2 w-full rounded-lg bg-harbor px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90'

const TRANSPORT_TYPE_OPTIONS: { value: TransportType; label: string; icon: LucideIcon }[] = [
  { value: 'plane', label: 'Flight', icon: Plane },
  { value: 'train', label: 'Train Ride', icon: TrainFront },
  { value: 'bus', label: 'Bus Ride', icon: Bus },
  { value: 'taxi', label: 'Taxi', icon: CarTaxiFront },
  { value: 'car', label: 'Car', icon: Car },
]

function TransportTypeSelect({ value, onChange }: { value: TransportType; onChange: (value: TransportType) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selected = TRANSPORT_TYPE_OPTIONS.find((opt) => opt.value === value) ?? TRANSPORT_TYPE_OPTIONS[0]
  const SelectedIcon = selected.icon

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="flex items-center gap-2">
          <SelectedIcon size={15} className="text-harbor" />
          {selected.label}
        </span>
        <ChevronDown
          size={15}
          className={`text-ink/40 transition-transform dark:text-mist-light/40 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-mist-light shadow-lg dark:border-white/10 dark:bg-ink"
        >
          {TRANSPORT_TYPE_OPTIONS.map((opt) => {
            const OptionIcon = opt.icon
            const isSelected = opt.value === value
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-harbor/10 ${
                    isSelected ? 'bg-harbor/10 text-harbor' : 'text-ink dark:text-mist-light'
                  }`}
                >
                  <OptionIcon size={15} /> {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function LocationForm({
  onSubmit,
  defaultValues,
  submitLabel,
  draftKind,
  enableSearch = false,
}: {
  onSubmit: (values: LocationItemFormValues) => void
  defaultValues?: Partial<LocationItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
  /** Show the geocode search that autofills name/country/coordinates from a picked place. */
  enableSearch?: boolean
}) {
  const form = useForm<LocationItemFormValues>({
    resolver: zodResolver(LocationItemFormSchema),
    defaultValues: withToolDraft<LocationItemFormValues>(draftKind, { name: '', country: '', description: '', imageUrl: '', departureTime: '', arrivalTime: '', latitude: undefined, longitude: undefined, ...defaultValues }),
  })
  const { field: departureTimeField } = useController({ name: 'departureTime', control: form.control })
  const { field: arrivalTimeField } = useController({ name: 'arrivalTime', control: form.control })
  useToolDraftPersistence(draftKind, form.watch)

  const [placeQuery, setPlaceQuery] = useState('')
  const { results, isSearching, error: searchError, reset: resetSearch } = useGeocodeSearch(placeQuery)

  // Picking a place autofills the fields; the user can still edit them and set their own image
  // before submitting (a blank image falls back to Pexels). Coordinates ride along so the custom
  // stop can feed travel estimates, just like a bucket-list location.
  const handleSelectPlace = (result: NominatimResult) => {
    const shortName = result.display_name.split(',')[0]
    const country = result.address?.country ?? result.display_name.split(',').pop()?.trim() ?? ''
    form.setValue('name', shortName, { shouldValidate: true })
    form.setValue('country', country)
    form.setValue('latitude', Number(result.lat))
    form.setValue('longitude', Number(result.lon))
    setPlaceQuery('')
    resetSearch()
  }

  const handleSubmit = form.handleSubmit(onSubmit)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {enableSearch && (
        <div>
          <label className="block">
            <span className={labelClass}>Find a place (optional)</span>
            <div className="relative">
              <Globe size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-mist-light/40" />
              <input
                type="text"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="Search for a city, landmark, or country…"
                className={`${inputClass} pl-8`}
              />
              {isSearching && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink/40 dark:text-mist-light/40" />
              )}
            </div>
          </label>
          {searchError && <p className={errorClass}>{searchError}</p>}
          {results.length > 0 && (
            <ul className="mt-1 max-h-40 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10 dark:divide-white/5 dark:border-white/10">
              {results.map((result, idx) => (
                <li key={`${result.lat}-${result.lon}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectPlace(result)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-harbor/10 dark:text-mist-light"
                  >
                    <MapPin size={14} className="mt-0.5 shrink-0 text-harbor" />
                    <span>{result.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-ink/50 dark:text-mist-light/50">
            Pick a result to fill in the name and country — or just type them in below.
          </p>
        </div>
      )}
      <div>
        <label className="block">
          <span className={labelClass}>Name</span>
          <input type="text" placeholder="e.g. Grandma's cabin" {...form.register('name')} className={inputClass} />
        </label>
        {form.formState.errors.name && <p className={errorClass}>{form.formState.errors.name.message}</p>}
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Country (optional)</span>
          <input type="text" {...form.register('country')} className={inputClass} />
        </label>
      </div>
      <div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block">
              <span className={labelClass}>Latitude (optional)</span>
              <input type="number" step="any" placeholder="e.g. 48.8584" {...form.register('latitude')} className={inputClass} />
            </label>
            {form.formState.errors.latitude && <p className={errorClass}>{form.formState.errors.latitude.message}</p>}
          </div>
          <div>
            <label className="block">
              <span className={labelClass}>Longitude (optional)</span>
              <input type="number" step="any" placeholder="e.g. 2.2945" {...form.register('longitude')} className={inputClass} />
            </label>
            {form.formState.errors.longitude && <p className={errorClass}>{form.formState.errors.longitude.message}</p>}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ink/50 dark:text-mist-light/50">
          Filled in when you pick a place above — edit for a precise pin. Needed for travel estimates.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block">
            <span className={labelClass}>Start time (optional)</span>
            <TimeInput value={departureTimeField.value} onChange={departureTimeField.onChange} />
          </label>
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>End time (optional)</span>
            <TimeInput value={arrivalTimeField.value} onChange={arrivalTimeField.onChange} />
          </label>
        </div>
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Description (optional)</span>
          <textarea rows={3} placeholder="Add details…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Photo URL (optional)</span>
          <input type="text" placeholder="https://example.com/photo.jpg" {...form.register('imageUrl')} className={inputClass} />
        </label>
        {form.formState.errors.imageUrl && <p className={errorClass}>{form.formState.errors.imageUrl.message}</p>}
        <p className="mt-1 text-[11px] text-ink/50 dark:text-mist-light/50">
          Leave blank and we’ll try to find a photo on Pexels using the name and country above.
        </p>
      </div>
      <button type="submit" className={submitClass}>
        {submitLabel}
      </button>
    </form>
  )
}

function NoteForm({
  onSubmit,
  defaultValues,
  submitLabel,
  draftKind,
}: {
  onSubmit: (values: NoteItemFormValues) => void
  defaultValues?: Partial<NoteItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
}) {
  const form = useForm<NoteItemFormValues>({
    resolver: zodResolver(NoteItemFormSchema),
    defaultValues: withToolDraft<NoteItemFormValues>(draftKind, { title: '', description: '', departureTime: '', arrivalTime: '', ...defaultValues }),
  })
  const { field: departureTimeField } = useController({ name: 'departureTime', control: form.control })
  const { field: arrivalTimeField } = useController({ name: 'arrivalTime', control: form.control })
  useToolDraftPersistence(draftKind, form.watch)

  const handleSubmit = form.handleSubmit(onSubmit)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="block">
          <span className={labelClass}>Note title</span>
          <input type="text" placeholder="e.g. Pack sunscreen" {...form.register('title')} className={inputClass} />
        </label>
        {form.formState.errors.title && <p className={errorClass}>{form.formState.errors.title.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block">
            <span className={labelClass}>Start time (optional)</span>
            <TimeInput value={departureTimeField.value} onChange={departureTimeField.onChange} />
          </label>
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>End time (optional)</span>
            <TimeInput value={arrivalTimeField.value} onChange={arrivalTimeField.onChange} />
          </label>
        </div>
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea rows={3} placeholder="Add details…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <button type="submit" className={submitClass}>
        {submitLabel}
      </button>
    </form>
  )
}

function TransportForm({
  onSubmit,
  defaultValues,
  submitLabel,
  draftKind,
}: {
  onSubmit: (values: TransportItemFormValues) => void
  defaultValues?: Partial<TransportItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
}) {
  const form = useForm<TransportItemFormValues>({
    resolver: zodResolver(TransportItemFormSchema),
    defaultValues: withToolDraft<TransportItemFormValues>(draftKind, { transportType: 'plane', departureTime: '', arrivalTime: '', price: undefined, description: '', ...defaultValues }),
  })
  const { field: transportTypeField } = useController({ name: 'transportType', control: form.control })
  const { field: departureTimeField } = useController({ name: 'departureTime', control: form.control })
  const { field: arrivalTimeField } = useController({ name: 'arrivalTime', control: form.control })
  const showPrice = transportTypeField.value !== 'car'
  useToolDraftPersistence(draftKind, form.watch)

  const handleSubmit = form.handleSubmit((values) =>
    onSubmit(values.transportType === 'car' ? { ...values, price: undefined } : values),
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Transport type</label>
        <TransportTypeSelect value={transportTypeField.value} onChange={transportTypeField.onChange} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block">
            <span className={labelClass}>Start time (optional)</span>
            <TimeInput value={departureTimeField.value} onChange={departureTimeField.onChange} />
          </label>
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>End time (optional)</span>
            <TimeInput value={arrivalTimeField.value} onChange={arrivalTimeField.onChange} />
          </label>
        </div>
      </div>
      {showPrice && (
        <div>
          <label className="block">
            <span className={labelClass}>Price (optional)</span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              {...form.register('price')}
              className={inputClass}
            />
          </label>
          {form.formState.errors.price && <p className={errorClass}>{form.formState.errors.price.message}</p>}
        </div>
      )}
      <div>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea rows={3} placeholder="e.g. Flight AA123, confirmation #…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <button type="submit" className={submitClass}>
        {submitLabel}
      </button>
    </form>
  )
}

function LodgingForm({
  onSubmit,
  defaultValues,
  submitLabel,
  draftKind,
}: {
  onSubmit: (values: LodgingItemFormValues) => void
  defaultValues?: Partial<LodgingItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
}) {
  const form = useForm<LodgingItemFormValues>({
    resolver: zodResolver(LodgingItemFormSchema),
    defaultValues: withToolDraft<LodgingItemFormValues>(draftKind, { name: '', description: '', checkInTime: '', checkOutTime: '', ...defaultValues }),
  })
  const { field: checkInTimeField } = useController({ name: 'checkInTime', control: form.control })
  const { field: checkOutTimeField } = useController({ name: 'checkOutTime', control: form.control })
  useToolDraftPersistence(draftKind, form.watch)

  const handleSubmit = form.handleSubmit(onSubmit)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="block">
          <span className={labelClass}>Lodging name</span>
          <input type="text" placeholder="e.g. Hotel Marina" {...form.register('name')} className={inputClass} />
        </label>
        {form.formState.errors.name && <p className={errorClass}>{form.formState.errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block">
            <span className={labelClass}>Check-in time (optional)</span>
            <TimeInput value={checkInTimeField.value} onChange={checkInTimeField.onChange} />
          </label>
          {form.formState.errors.checkInTime && <p className={errorClass}>{form.formState.errors.checkInTime.message}</p>}
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>Check-out time (optional)</span>
            <TimeInput value={checkOutTimeField.value} onChange={checkOutTimeField.onChange} />
          </label>
          {form.formState.errors.checkOutTime && (
            <p className={errorClass}>{form.formState.errors.checkOutTime.message}</p>
          )}
        </div>
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea rows={3} placeholder="Add details…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <button type="submit" className={submitClass}>
        {submitLabel}
      </button>
    </form>
  )
}

export type TripToolPopupState = { mode: 'add'; kind: TripItemKind } | { mode: 'edit'; item: TripItem }

interface TripToolPopupProps {
  state: TripToolPopupState
  onClose: () => void
  onAddNote: (values: NoteItemFormValues) => void
  onAddTransport: (values: TransportItemFormValues) => void
  onAddLodging: (values: LodgingItemFormValues) => void
  onAddLocation: (values: LocationItemFormValues) => void
  onEditNote: (itemId: string, values: NoteItemFormValues) => void
  onEditTransport: (itemId: string, values: TransportItemFormValues) => void
  onEditLodging: (itemId: string, values: LodgingItemFormValues) => void
  onEditLocation: (itemId: string, values: LocationItemFormValues) => void
}

export function TripToolPopup({
  state,
  onClose,
  onAddNote,
  onAddTransport,
  onAddLodging,
  onAddLocation,
  onEditNote,
  onEditTransport,
  onEditLodging,
  onEditLocation,
}: TripToolPopupProps) {
  const kind = state.mode === 'add' ? state.kind : state.item.kind
  const tool = TOOL_DEFS.find((t) => t.kind === kind)!
  const Icon = tool.icon
  const isEditing = state.mode === 'edit'
  const submitLabel = isEditing ? 'Save changes' : tool.label === 'Custom location' ? 'Add location' : `Add ${tool.label.toLowerCase()}`
  // Only the add flow persists a draft; pass the kind so the form knows to save/restore it.
  const draftKind = state.mode === 'add' ? kind : undefined

  // An explicit close is an intentional discard, so drop the saved draft too. (An unexpected unmount
  // — e.g. a session-expiry redirect — never runs this, which is why the draft survives it.)
  const handleClose = () => {
    if (draftKind) clearToolDraft(draftKind)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="glass-panel w-full max-w-sm rounded-2xl bg-mist-light p-5 dark:bg-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-4 flex items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-harbor/15 text-harbor">
            <Icon size={20} />
          </span>
          <h2 className="pointer-events-none absolute inset-x-0 text-center font-display text-lg font-semibold text-ink dark:text-mist-light">
            {isEditing ? `Edit ${tool.label.toLowerCase()}` : tool.label}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            title="Close"
            className="ml-auto text-ink/50 hover:text-ink dark:text-mist-light/50 dark:hover:text-mist-light"
          >
            <X size={18} />
          </button>
        </div>

        {kind === 'location' && (
          <LocationForm
            submitLabel={submitLabel}
            draftKind={draftKind}
            enableSearch={state.mode === 'add'}
            defaultValues={
              state.mode === 'edit'
                ? {
                    name: state.item.name,
                    country: state.item.country ?? '',
                    description: state.item.description ?? '',
                    imageUrl: state.item.imageUrl ?? '',
                    departureTime: state.item.departureTime ?? '',
                    arrivalTime: state.item.arrivalTime ?? '',
                    latitude: state.item.latitude,
                    longitude: state.item.longitude,
                  }
                : undefined
            }
            onSubmit={(values) => (state.mode === 'edit' ? onEditLocation(state.item.id, values) : onAddLocation(values))}
          />
        )}
        {kind === 'note' && (
          <NoteForm
            submitLabel={submitLabel}
            draftKind={draftKind}
            defaultValues={
              state.mode === 'edit'
                ? {
                    title: state.item.name,
                    description: state.item.description ?? '',
                    departureTime: state.item.departureTime ?? '',
                    arrivalTime: state.item.arrivalTime ?? '',
                  }
                : undefined
            }
            onSubmit={(values) => (state.mode === 'edit' ? onEditNote(state.item.id, values) : onAddNote(values))}
          />
        )}
        {kind === 'transport' && (
          <TransportForm
            submitLabel={submitLabel}
            draftKind={draftKind}
            defaultValues={
              state.mode === 'edit'
                ? {
                    transportType: state.item.transportType ?? 'plane',
                    departureTime: state.item.departureTime ?? '',
                    arrivalTime: state.item.arrivalTime ?? '',
                    price: state.item.price,
                    description: state.item.description ?? '',
                  }
                : undefined
            }
            onSubmit={(values) => (state.mode === 'edit' ? onEditTransport(state.item.id, values) : onAddTransport(values))}
          />
        )}
        {kind === 'lodging' && (
          <LodgingForm
            submitLabel={submitLabel}
            draftKind={draftKind}
            defaultValues={
              state.mode === 'edit'
                ? {
                    name: state.item.name,
                    description: state.item.description ?? '',
                    checkInTime: state.item.checkInTime ?? '',
                    checkOutTime: state.item.checkOutTime ?? '',
                  }
                : undefined
            }
            onSubmit={(values) => (state.mode === 'edit' ? onEditLodging(state.item.id, values) : onAddLodging(values))}
          />
        )}
      </div>
    </div>
  )
}
