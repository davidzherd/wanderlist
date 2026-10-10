import { useEffect, useId, useRef, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bus, Car, CarTaxiFront, ChevronDown, Loader2, MapPin, Plane, Search, TrainFront, UploadCloud, X, type LucideIcon } from 'lucide-react'
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
import { uploadImage } from '../api/cloudinary'
import { TOOL_DEFS } from './TripToolsBar'
import { TimeInput } from './TimeInput'
import { DateRangePicker } from './DateRangePicker'
import { PriceCurrencyField } from './PriceCurrencyField'
import { StyledSelect } from './StyledSelect'
import { withToolDraft, useToolDraftPersistence, clearToolDraft } from './tripToolDraft'
import { useIsMobile } from '../hooks/useIsMobile'
import { BottomSheet, SheetPicker } from './BottomSheet'

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
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || isMobile) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, isMobile])

  const selected = TRANSPORT_TYPE_OPTIONS.find((opt) => opt.value === value) ?? TRANSPORT_TYPE_OPTIONS[0]
  const SelectedIcon = selected.icon

  // Popover body, shared by the desktop dropdown and the mobile BottomSheet.
  const panel = (
    <>
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
    </>
  )

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
      {isOpen && !isMobile && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-mist-light shadow-lg dark:border-white/10 dark:bg-ink"
        >
          {panel}
        </ul>
      )}
      {isMobile && (
        <SheetPicker open={isOpen} onOpenChange={setIsOpen} title={'Transport type'}>
          <ul role="listbox" aria-label="Transport type" className="px-3 py-2 [&_button]:rounded-xl [&_button]:py-3">{panel}</ul>
        </SheetPicker>
      )}
    </div>
  )
}

