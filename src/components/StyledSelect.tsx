import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface StyledSelectOption {
  value: string
  /** Shown in the open list. */
  label: ReactNode
  /** Shown in the closed trigger button when this option is selected. Defaults to `label`. */
  triggerLabel?: ReactNode
}

const triggerClass =
  'flex w-full items-center justify-between gap-1 rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-left text-sm text-ink focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light'

/**
 * Reusable styled dropdown matching the app's TransportTypeSelect/TimeInput chrome (harbor accents,
 * click-outside close, `.trip-scroll` list). Use in place of a native <select> so pickers stay on the
 * "boarding-pass glass" design language. The list auto-scrolls when there are many options.
 */
export function StyledSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  triggerClassName = '',
}: {
  value: string
  onChange: (value: string) => void
  options: StyledSelectOption[]
  ariaLabel?: string
  className?: string
  triggerClassName?: string
}) {
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

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`${triggerClass} ${triggerClassName}`}
      >
        <span className="truncate">{selected ? selected.triggerLabel ?? selected.label : ''}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-ink/40 transition-transform dark:text-mist-light/40 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          className="trip-scroll absolute z-20 mt-1 max-h-60 w-full min-w-max overflow-y-auto rounded-lg border border-black/10 bg-mist-light shadow-lg dark:border-white/10 dark:bg-ink"
        >
          {options.map((opt) => {
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
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
