import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import { SheetPicker } from './BottomSheet'

interface TimeInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Title of the mobile bottom sheet the picker opens in. */
  sheetTitle?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function parseTime(value?: string): { hour: number; minute: number } | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return { hour, minute }
}

function formatDisplay(value?: string): string | null {
  const parsed = parseTime(value)
  if (!parsed) return null
  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`
}

function toValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const optionClass = (isSelected: boolean) =>
  `block w-full rounded px-2 py-1 text-center text-sm transition-colors ${
    isSelected ? 'bg-harbor text-white' : 'text-ink hover:bg-harbor/10 dark:text-mist-light dark:hover:bg-harbor/20'
  }`

export function TimeInput({ value, onChange, placeholder = 'Add time', className = '', sheetTitle = 'Select time' }: TimeInputProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hourColRef = useRef<HTMLDivElement>(null)
  const minuteColRef = useRef<HTMLDivElement>(null)

  // On open, scroll each column so its selected value sits at the column's vertical centre — the hour and minute
  // highlights then line up on one row instead of wherever each list happened to start.
  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => {
      for (const col of [hourColRef.current, minuteColRef.current]) {
        const selected = col?.querySelector<HTMLElement>('[aria-selected="true"]')
        if (col && selected) col.scrollTop = selected.offsetTop - col.clientHeight / 2 + selected.offsetHeight / 2
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || isMobile) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, isMobile])

  const parsed = parseTime(value)
  const hour = parsed ? parsed.hour : 0
  const minute = parsed ? parsed.minute : 0
  const display = formatDisplay(value)

  const commit = (nextHour: number, nextMinute: number) => {
    onChange(toValue(nextHour, nextMinute))
  }

  // Popover body, shared by the desktop dropdown and the mobile BottomSheet.
  const panel = (
    <>
      <div className="mb-1 grid grid-cols-2 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-ink/40 dark:text-mist-light/40">
        <span>Hour</span>
        <span>Min</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div ref={hourColRef} className="trip-scroll relative max-h-40 overflow-y-auto">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              aria-selected={Boolean(parsed) && h === hour}
              onClick={() => commit(h, minute)}
              className={optionClass(Boolean(parsed) && h === hour)}
            >
              {String(h).padStart(2, '0')}
            </button>
          ))}
        </div>
        <div ref={minuteColRef} className="trip-scroll relative max-h-40 overflow-y-auto">
          {MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              aria-selected={Boolean(parsed) && m === minute}
              onClick={() => commit(hour, m)}
              className={optionClass(Boolean(parsed) && m === minute)}
            >
              {String(m).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            setIsOpen(false)
          }}
          className="mt-2 w-full text-center text-xs font-medium text-ink/50 hover:text-red-600 dark:text-mist-light/50 dark:hover:text-red-400"
        >
          Clear time
        </button>
      )}
    </>
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex w-full items-center gap-2 rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 ${
          display ? 'text-ink dark:text-mist-light' : 'text-ink/40 dark:text-mist-light/40'
        }`}
      >
        <Clock size={15} className="shrink-0 text-harbor" />
        {display ?? placeholder}
      </button>

      {isOpen && !isMobile && (
        <div className="absolute z-20 mt-1 w-40 rounded-xl border border-black/10 bg-mist-light p-2 shadow-lg dark:border-white/10 dark:bg-ink">
          {panel}
        </div>
      )}
      {isMobile && (
        <SheetPicker open={isOpen} onOpenChange={setIsOpen} title={sheetTitle}>
          <div className="px-5 pb-5 pt-3 [&_.trip-scroll]:max-h-64 [&_.trip-scroll_button]:py-2.5 [&_.trip-scroll_button]:text-base">
            {panel}
            {/* Picking an hour/minute doesn't close the picker (you usually pick both), so phones get an explicit Done. */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mt-3 w-full rounded-full bg-harbor py-2.5 text-sm font-medium text-white"
            >
              Done
            </button>
          </div>
        </SheetPicker>
      )}
    </div>
  )
}