function LocationForm({
  onSubmit,
  defaultValues,
  submitLabel,
  draftKind,
  tripCurrency,
  enableSearch = false,
}: {
  onSubmit: (values: LocationItemFormValues) => void
  defaultValues?: Partial<LocationItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
  tripCurrency: string
  /** Show the geocode search that autofills name/country/coordinates from a picked place. */
  enableSearch?: boolean
}) {
  const form = useForm<LocationItemFormValues>({
    resolver: zodResolver(LocationItemFormSchema),
    defaultValues: withToolDraft<LocationItemFormValues>(draftKind, { name: '', country: '', description: '', imageUrl: '', departureTime: '', arrivalTime: '', latitude: undefined, longitude: undefined, price: undefined, currency: '', ...defaultValues }),
  })
  const { field: departureTimeField } = useController({ name: 'departureTime', control: form.control })
  const { field: imageUrlField } = useController({ name: 'imageUrl', control: form.control })
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    setIsUploadingPhoto(true)
    try {
      imageUrlField.onChange(await uploadImage(file))
    } catch {
      setPhotoError("Couldn't upload that photo. Try another one.")
    } finally {
      setIsUploadingPhoto(false)
    }
  }
  const { field: arrivalTimeField } = useController({ name: 'arrivalTime', control: form.control })
  const { field: currencyField } = useController({ name: 'currency', control: form.control })
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
            <span className={labelClass}>Find a place</span>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-mist-light/40" />
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
          <span className={labelClass}>
            Name <span className="text-harbor" aria-hidden="true">*</span>
          </span>
          <input type="text" placeholder="e.g. Grandma's cabin" required {...form.register('name')} className={inputClass} />
        </label>
        {form.formState.errors.name && <p className={errorClass}>{form.formState.errors.name.message}</p>}
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Country</span>
          <input type="text" {...form.register('country')} className={inputClass} />
        </label>
      </div>
      {/* Coordinates come from the place search; only power users need to touch them, so they live behind "Advanced"
          (opened automatically if they fail validation). */}
      <details
        open={Boolean(form.formState.errors.latitude || form.formState.errors.longitude) || undefined}
        className="group rounded-lg border border-black/10 px-3 py-2 dark:border-white/10"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink/60 dark:text-mist-light/60">
          <span>Advanced: map pin coordinates</span>
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block">
              <span className={labelClass}>Latitude</span>
              <input type="number" step="any" placeholder="e.g. 48.8584" {...form.register('latitude')} className={inputClass} />
            </label>
            {form.formState.errors.latitude && <p className={errorClass}>{form.formState.errors.latitude.message}</p>}
          </div>
          <div>
            <label className="block">
              <span className={labelClass}>Longitude</span>
              <input type="number" step="any" placeholder="e.g. 2.2945" {...form.register('longitude')} className={inputClass} />
            </label>
            {form.formState.errors.longitude && <p className={errorClass}>{form.formState.errors.longitude.message}</p>}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ink/50 dark:text-mist-light/50">
          Filled in when you pick a place above. Used for travel estimates and the route map.
        </p>
      </details>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <TimeField label="Start time (optional)" sheetTitle="Start time" value={departureTimeField.value} onChange={departureTimeField.onChange} />
        </div>
        <div>
          <TimeField label="End time (optional)" sheetTitle="End time" value={arrivalTimeField.value} onChange={arrivalTimeField.onChange} />
        </div>
      </div>
      <PriceCurrencyField
        priceRegister={form.register('price')}
        currencyValue={currencyField.value}
        onCurrencyChange={currencyField.onChange}
        tripCurrency={tripCurrency}
        error={form.formState.errors.price?.message}
      />
      <div>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea rows={3} placeholder="Add details…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <div>
        <span className={labelClass}>Photo</span>
        {imageUrlField.value ? (
          <div className="relative h-28 overflow-hidden rounded-xl">
            <img src={imageUrlField.value} alt="Stop photo" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => imageUrlField.onChange('')}
              aria-label="Remove photo"
              title="Remove photo"
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="flex h-16 w-full items-center gap-3 rounded-xl border-2 border-dashed border-black/15 px-4 text-left transition-colors hover:border-harbor/40 disabled:cursor-wait dark:border-white/15"
          >
            {isUploadingPhoto ? (
              <Loader2 size={20} className="shrink-0 animate-spin text-harbor" />
            ) : (
              <UploadCloud size={20} className="shrink-0 text-harbor" />
            )}
            <span>
              <span className="block text-sm font-medium text-ink dark:text-mist-light">
                {isUploadingPhoto ? 'Uploading…' : 'Add a photo'}
              </span>
              <span className="block text-xs text-ink/50 dark:text-mist-light/50">Or skip, and we'll find one for you</span>
            </span>
          </button>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handlePhotoFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {(photoError || form.formState.errors.imageUrl) && (
          <p className={errorClass}>{photoError ?? form.formState.errors.imageUrl?.message}</p>
        )}
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
  tripCurrency,
}: {
  onSubmit: (values: NoteItemFormValues) => void
  defaultValues?: Partial<NoteItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
  tripCurrency: string
}) {
  const form = useForm<NoteItemFormValues>({
    resolver: zodResolver(NoteItemFormSchema),
    defaultValues: withToolDraft<NoteItemFormValues>(draftKind, { title: '', description: '', departureTime: '', arrivalTime: '', price: undefined, currency: '', ...defaultValues }),
  })
  const { field: departureTimeField } = useController({ name: 'departureTime', control: form.control })
  const { field: arrivalTimeField } = useController({ name: 'arrivalTime', control: form.control })
  const { field: currencyField } = useController({ name: 'currency', control: form.control })
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
          <TimeField label="Start time (optional)" sheetTitle="Start time" value={departureTimeField.value} onChange={departureTimeField.onChange} />
        </div>
        <div>
          <TimeField label="End time (optional)" sheetTitle="End time" value={arrivalTimeField.value} onChange={arrivalTimeField.onChange} />
        </div>
      </div>
      <PriceCurrencyField
        priceRegister={form.register('price')}
        currencyValue={currencyField.value}
        onCurrencyChange={currencyField.onChange}
        tripCurrency={tripCurrency}
        error={form.formState.errors.price?.message}
      />
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
  tripCurrency,
}: {
  onSubmit: (values: TransportItemFormValues) => void
  defaultValues?: Partial<TransportItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
  tripCurrency: string
}) {
  const form = useForm<TransportItemFormValues>({
    resolver: zodResolver(TransportItemFormSchema),
    defaultValues: withToolDraft<TransportItemFormValues>(draftKind, { transportType: 'plane', departureTime: '', arrivalTime: '', price: undefined, currency: '', description: '', ...defaultValues }),
  })
  const { field: transportTypeField } = useController({ name: 'transportType', control: form.control })
  const { field: departureTimeField } = useController({ name: 'departureTime', control: form.control })
  const { field: arrivalTimeField } = useController({ name: 'arrivalTime', control: form.control })
  const { field: currencyField } = useController({ name: 'currency', control: form.control })
  const showPrice = transportTypeField.value !== 'car'
  useToolDraftPersistence(draftKind, form.watch)

  // "Car" is your own vehicle — no ticket price — so drop both price and its currency on submit.
  const handleSubmit = form.handleSubmit((values) =>
    onSubmit(values.transportType === 'car' ? { ...values, price: undefined, currency: undefined } : values),
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Transport type</label>
        <TransportTypeSelect value={transportTypeField.value} onChange={transportTypeField.onChange} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <TimeField label="Start time (optional)" sheetTitle="Start time" value={departureTimeField.value} onChange={departureTimeField.onChange} />
        </div>
        <div>
          <TimeField label="End time (optional)" sheetTitle="End time" value={arrivalTimeField.value} onChange={arrivalTimeField.onChange} />
        </div>
      </div>
      {showPrice && (
        <PriceCurrencyField
          priceRegister={form.register('price')}
          currencyValue={currencyField.value}
          onCurrencyChange={currencyField.onChange}
          tripCurrency={tripCurrency}
          error={form.formState.errors.price?.message}
        />
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
  tripCurrency,
}: {
  onSubmit: (values: LodgingItemFormValues) => void
  defaultValues?: Partial<LodgingItemFormValues>
  submitLabel: string
  draftKind?: TripItemKind
  tripCurrency: string
}) {
  const form = useForm<LodgingItemFormValues>({
    resolver: zodResolver(LodgingItemFormSchema),
    defaultValues: withToolDraft<LodgingItemFormValues>(draftKind, { name: '', description: '', checkInDate: '', checkOutDate: '', checkInTime: '', checkOutTime: '', price: undefined, currency: '', ...defaultValues }),
  })
  const { field: checkInTimeField } = useController({ name: 'checkInTime', control: form.control })
  const { field: checkOutTimeField } = useController({ name: 'checkOutTime', control: form.control })
  const { field: currencyField } = useController({ name: 'currency', control: form.control })
  const checkInDate = form.watch('checkInDate')
  const checkOutDate = form.watch('checkOutDate')
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
      <div>
        <span className={labelClass}>Stay dates (optional)</span>
        {/* Reuses the trip's range calendar: pick check-in, then check-out. */}
        <DateRangePicker
          startDate={checkInDate || undefined}
          endDate={checkOutDate || undefined}
          placeholder="Add stay dates"
          sheetTitle="Stay dates"
          onChange={(start, end) => {
            form.setValue('checkInDate', start ?? '', { shouldValidate: true, shouldDirty: true })
            form.setValue('checkOutDate', end ?? '', { shouldValidate: true, shouldDirty: true })
          }}
        />
        {form.formState.errors.checkOutDate && <p className={errorClass}>{form.formState.errors.checkOutDate.message}</p>}
        <p className="mt-1 text-[11px] text-ink/50 dark:text-mist-light/50">
          Set both dates and your itinerary marks each day you start and finish at this stay.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <TimeField label="Check-in time (optional)" sheetTitle="Check-in time" value={checkInTimeField.value} onChange={checkInTimeField.onChange} />
          {form.formState.errors.checkInTime && <p className={errorClass}>{form.formState.errors.checkInTime.message}</p>}
        </div>
        <div>
          <TimeField label="Check-out time (optional)" sheetTitle="Check-out time" value={checkOutTimeField.value} onChange={checkOutTimeField.onChange} />
          {form.formState.errors.checkOutTime && (
            <p className={errorClass}>{form.formState.errors.checkOutTime.message}</p>
          )}
        </div>
      </div>
      <PriceCurrencyField
        priceRegister={form.register('price')}
        currencyValue={currencyField.value}
        onCurrencyChange={currencyField.onChange}
        tripCurrency={tripCurrency}
        error={form.formState.errors.price?.message}
      />
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
  /** The trip's default currency, used as the fallback in each form's price/currency field. */
  tripCurrency: string
  onClose: () => void
  onAddNote: (values: NoteItemFormValues, dayId?: string) => void
  onAddTransport: (values: TransportItemFormValues, dayId?: string) => void
  onAddLodging: (values: LodgingItemFormValues) => void
  onAddLocation: (values: LocationItemFormValues, dayId?: string) => void
  /** Add mode: the trip's days for the "Day" select (lodging is date-driven, so it has no day select). */
  days?: { id: string; label: string }[]
  /** Add mode: preselected day — the day on screen when the tool was opened ('' = Unscheduled). */
  defaultDayId?: string
  onEditNote: (itemId: string, values: NoteItemFormValues) => void
  onEditTransport: (itemId: string, values: TransportItemFormValues) => void
  onEditLodging: (itemId: string, values: LodgingItemFormValues) => void
  onEditLocation: (itemId: string, values: LocationItemFormValues) => void
}

export function TripToolPopup({
  state,
  tripCurrency,
  onClose,
  onAddNote,
  onAddTransport,
  onAddLodging,
  onAddLocation,
  onEditNote,
  onEditTransport,
  onEditLodging,
  onEditLocation,
  days = [],
  defaultDayId = '',
}: TripToolPopupProps) {
  const isMobile = useIsMobile()
  const kind = state.mode === 'add' ? state.kind : state.item.kind
  const [dayId, setDayId] = useState(defaultDayId)
  const showDaySelect = state.mode === 'add' && kind !== 'lodging' && days.length > 0
  const targetDay = dayId || undefined
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

  const title = isEditing ? `Edit ${tool.label.toLowerCase()}` : tool.label

  const forms = (
    <>
      {/* Which day the new item lands on — defaults to the day you were looking at, instead of always Unscheduled. */}
      {showDaySelect && (
        <div className="mb-3">
          <span className={labelClass}>Day</span>
          <StyledSelect
            value={dayId}
            onChange={setDayId}
            ariaLabel="Day"
            options={[{ value: '', label: 'Unscheduled' }, ...days.map((d) => ({ value: d.id, label: d.label }))]}
          />
        </div>
      )}
    {kind === 'location' && (
      <LocationForm
        submitLabel={submitLabel}
        draftKind={draftKind}
        tripCurrency={tripCurrency}
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
                price: state.item.price,
                currency: state.item.currency ?? '',
              }
            : undefined
        }
        onSubmit={(values) => (state.mode === 'edit' ? onEditLocation(state.item.id, values) : onAddLocation(values, targetDay))}
      />
    )}
    {kind === 'note' && (
      <NoteForm
        submitLabel={submitLabel}
        draftKind={draftKind}
        tripCurrency={tripCurrency}
        defaultValues={
          state.mode === 'edit'
            ? {
                title: state.item.name,
                description: state.item.description ?? '',
                departureTime: state.item.departureTime ?? '',
                arrivalTime: state.item.arrivalTime ?? '',
                price: state.item.price,
                currency: state.item.currency ?? '',
              }
            : undefined
        }
        onSubmit={(values) => (state.mode === 'edit' ? onEditNote(state.item.id, values) : onAddNote(values, targetDay))}
      />
    )}
    {kind === 'transport' && (
      <TransportForm
        submitLabel={submitLabel}
        draftKind={draftKind}
        tripCurrency={tripCurrency}
        defaultValues={
          state.mode === 'edit'
            ? {
                transportType: state.item.transportType ?? 'plane',
                departureTime: state.item.departureTime ?? '',
                arrivalTime: state.item.arrivalTime ?? '',
                price: state.item.price,
                currency: state.item.currency ?? '',
                description: state.item.description ?? '',
              }
            : undefined
        }
        onSubmit={(values) => (state.mode === 'edit' ? onEditTransport(state.item.id, values) : onAddTransport(values, targetDay))}
      />
    )}
    {kind === 'lodging' && (
      <LodgingForm
        submitLabel={submitLabel}
        draftKind={draftKind}
        tripCurrency={tripCurrency}
        defaultValues={
          state.mode === 'edit'
            ? {
                name: state.item.name,
                description: state.item.description ?? '',
                checkInDate: state.item.checkInDate ?? '',
                checkOutDate: state.item.checkOutDate ?? '',
                checkInTime: state.item.checkInTime ?? '',
                checkOutTime: state.item.checkOutTime ?? '',
                price: state.item.price,
                currency: state.item.currency ?? '',
              }
            : undefined
        }
        onSubmit={(values) => (state.mode === 'edit' ? onEditLodging(state.item.id, values) : onAddLodging(values))}
      />
    )}
    </>
  )

  // Phones: the same form in the shared BottomSheet. handleOnly so a stray swipe on the form can't discard input;
  // closing it (handle, backdrop, back) is an explicit close, like the X on desktop.
  if (isMobile) {
    return (
      <BottomSheet open onOpenChange={(open) => !open && handleClose()} title={title} handleOnly>
        <div className="trip-scroll overflow-y-auto px-5 pb-5 pt-3">{forms}</div>
      </BottomSheet>
    )
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
            {title}
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

        {forms}
      </div>
    </div>
  )
}

// Not a <label>: the time picker's trigger is a button, and wrapping it in a label would forward clicks
// on the label text to it and replace its accessible name.
function TimeField({ label, sheetTitle, value, onChange }: { label: string; sheetTitle?: string; value?: string; onChange: (value: string) => void }) {
  const labelId = useId()
  return (
    <div>
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <TimeInput value={value} onChange={onChange} labelledBy={labelId} sheetTitle={sheetTitle} />
    </div>
  )
}
