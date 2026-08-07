import { useEffect, useRef, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bus, ChevronDown, Plane, TrainFront, X, type LucideIcon } from 'lucide-react'
import {
  NoteItemFormSchema,
  TransportItemFormSchema,
  LodgingItemFormSchema,
  type NoteItemFormValues,
  type TransportItemFormValues,
  type LodgingItemFormValues,
  type TransportType,
  type TripItemKind,
} from '../types/trip'
import { TOOL_DEFS } from './TripToolsBar'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'
const labelClass = 'mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70'
const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400'
const submitClass =
  'mt-2 w-full rounded-lg bg-harbor px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90'

const TRANSPORT_TYPE_OPTIONS: { value: TransportType; label: string; icon: LucideIcon }[] = [
  { value: 'plane', label: 'Plane', icon: Plane },
  { value: 'train', label: 'Train', icon: TrainFront },
  { value: 'bus', label: 'Bus', icon: Bus },
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

function NoteForm({ onSubmit }: { onSubmit: (values: NoteItemFormValues) => void }) {
  const form = useForm<NoteItemFormValues>({
    resolver: zodResolver(NoteItemFormSchema),
    defaultValues: { title: '', description: '' },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div>
        <label className="block">
          <span className={labelClass}>Note title</span>
          <input type="text" placeholder="e.g. Pack sunscreen" {...form.register('title')} className={inputClass} />
        </label>
        {form.formState.errors.title && <p className={errorClass}>{form.formState.errors.title.message}</p>}
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea rows={3} placeholder="Add details…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <button type="submit" className={submitClass}>
        Add note
      </button>
    </form>
  )
}

function TransportForm({ onSubmit }: { onSubmit: (values: TransportItemFormValues) => void }) {
  const form = useForm<TransportItemFormValues>({
    resolver: zodResolver(TransportItemFormSchema),
    defaultValues: { transportType: 'plane', departureTime: '', arrivalTime: '', description: '' },
  })
  const { field: transportTypeField } = useController({ name: 'transportType', control: form.control })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Transport type</label>
        <TransportTypeSelect value={transportTypeField.value} onChange={transportTypeField.onChange} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block">
            <span className={labelClass}>Departure time</span>
            <input type="time" {...form.register('departureTime')} className={inputClass} />
          </label>
          {form.formState.errors.departureTime && (
            <p className={errorClass}>{form.formState.errors.departureTime.message}</p>
          )}
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>Arrival time</span>
            <input type="time" {...form.register('arrivalTime')} className={inputClass} />
          </label>
          {form.formState.errors.arrivalTime && (
            <p className={errorClass}>{form.formState.errors.arrivalTime.message}</p>
          )}
        </div>
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea rows={3} placeholder="e.g. Flight AA123, confirmation #…" {...form.register('description')} className={inputClass} />
        </label>
      </div>
      <button type="submit" className={submitClass}>
        Add transport
      </button>
    </form>
  )
}

function LodgingForm({ onSubmit }: { onSubmit: (values: LodgingItemFormValues) => void }) {
  const form = useForm<LodgingItemFormValues>({
    resolver: zodResolver(LodgingItemFormSchema),
    defaultValues: { name: '', description: '', checkInTime: '', checkOutTime: '' },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
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
            <span className={labelClass}>Check-in time</span>
            <input type="time" {...form.register('checkInTime')} className={inputClass} />
          </label>
          {form.formState.errors.checkInTime && <p className={errorClass}>{form.formState.errors.checkInTime.message}</p>}
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>Check-out time</span>
            <input type="time" {...form.register('checkOutTime')} className={inputClass} />
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
        Add lodging
      </button>
    </form>
  )
}

interface TripToolPopupProps {
  kind: Exclude<TripItemKind, 'location'>
  onClose: () => void
  onAddNote: (values: NoteItemFormValues) => void
  onAddTransport: (values: TransportItemFormValues) => void
  onAddLodging: (values: LodgingItemFormValues) => void
}

export function TripToolPopup({ kind, onClose, onAddNote, onAddTransport, onAddLodging }: TripToolPopupProps) {
  const tool = TOOL_DEFS.find((t) => t.kind === kind)!
  const Icon = tool.icon

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
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
            {tool.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-ink/50 hover:text-ink dark:text-mist-light/50 dark:hover:text-mist-light"
          >
            <X size={18} />
          </button>
        </div>

        {kind === 'note' && <NoteForm onSubmit={onAddNote} />}
        {kind === 'transport' && <TransportForm onSubmit={onAddTransport} />}
        {kind === 'lodging' && <LodgingForm onSubmit={onAddLodging} />}
      </div>
    </div>
  )
}
