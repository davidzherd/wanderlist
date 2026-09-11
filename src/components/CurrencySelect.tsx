import { CURRENCIES, getCurrencySymbol } from '../data/currencies'
import { StyledSelect, type StyledSelectOption } from './StyledSelect'

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
 * Per-item overrides use PriceCurrencyField instead. Uses the shared StyledSelect for a consistent look.
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
