import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { CURRENCIES, getCurrencySymbol } from '../data/currencies'
import { useIsMobile } from '../hooks/useIsMobile'
import { BottomSheet } from './BottomSheet'
import { StyledSelect, triggerClass, type StyledSelectOption } from './StyledSelect'

// ISO code in the trigger; code + muted symbol in the list. No full currency name (kept compact).
const OPTIONS: StyledSelectOption[] = CURRENCIES.map((c) => ({
  value: c.code,
  triggerLabel: c.code,
  label: (
    <>
      <span className="font-medium">{c.code}</span>
      <span className="text-ink/40 dark:text-mist-light/40">{getCurrencySymbol(c.code)}</span>
    </>
  ),
}))

/**
 * Trip default currency picker (no "inherit" option — a trip always has a concrete default).
 * Per-item overrides use PriceCurrencyField instead. Uses the shared StyledSelect for a consistent look on
 * desktop; on phones the same trigger opens a BottomSheet list instead of a dropdown.
 */
export function CurrencySelect({
  value,
  onChange,
  ariaLabel = 'Trip currency',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
}) {
  const isMobile = useIsMobile()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  if (isMobile) {
    return (
      <div className={`w-24 ${className}`}>
        <button type="button" onClick={() => setIsSheetOpen(true)} aria-haspopup="dialog" aria-label={ariaLabel} className={triggerClass}>
          <span className="truncate">{value}</span>
          <ChevronDown size={15} className="shrink-0 text-ink/40 dark:text-mist-light/40" />
        </button>
        <BottomSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} title="Trip currency">
          <ul className="trip-scroll overflow-y-auto px-3 py-2">
            {CURRENCIES.map((c) => {
              const isSelected = c.code === value
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code)
                      setIsSheetOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${
                      isSelected ? 'bg-harbor/10 text-harbor' : 'text-ink dark:text-mist-light'
                    }`}
                  >
                    <span className="w-10 font-medium">{c.code}</span>
                    <span className="flex-1 truncate text-ink/60 dark:text-mist-light/60">{c.name}</span>
                    <span className="text-ink/40 dark:text-mist-light/40">{getCurrencySymbol(c.code)}</span>
                    {isSelected && <Check size={16} className="shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </BottomSheet>
      </div>
    )
  }

  return (
    <StyledSelect
      value={value}
      onChange={onChange}
      options={OPTIONS}
      ariaLabel={ariaLabel}
      className={`w-24 ${className}`}
    />
  )
}
