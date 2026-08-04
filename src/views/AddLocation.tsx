import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Loader2, MapPin, PlusCircle, Search } from 'lucide-react'
import { useLocations } from '../context/LocationContext'
import { geocodeSearch } from '../api/geocode'
import { ApiError } from '../api/client'
import type { NominatimResult } from '../types/location'
import { LocationFormSchema, type LocationFormValues } from '../types/location'
import { ToastStack } from '../components/Toast'
import { useToasts } from '../hooks/useToasts'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

export function AddLocationView() {
  const { addLocation } = useLocations()
  const navigate = useNavigate()
  const { toasts, pushToast, dismissToast } = useToasts()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(LocationFormSchema),
    defaultValues: { name: '', country: '', category: '', priority: 3, latitude: 0, longitude: 0, notes: '', imageUrl: '' },
  })

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

  const onSubmit = async (values: LocationFormValues) => {
    try {
      await addLocation({ ...values, imageUrl: values.imageUrl || undefined })
      pushToast('success', `${values.name} added to your bucket list.`)
      reset()
      setQuery('')
      setTimeout(() => navigate('/'), 900)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      pushToast('error', err instanceof Error ? err.message : 'Could not save that location.')
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-mist-light px-4 py-8 dark:bg-ink sm:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink dark:text-mist-light">
          Add a bucket list location
        </h1>
        <p className="mb-6 text-sm text-ink/60 dark:text-mist-light/60">
          Search a place to auto-fill its details, or enter coordinates manually.
        </p>

        <div className="glass-panel mb-6 rounded-2xl p-4">
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

        <form onSubmit={handleSubmit(onSubmit)} className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
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
            <Field label="Priority (1-5)" error={errors.priority?.message}>
              <select {...register('priority', { valueAsNumber: true })} className={inputClass}>
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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

          <Field label="Image URL (optional)" error={errors.imageUrl?.message}>
            <input type="text" placeholder="https://…" {...register('imageUrl')} className={inputClass} />
          </Field>

          <Field label="Notes (optional)" error={errors.notes?.message}>
            <textarea rows={3} {...register('notes')} className={inputClass} />
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex items-center justify-center gap-2 self-start rounded-full bg-harbor px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
            Add to bucket list
          </button>
        </form>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
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
