import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type ReactNode } from 'react'
import { useController, useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BookMarked, Check, ChevronDown, ChevronUp, ClipboardPaste, Info, Loader2, MapPin, Plus, PlusCircle, Search, UploadCloud, X } from 'lucide-react'
import { useLocations } from '../context/LocationContext'
import { useAuth } from '../context/AuthContext'
import { geocodeSearch } from '../api/geocode'
import { searchPexelsPhotos, type PexelsPhoto } from '../api/pexels'
import { uploadImage, CloudinaryUploadError } from '../api/cloudinary'
import { ApiError } from '../api/client'
import type { Location, NominatimResult } from '../types/location'
import {
  LocationFormSchema,
  FREE_MAX_LOCATION_IMAGES,
  PREMIUM_MAX_LOCATION_IMAGES,
  type LocationFormValues,
} from '../types/location'
import type { ToastType } from './Toast'
import { StarRatingInput } from './StarRatingInput'
import { LocationImage } from './LocationImage'
import { PIN_COLORS, TRAVEL_EMOJIS, TRAVEL_ICONS, TRAVEL_ICON_MAP, DEFAULT_PIN_COLOR, getPinContrastColor } from './pinStyle'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

// Shared glass surface for the popup — mostly-white in light mode, #333 in dark, with a blur + hairline
// border so it reads as frosted glass rather than a flat card.
const glassPanel =
  'relative border border-white/60 bg-white/60 shadow-glass backdrop-blur-2xl dark:border-white/10 dark:bg-[#333]/65'

// The collapsible sections, in display order. The image column is deliberately NOT one of these —
// it's always visible on the left.
type SectionId = 'name' | 'description' | 'coords' | 'pin'
const SECTION_ORDER: SectionId[] = ['name', 'description', 'coords', 'pin']

// Which section each form field lives in, so a validation error can pop the right section open.
const FIELD_SECTION: Record<string, SectionId> = {
  name: 'name',
  country: 'name',
  category: 'description',
  priority: 'description',
  notes: 'description',
  latitude: 'coords',
  longitude: 'coords',
  color: 'pin',
  emoji: 'pin',
  icon: 'pin',
}

// A fixed bar pattern (thicknesses in px) for the decorative boarding-pass barcode — stable across
// renders so it doesn't shimmer.
const BARCODE_BARS = [3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 1, 3, 2, 1, 4, 1, 2, 1, 3, 1, 2, 4, 1]

// Persist the in-progress add-location form to localStorage so an interruption that unmounts the
// popup without an explicit close — most importantly an unexpected session expiry that redirects to
// /auth — doesn't silently discard everything the user typed. Only the add flow is persisted; edits
// start from the existing location. Cleared on a successful save or an explicit close.
const DRAFT_KEY = 'wanderlist:add-location-draft'

const EMPTY_FORM_DEFAULTS: LocationFormValues = {
  name: '',
  country: '',
  category: '',
  priority: 0,
  latitude: 0,
  longitude: 0,
  notes: '',
  images: [],
  color: DEFAULT_PIN_COLOR,
  emoji: '',
  icon: '',
}

function loadDraft(): Partial<LocationFormValues> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<LocationFormValues>) : null
  } catch {
    return null
  }
}

// Whether a saved draft actually holds anything worth restoring — a bare all-defaults blob (from
// merely opening then closing the form once) shouldn't trigger a "restored" toast.
function draftHasContent(draft: Partial<LocationFormValues> | null): boolean {
  return Boolean(draft && (draft.name || draft.country || draft.category || draft.notes || (draft.images && draft.images.length > 0)))
}

interface AddLocationPopupProps {
  onClose: () => void
  pushToast: (type: ToastType, message: string) => void
  location?: Location
  /** Add-mode only: seed the form (e.g. from a Wikivoyage suggestion). Overrides any saved draft. */
  prefill?: Partial<LocationFormValues>
}

