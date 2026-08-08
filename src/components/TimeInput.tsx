import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

interface TimeInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
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

export function TimeInput({ value, onChange, placeholder = 'Add time', className = '' }: TimeInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const parsed = parseTime(value)
  const hour = parsed ? parsed.hour : 0
  const minute = parsed ? parsed.minute : 0
  const display = formatDisplay(value)

  const commit = (nextHour: number, nextMinute: number) => {
    onChange(toValue(nextHour, nextMinute))
  }

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

      {isOpen && (
        <div className="absolute z-20 mt-1 w-40 rounded-xl border border-black/10 bg-mist-light p-2 shadow-lg dark:border-white/10 dark:bg-ink">
          <div className="grid grid-cols-2 gap-1">
            <div className="trip-scroll max-h-40 overflow-y-auto">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => commit(h, minute)}
                  className={optionClass(Boolean(parsed) && h === hour)}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>
            <div className="trip-scroll max-h-40 overflow-y-auto">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
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
        </div>
      )}
    </div>
  )
}
