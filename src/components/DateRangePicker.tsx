import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onChange: (startDate?: string, endDate?: string) => void
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}

function parseIso(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number)
  return { year, month: month - 1 }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatRangeLabel(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'Add trip dates'
  if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`
  return formatDate(startDate ?? endDate!)
}

const now = new Date()
const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate())

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [visibleYear, setVisibleYear] = useState(() => (startDate ? parseIso(startDate).year : now.getFullYear()))
  const [visibleMonth, setVisibleMonth] = useState(() => (startDate ? parseIso(startDate).month : now.getMonth()))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const base = startDate ? parseIso(startDate) : { year: now.getFullYear(), month: now.getMonth() }
    setVisibleYear(base.year)
    setVisibleMonth(base.month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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

  const firstOfMonth = new Date(Date.UTC(visibleYear, visibleMonth, 1))
  const daysInMonth = new Date(Date.UTC(visibleYear, visibleMonth + 1, 0)).getUTCDate()
  const leadingBlanks = firstOfMonth.getUTCDay()
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const goToPrevMonth = () => {
    if (visibleMonth === 0) {
      setVisibleMonth(11)
      setVisibleYear((y) => y - 1)
    } else {
      setVisibleMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (visibleMonth === 11) {
      setVisibleMonth(0)
      setVisibleYear((y) => y + 1)
    } else {
      setVisibleMonth((m) => m + 1)
    }
  }

  const handleDayClick = (day: number) => {
    const iso = toIso(visibleYear, visibleMonth, day)
    if (!startDate || (startDate && endDate)) {
      onChange(iso, undefined)
      return
    }
    if (iso < startDate) {
      onChange(iso, undefined)
      return
    }
    onChange(startDate, iso)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink transition-colors hover:border-harbor/40 dark:border-white/10 dark:bg-black/30 dark:text-mist-light"
      >
        <Calendar size={15} className="text-harbor" />
        {formatRangeLabel(startDate, endDate)}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-72 rounded-xl border border-black/10 bg-mist-light p-3 shadow-lg dark:border-white/10 dark:bg-ink">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Previous month"
              className="rounded p-1 text-ink/60 hover:bg-harbor/10 hover:text-harbor dark:text-mist-light/60"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-display text-sm font-semibold text-ink dark:text-mist-light">{monthLabel}</span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="rounded p-1 text-ink/60 hover:bg-harbor/10 hover:text-harbor dark:text-mist-light/60"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-ink/40 dark:text-mist-light/40">
            {WEEKDAY_LABELS.map((label, idx) => (
              <span key={idx}>{label}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) => {
              if (day === null) return <span key={idx} />
              const iso = toIso(visibleYear, visibleMonth, day)
              const isStart = iso === startDate
              const isEnd = iso === endDate
              const isInRange = !!startDate && !!endDate && iso > startDate && iso < endDate
              const isToday = iso === todayIso

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                    isStart || isEnd
                      ? 'bg-harbor font-semibold text-white'
                      : isInRange
                        ? 'bg-harbor/15 text-harbor'
                        : 'text-ink hover:bg-harbor/10 dark:text-mist-light'
                  } ${isToday && !isStart && !isEnd ? 'ring-1 ring-harbor/50' : ''}`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined, undefined)
                setIsOpen(false)
              }}
              className="mt-2 w-full text-center text-xs font-medium text-ink/50 hover:text-red-600 dark:text-mist-light/50 dark:hover:text-red-400"
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  )
}