export function AddLocationPopup({ onClose, pushToast, location, prefill }: AddLocationPopupProps) {
  const { addLocation, editLocation } = useLocations()
  const { user } = useAuth()
  // Premium users can attach more photos per location than free users.
  const maxImages = user?.isPremium ? PREMIUM_MAX_LOCATION_IMAGES : FREE_MAX_LOCATION_IMAGES
  const isEditing = Boolean(location)

  // Accordion: exactly one section open at a time (or none). Starts on "Location name".
  const [openSection, setOpenSection] = useState<SectionId | null>('name')
  const toggleSection = (id: SectionId) => setOpenSection((prev) => (prev === id ? null : id))

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // In add mode, seed from any persisted draft (merged over the empty defaults so a partial/stale
  // draft can't leave a field undefined); in edit mode always start from the existing location. A
  // prefill (e.g. a suggestion) takes precedence and skips the draft entirely — the user asked for
  // this specific place, not their last unrelated in-progress entry.
  const [restoredDraft] = useState(() => (isEditing || prefill ? null : loadDraft()))

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
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
          images: location.images ?? [],
          color: location.color ?? DEFAULT_PIN_COLOR,
          emoji: location.emoji ?? '',
          icon: location.icon ?? '',
        }
      : { ...EMPTY_FORM_DEFAULTS, ...(restoredDraft ?? {}), ...(prefill ?? {}) },
  })

  const clearDraft = () => {
    if (isEditing) return
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore — draft persistence is best-effort */
    }
  }

  // An explicit close is an intentional discard, so drop the saved draft too. (An unexpected
  // unmount, e.g. a session-expiry redirect, never runs this — which is exactly why the draft survives.)
  const handleClose = () => {
    clearDraft()
    onClose()
  }

  // Mirror every keystroke into localStorage (add mode only). watch()'s identity is stable, so this
  // subscribes once for the life of the popup.
  useEffect(() => {
    if (isEditing) return
    const subscription = watch((values) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
      } catch {
        /* ignore — quota/private-mode failures shouldn't break the form */
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, isEditing])

  // Let the user know their previous work came back, once, on open.
  useEffect(() => {
    if (draftHasContent(restoredDraft)) pushToast('info', 'Restored your unsaved draft.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { field: priorityField } = useController({ name: 'priority', control })
  const { field: imagesField } = useController({ name: 'images', control })
  const { field: colorField } = useController({ name: 'color', control })
  const { field: emojiField } = useController({ name: 'emoji', control })
  const { field: iconField } = useController({ name: 'icon', control })

  const [isFetchingPhotos, setIsFetchingPhotos] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([])
  const [pendingValues, setPendingValues] = useState<LocationFormValues | null>(null)

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [isUrlInputExpanded, setIsUrlInputExpanded] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')

  const images = imagesField.value ?? []
  const canAddMoreImages = images.length < maxImages

  // Append new photo URLs, de-duping and never exceeding the max. Anything over the cap is dropped.
  const addImages = (urls: string[]) => {
    imagesField.onChange(
      [...images, ...urls.filter((url) => url && !images.includes(url))].slice(0, maxImages),
    )
  }

  const removeImageAt = (index: number) => {
    imagesField.onChange(images.filter((_, i) => i !== index))
  }

  // Promote a photo to cover (element 0) by moving it to the front; the rest keep their order.
  const makeCover = (index: number) => {
    if (index <= 0 || index >= images.length) return
    imagesField.onChange([images[index], ...images.filter((_, i) => i !== index)])
  }

  const handleAddUrl = () => {
    const url = urlDraft.trim()
    if (!url) return
    try {
      new URL(url)
    } catch {
      pushToast('error', 'That doesn’t look like a valid image URL.')
      return
    }
    addImages([url])
    setUrlDraft('')
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Uploads one or more files to Cloudinary and appends each resulting URL to the images array.
  // Uploads run sequentially; a single failure is toasted but doesn't abort the rest.
  const handleImageFiles = async (files: File[] | undefined) => {
    if (!files || files.length === 0) return
    const room = maxImages - images.length
    if (room <= 0) {
      pushToast('error', `You can add up to ${maxImages} images.`)
      return
    }
    setIsUploadingImage(true)
    try {
      for (const file of files.slice(0, room)) {
        try {
          const url = await uploadImage(file)
          addImages([url])
        } catch (err) {
          pushToast('error', err instanceof CloudinaryUploadError ? err.message : 'Could not upload that image.')
        }
      }
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleImageFiles(e.target.files ? Array.from(e.target.files) : undefined)
    e.target.value = ''
  }

  const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingImage(false)
    void handleImageFiles(e.dataTransfer.files ? Array.from(e.dataTransfer.files) : undefined)
  }

  // Ctrl/⌘+V while the dropzone is focused: grab the first image off the clipboard.
  const handleImagePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(e.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile()
    if (file) {
      e.preventDefault()
      void handleImageFiles([file])
    }
  }

  // Explicit "Paste from clipboard" button — reads the clipboard directly (needs the async
  // Clipboard API + a user gesture, which the click provides). Fails closed with a toast if the
  // browser blocks it or the clipboard holds no image.
  const handlePasteButton = async () => {
    if (!navigator.clipboard?.read) {
      pushToast('error', 'Your browser doesn’t support pasting from the clipboard here.')
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const ext = blob.type.split('/')[1] || 'png'
          await handleImageFiles([new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type })])
          return
        }
      }
      pushToast('error', 'No image found in your clipboard. Copy an image, then try again.')
    } catch {
      pushToast('error', 'Couldn’t read your clipboard. Check browser permissions and try again.')
    }
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

  const saveLocation = async (values: LocationFormValues) => {
    setIsSaving(true)
    try {
      if (location) {
        await editLocation(location.id, values)
        pushToast('success', `${values.name} updated.`)
      } else {
        await addLocation(values)
        pushToast('success', `${values.name} added to your bucket list.`)
      }
      clearDraft()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      pushToast('error', err instanceof Error ? err.message : 'Could not save that location.')
    } finally {
      setIsSaving(false)
    }
  }

  const onSubmit = async (values: LocationFormValues) => {
    if (values.images.length > 0) {
      await saveLocation(values)
      return
    }

    setIsFetchingPhotos(true)
    const found = await searchPexelsPhotos(`${values.name} ${values.country}`)
    setIsFetchingPhotos(false)

    if (found.length === 0) {
      await saveLocation(values)
      return
    }

    setPhotos(found)
    setSelectedPhotoUrls([])
    setPendingValues(values)
  }

  // A collapsed section can hide a field that failed validation — open the first offending one so
  // the error is actually visible.
  const onInvalid = (formErrors: FieldErrors<LocationFormValues>) => {
    const first = SECTION_ORDER.find((section) =>
      Object.keys(formErrors).some((field) => FIELD_SECTION[field] === section),
    )
    if (first) setOpenSection(first)
  }

  const togglePexelsPhoto = (url: string) => {
    setSelectedPhotoUrls((prev) =>
      prev.includes(url)
        ? prev.filter((u) => u !== url)
        : prev.length >= maxImages
          ? prev
          : [...prev, url],
    )
  }

  const handleSaveWithImage = () => {
    if (!pendingValues || selectedPhotoUrls.length === 0) return
    void saveLocation({ ...pendingValues, images: selectedPhotoUrls })
  }

  const handleContinueWithoutImage = () => {
    if (!pendingValues) return
    void saveLocation({ ...pendingValues, images: [] })
  }

  const sectionHasError: Record<SectionId, boolean> = {
    name: Boolean(errors.name || errors.country),
    description: Boolean(errors.category || errors.priority || errors.notes),
    coords: Boolean(errors.latitude || errors.longitude),
    pin: Boolean(errors.color || errors.emoji || errors.icon),
  }

  // ── Pexels picker view ──────────────────────────────────────────────────────────────────────
  if (pendingValues) {
    return (
      <Overlay>
        <div className={`${glassPanel} flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl p-6`}>
          <PopupHeader
            title="Would you like to choose an image?"
            subtitle={`We found some photos of ${pendingValues.name} on Pexels — pick as many as you like, or continue without an image.`}
            onClose={handleClose}
          />
          <div className="mt-4 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
            {photos.map((photo) => {
              const isSelected = selectedPhotoUrls.includes(photo.url)
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => togglePexelsPhoto(photo.url)}
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
          <div className="mt-4 flex items-center gap-3">
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
              disabled={isSaving || selectedPhotoUrls.length === 0}
              className="flex items-center justify-center gap-2 rounded-full bg-harbor px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              {selectedPhotoUrls.length > 1 ? `Save location (${selectedPhotoUrls.length})` : 'Save location'}
            </button>
          </div>
        </div>
      </Overlay>
    )
  }

  // ── Main form view (horizontal boarding-pass layout) ────────────────────────────────────────
  const headerTitle = isEditing ? 'Edit bucket list location' : 'Add a bucket list location'
  const headerSubtitle = isEditing
    ? 'Update this location’s details below.'
    : 'Open a section to fill it in — one at a time.'

  return (
    <Overlay>
      <div
        className={`${glassPanel} flex max-h-[90vh] w-full max-w-4xl flex-col overflow-y-auto rounded-2xl sm:flex-row sm:overflow-hidden`}
      >
        {/* Mobile-only header — the horizontal layout collapses to a column, so the title + close
            need to sit above the photos rather than in the (now second) details column. */}
        <div className="shrink-0 border-b border-black/10 p-5 dark:border-white/10 sm:hidden">
          <PopupHeader title={headerTitle} subtitle={headerSubtitle} onClose={handleClose} />
        </div>

        {/* Left: the location's photos — always visible, profile-style. */}
        <div className="flex w-full shrink-0 flex-col gap-3 border-b border-black/10 p-5 dark:border-white/10 sm:w-[42%] sm:max-w-[320px] sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-mist-light/50">Photos</span>

          {images.length === 0 ? (
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
              onPaste={handleImagePaste}
              className={`flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-colors ${
                isDraggingImage
                  ? 'border-harbor bg-harbor/10'
                  : 'border-black/15 hover:border-harbor/40 dark:border-white/15 dark:hover:border-harbor/40'
              }`}
            >
              {isUploadingImage ? (
                <>
                  <Loader2 size={22} className="animate-spin text-harbor" />
                  <span className="text-xs text-ink/50 dark:text-mist-light/50">Uploading…</span>
                </>
              ) : (
                <>
                  <UploadCloud size={24} className="text-ink/40 dark:text-mist-light/40" />
                  <span className="px-4 text-xs text-ink/60 dark:text-mist-light/60">Click to upload, drag and drop, or paste</span>
                  <span className="text-[11px] text-ink/40 dark:text-mist-light/40">PNG or JPG — add several</span>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Cover photo, large. */}
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl">
                <LocationImage src={images[0]} alt="Cover photo" className="h-full w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">Cover</span>
                <button
                  type="button"
                  onClick={() => removeImageAt(0)}
                  aria-label="Remove cover photo"
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Remaining photos + add tile. */}
              <div className="flex flex-wrap gap-2">
                {images.slice(1).map((url, i) => {
                  const index = i + 1
                  return (
                    <div key={`${url}-${index}`} className="group relative h-16 w-16 shrink-0">
                      <LocationImage src={url} alt={`Location photo ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                      {/* Hover (or keyboard-focus) a non-cover photo to make it the cover. */}
                      <button
                        type="button"
                        onClick={() => makeCover(index)}
                        aria-label={`Set photo ${index + 1} as cover`}
                        title="Set as cover"
                        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-black/55 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                      >
                        <BookMarked size={15} />
                        <span className="text-[8px] font-medium leading-none">Cover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImageAt(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute -right-1.5 -top-1.5 z-[1] rounded-full bg-black/70 p-0.5 text-white transition-colors hover:bg-black/90"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
                {canAddMoreImages && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add another photo"
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-black/15 text-ink/40 transition-colors hover:border-harbor/40 hover:text-harbor dark:border-white/15 dark:text-mist-light/40"
                  >
                    {isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    <span className="text-[9px] font-medium">Add</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* One hidden input drives both the dropzone and the "Add" tile; multiple = batch upload. */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileInputChange} className="hidden" />

          {canAddMoreImages && (
            <div>
              <button
                type="button"
                onClick={() => void handlePasteButton()}
                disabled={isUploadingImage}
                className="mb-2 flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-harbor/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:hover:border-harbor/40"
              >
                <ClipboardPaste size={13} />
                Paste image from clipboard
              </button>
              <button
                type="button"
                onClick={() => setIsUrlInputExpanded((prev) => !prev)}
                aria-expanded={isUrlInputExpanded}
                className="flex items-center gap-1 text-xs font-medium text-harbor hover:underline"
              >
                {isUrlInputExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Or add an image URL
              </button>
              {isUrlInputExpanded && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="https://example.com/photo.jpg"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddUrl()
                      }
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    disabled={!urlDraft.trim()}
                    className="shrink-0 rounded-lg bg-harbor px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {errors.images?.message && <p className="text-xs text-red-600 dark:text-red-400">{errors.images.message}</p>}

          <p className="mt-auto flex items-start gap-1.5 pt-2 text-[11px] text-ink/50 dark:text-mist-light/50">
            <Info size={13} className="mt-[1px] shrink-0" />
            <span>
              Add up to {maxImages} photos — the first is the cover shown in trips and on the map. Leave blank and we’ll
              suggest photos from Pexels.
            </span>
          </p>
        </div>

        {/* Middle: the details, as a single-open accordion. */}
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex min-w-0 flex-1 flex-col">
          <div className="hidden shrink-0 px-5 pt-5 sm:block">
            <PopupHeader title={headerTitle} subtitle={headerSubtitle} onClose={handleClose} />
          </div>

          <div className="flex-1 space-y-2 px-5 pb-4 pt-4 sm:overflow-y-auto">
            <AccordionSection title="Location name" isOpen={openSection === 'name'} onToggle={() => toggleSection('name')} hasError={sectionHasError.name}>
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
                <ul className="mt-2 max-h-48 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10 dark:divide-white/5 dark:border-white/10">
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
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name" error={errors.name?.message}>
                  <input type="text" {...register('name')} className={inputClass} />
                </Field>
                <Field label="Country" error={errors.country?.message}>
                  <input type="text" {...register('country')} className={inputClass} />
                </Field>
              </div>
            </AccordionSection>

            <AccordionSection title="Description" isOpen={openSection === 'description'} onToggle={() => toggleSection('description')} hasError={sectionHasError.description}>
              <div className="space-y-3">
                <Field label="Category" error={errors.category?.message}>
                  <input type="text" placeholder="e.g. Culture, Food, Nature" {...register('category')} className={inputClass} />
                </Field>
                <Field label="Priority" error={errors.priority?.message}>
                  <StarRatingInput value={priorityField.value} onChange={priorityField.onChange} className="h-[38px]" />
                </Field>
                <Field label="Notes (optional)" error={errors.notes?.message}>
                  <textarea rows={3} {...register('notes')} className={inputClass} />
                </Field>
              </div>
            </AccordionSection>

            <AccordionSection title="Location coordinates" isOpen={openSection === 'coords'} onToggle={() => toggleSection('coords')} hasError={sectionHasError.coords}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Latitude" error={errors.latitude?.message}>
                  <input type="number" step="any" {...register('latitude', { valueAsNumber: true })} className={inputClass} />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <input type="number" step="any" {...register('longitude', { valueAsNumber: true })} className={inputClass} />
                </Field>
              </div>
            </AccordionSection>

            <AccordionSection
              title="Pin appearance"
              isOpen={openSection === 'pin'}
              onToggle={() => toggleSection('pin')}
              hasError={sectionHasError.pin}
              preview={
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white shadow dark:border-white/70"
                  style={{ background: colorField.value || DEFAULT_PIN_COLOR }}
                  aria-hidden="true"
                >
                  <PinGlyph emoji={emojiField.value} icon={iconField.value} color={getPinContrastColor(colorField.value || DEFAULT_PIN_COLOR)} />
                </span>
              }
            >
              <span className="mb-1.5 block text-[11px] font-medium text-ink/60 dark:text-mist-light/60">Color</span>
              <div className="grid grid-cols-10 gap-1.5">
                {PIN_COLORS.map((color) => {
                  const isSelected = (colorField.value || DEFAULT_PIN_COLOR).toLowerCase() === color.toLowerCase()
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => colorField.onChange(color)}
                      aria-label={`Pin color ${color}`}
                      aria-pressed={isSelected}
                      className={`aspect-square rounded-full transition duration-150 hover:scale-105 hover:shadow-md ${
                        isSelected ? 'ring-2 ring-harbor ring-offset-1 ring-offset-white dark:ring-offset-[#333]' : ''
                      }`}
                      style={{ background: color }}
                    />
                  )
                })}
              </div>

              <div className="mt-3 mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink/60 dark:text-mist-light/60">Emoji (optional)</span>
                {emojiField.value && (
                  <button type="button" onClick={() => emojiField.onChange('')} className="text-[11px] font-medium text-harbor hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-10 gap-1">
                {TRAVEL_EMOJIS.map((emoji) => {
                  const isSelected = emojiField.value === emoji
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        emojiField.onChange(isSelected ? '' : emoji)
                        if (!isSelected) iconField.onChange('')
                      }}
                      aria-label={`Pin emoji ${emoji}`}
                      aria-pressed={isSelected}
                      className={`flex aspect-square items-center justify-center rounded-md text-base transition-colors ${
                        isSelected ? 'bg-harbor/20 ring-1 ring-harbor' : 'hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink/60 dark:text-mist-light/60">Or an icon (optional)</span>
                {iconField.value && (
                  <button type="button" onClick={() => iconField.onChange('')} className="text-[11px] font-medium text-harbor hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-10 gap-1">
                {TRAVEL_ICONS.map(({ name, Icon }) => {
                  const isSelected = iconField.value === name
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        iconField.onChange(isSelected ? '' : name)
                        if (!isSelected) emojiField.onChange('')
                      }}
                      aria-label={`Pin icon ${name}`}
                      aria-pressed={isSelected}
                      className={`flex aspect-square items-center justify-center rounded-md text-ink/80 transition-colors dark:text-mist-light/80 ${
                        isSelected ? 'bg-harbor/20 text-harbor ring-1 ring-harbor dark:text-harbor-light' : 'hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} />
                    </button>
                  )
                })}
              </div>
            </AccordionSection>
          </div>

          <div className="shrink-0 border-t border-black/10 p-5 dark:border-white/10">
            <button
              type="submit"
              disabled={isSubmitting || isFetchingPhotos}
              className="flex items-center justify-center gap-2 rounded-full bg-harbor px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </form>

        {/* Right: the boarding-pass barcode stub. */}
        <BarcodeStub />
      </div>
    </Overlay>
  )
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
    >
      {children}
    </div>
  )
}

function PopupHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink dark:text-mist-light">{title}</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-mist-light/60">{subtitle}</p>
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
  )
}

function AccordionSection({
  title,
  isOpen,
  onToggle,
  hasError,
  preview,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  hasError?: boolean
  preview?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 bg-white/40 transition-all duration-200 dark:border-white/10 dark:bg-white/5 ${
        isOpen ? '' : 'hover:scale-[1.01] hover:shadow-md dark:hover:shadow-black/40'
      }`}
    >
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="text-sm font-medium text-ink dark:text-mist-light">{title}</span>
        {hasError && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="Section has errors" />}
        {preview}
        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-ink/50 transition-transform duration-300 dark:text-mist-light/50 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Animate height by transitioning the grid track between 0fr and 1fr — the inner
          overflow-hidden wrapper clips the content as it grows/shrinks. */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden" aria-hidden={!isOpen}>
          <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">{children}</div>
        </div>
      </div>
    </div>
  )
}

// Decorative boarding-pass stub: a dashed perforation, two punched notches, a fake barcode and a
// vertical code. Purely cosmetic, hidden on mobile where it wouldn't fit.
function BarcodeStub() {
  return (
    <div className="relative hidden w-16 shrink-0 flex-col items-center justify-center gap-3 border-l-2 border-dashed border-black/20 py-6 dark:border-white/20 sm:flex">
      {/* Notches where the tear line meets the top and bottom edges — colored like the overlay. */}
      <span className="absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" aria-hidden="true" />
      <span className="absolute bottom-0 left-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-black/40" aria-hidden="true" />
      <div className="flex w-full flex-col items-stretch justify-center gap-[2px] px-3" aria-hidden="true">
        {BARCODE_BARS.map((thickness, i) => (
          <span key={i} className="block w-full rounded-[1px] bg-ink dark:bg-mist-light" style={{ height: `${thickness}px` }} />
        ))}
      </div>
      <span className="[writing-mode:vertical-rl] text-[8px] font-semibold uppercase tracking-[0.3em] text-ink/40 dark:text-mist-light/40" aria-hidden="true">
        GoingRoam
      </span>
    </div>
  )
}

// The small preview symbol in the "Pin appearance" header: emoji, else a line icon, else the
// contrast-colored dot — mirroring the marker's own emoji > icon > dot priority.
function PinGlyph({ emoji, icon, color }: { emoji?: string; icon?: string; color: string }) {
  if (emoji) return <span className="text-base leading-none">{emoji}</span>
  const Icon = icon ? TRAVEL_ICON_MAP[icon] : undefined
  if (Icon) return <Icon size={16} strokeWidth={2.5} style={{ color }} />
  return <span className="h-2 w-2 rounded-full" style={{ background: color }} />
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
