import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, ChevronUp, Info, Loader2, MapPin, PlusCircle, Search, UploadCloud, X } from 'lucide-react'
import { useLocations } from '../context/LocationContext'
import { geocodeSearch } from '../api/geocode'
import { searchPexelsPhotos, type PexelsPhoto } from '../api/pexels'
import { uploadImage, CloudinaryUploadError } from '../api/cloudinary'
import { ApiError } from '../api/client'
import type { Location, NominatimResult } from '../types/location'
import { LocationFormSchema, type LocationFormValues } from '../types/location'
import type { ToastType } from './Toast'
import { StarRatingInput } from './StarRatingInput'
import { LocationImage } from './LocationImage'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

interface AddLocationPopupProps {
  onClose: () => void
  pushToast: (type: ToastType, message: string) => void
  location?: Location
}

export function AddLocationPopup({ onClose, pushToast, location }: AddLocationPopupProps) {
  const { addLocation, editLocation } = useLocations()
  const isEditing = Boolean(location)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(LocationFormSchema),
    defaultValues: location
      ? {
          name: location.name,
          country: location.country,
          category: location.category,
          priority: location.priority,
          latitude: location.latitude,
          longitude: location.longitude,
          notes: location.notes ?? '',
          imageUrl: location.imageUrl ?? '',
        }
      : { name: '', country: '', category: '', priority: 0, latitude: 0, longitude: 0, notes: '', imageUrl: '' },
  })
  const { field: priorityField } = useController({ name: 'priority', control })
  const { field: imageUrlField } = useController({ name: 'imageUrl', control })

  const [isFetchingPhotos, setIsFetchingPhotos] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)
  const [pendingValues, setPendingValues] = useState<LocationFormValues | null>(null)

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [isUrlInputExpanded, setIsUrlInputExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return
    setIsUploadingImage(true)
    try {
      const url = await uploadImage(file)
      imageUrlField.onChange(url)
    } catch (err) {
      pushToast('error', err instanceof CloudinaryUploadError ? err.message : 'Could not upload that image.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleImageFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingImage(false)
    void handleImageFile(e.dataTransfer.files?.[0])
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const found = await geocodeSearch(query)
        setResults(found)
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Geocoding lookup failed')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelectResult = (result: NominatimResult) => {
    const shortName = result.display_name.split(',')[0]
    setValue('name', shortName, { shouldValidate: true })
    setValue('country', result.address?.country ?? result.display_name.split(',').pop()?.trim() ?? '', {
      shouldValidate: true,
    })
    setValue('latitude', Number(result.lat), { shouldValidate: true })
    setValue('longitude', Number(result.lon), { shouldValidate: true })
    setResults([])
    setQuery(shortName)
  }

  const saveLocation = async (values: LocationFormValues, imageUrl: string | undefined) => {
    setIsSaving(true)
    try {
      if (location) {
        await editLocation(location.id, { ...values, imageUrl })
        pushToast('success', `${values.name} updated.`)
      } else {
        await addLocation({ ...values, imageUrl })
        pushToast('success', `${values.name} added to your bucket list.`)
      }
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      pushToast('error', err instanceof Error ? err.message : 'Could not save that location.')
    } finally {
      setIsSaving(false)
    }
  }

  const onSubmit = async (values: LocationFormValues) => {
    if (values.imageUrl) {
      await saveLocation(values, values.imageUrl)
      return
    }

    setIsFetchingPhotos(true)
    const found = await searchPexelsPhotos(`${values.name} ${values.country}`)
    setIsFetchingPhotos(false)

    if (found.length === 0) {
      await saveLocation(values, undefined)
      return
    }

    setPhotos(found)
    setSelectedPhotoUrl(null)
    setPendingValues(values)
  }

  const handleSaveWithImage = () => {
    if (!pendingValues || !selectedPhotoUrl) return
    void saveLocation(pendingValues, selectedPhotoUrl)
  }

  const handleContinueWithoutImage = () => {
    if (!pendingValues) return
    void saveLocation(pendingValues, undefined)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-mist-light p-6 dark:bg-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink dark:text-mist-light">
              {pendingValues ? 'Would you like to choose an image?' : isEditing ? 'Edit bucket list location' : 'Add a bucket list location'}
            </h2>
            <p className="mt-1 text-sm text-ink/60 dark:text-mist-light/60">
              {pendingValues
                ? `We found some photos of ${pendingValues.name} on Pexels — pick one, or continue without an image.`
                : isEditing
                  ? 'Update this location’s details below.'
                  : 'Search a place to auto-fill its details, or enter coordinates manually.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-ink/50 hover:text-ink dark:text-mist-light/50 dark:hover:text-mist-light"
          >
            <X size={20} />
          </button>
        </div>

        {pendingValues ? (
          <div className="flex flex-col gap-4">
            <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
              {photos.map((photo) => {
                const isSelected = selectedPhotoUrl === photo.url
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedPhotoUrl(photo.url)}
                    aria-pressed={isSelected}
                    aria-label={photo.alt}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                      isSelected ? 'border-harbor' : 'border-transparent hover:border-harbor/40'
                    }`}
                  >
                    <img src={photo.url} alt={photo.alt} className="h-full w-full object-cover" />
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-harbor/40">
                        <Check size={20} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleContinueWithoutImage}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 rounded-full bg-black/10 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-black/15 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-mist-light dark:hover:bg-white/15"
              >
                Continue without an image
              </button>
              <button
                type="button"
                onClick={handleSaveWithImage}
                disabled={isSaving || !selectedPhotoUrl}
                className="flex items-center justify-center gap-2 rounded-full bg-harbor px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                Save location
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-black/10 p-3 dark:border-white/10">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-mist-light/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a city, landmark, or country…"
                  className={`${inputClass} pl-9`}
                />
                {isSearching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink/40 dark:text-mist-light/40" />
                )}
              </label>

              {searchError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{searchError}</p>}

              {results.length > 0 && (
                <ul className="mt-2 max-h-56 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10 dark:divide-white/5 dark:border-white/10">
                  {results.map((result, idx) => (
                    <li key={`${result.lat}-${result.lon}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectResult(result)}
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

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" error={errors.name?.message}>
                  <input type="text" {...register('name')} className={inputClass} />
                </Field>
                <Field label="Country" error={errors.country?.message}>
                  <input type="text" {...register('country')} className={inputClass} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Category" error={errors.category?.message}>
                  <input type="text" placeholder="e.g. Culture, Food, Nature" {...register('category')} className={inputClass} />
                </Field>
                <Field label="Priority" error={errors.priority?.message}>
                  <StarRatingInput value={priorityField.value} onChange={priorityField.onChange} className="h-[38px]" />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Latitude" error={errors.latitude?.message}>
                  <input type="number" step="any" {...register('latitude', { valueAsNumber: true })} className={inputClass} />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <input type="number" step="any" {...register('longitude', { valueAsNumber: true })} className={inputClass} />
                </Field>
              </div>

              <Field label="Photo (optional)" error={errors.imageUrl?.message}>
                {imageUrlField.value ? (
                  <div className="relative">
                    <LocationImage
                      src={imageUrlField.value}
                      alt="Selected location photo"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => imageUrlField.onChange('')}
                      aria-label="Remove photo"
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingImage(true)
                    }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={handleImageDrop}
                    className={`flex h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors ${
                      isDraggingImage
                        ? 'border-harbor bg-harbor/10'
                        : 'border-black/15 hover:border-harbor/40 dark:border-white/15 dark:hover:border-harbor/40'
                    }`}
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 size={20} className="animate-spin text-harbor" />
                        <span className="text-xs text-ink/50 dark:text-mist-light/50">Uploading…</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={20} className="text-ink/40 dark:text-mist-light/40" />
                        <span className="text-xs text-ink/60 dark:text-mist-light/60">
                          Click to upload or drag and drop
                        </span>
                        <span className="text-[11px] text-ink/40 dark:text-mist-light/40">PNG or JPG, up to 25MB</span>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </div>
                )}

                {!imageUrlField.value && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setIsUrlInputExpanded((prev) => !prev)}
                      aria-expanded={isUrlInputExpanded}
                      className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline"
                    >
                      {isUrlInputExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Or paste an image URL
                    </button>
                    {isUrlInputExpanded && (
                      <input
                        type="text"
                        placeholder="https://example.com/photo.jpg"
                        value={imageUrlField.value}
                        onChange={(e) => imageUrlField.onChange(e.target.value)}
                        className={`${inputClass} mt-2`}
                      />
                    )}
                  </div>
                )}

                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-ink/50 dark:text-mist-light/50">
                  <Info size={13} className="mt-[1px] shrink-0" />
                  Leave this blank and we’ll suggest photos from Pexels — use the location’s real name (not a made-up
                  one) for the best matches.
                </p>
              </Field>

              <Field label="Notes (optional)" error={errors.notes?.message}>
                <textarea rows={3} {...register('notes')} className={inputClass} />
              </Field>

              <button
                type="submit"
                disabled={isSubmitting || isFetchingPhotos}
                className="mt-2 flex items-center justify-center gap-2 self-start rounded-full bg-harbor px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting || isFetchingPhotos ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isEditing ? (
                  <Check size={16} />
                ) : (
                  <PlusCircle size={16} />
                )}
                {isEditing ? 'Save changes' : 'Add to bucket list'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}
