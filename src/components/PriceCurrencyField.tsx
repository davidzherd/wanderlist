import type { UseFormRegisterReturn } from 'react-hook-form'
import { CURRENCIES, getCurrencySymbol } from '../data/currencies'
import { StyledSelect, type StyledSelectOption } from './StyledSelect'

const inputClass =
  'w-full rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'
const labelClass = 'mb-1 block text-xs font-medium text-ink/70 dark:text-mist-light/70'
const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400'

// Compact option: ISO code, with the symbol in muted text (no full currency name).
function codeOption(code: string): StyledSelectOption {
  return {
    value: code,
    triggerLabel: code,
    label: (
      <>
        <span className="font-medium">{code}</span>
        <span className="text-ink/40 dark:text-mist-light/40">{getCurrencySymbol(code)}</span>
      </>
    ),
  }
}

interface PriceCurrencyFieldProps {
  /** RHF register(...) result for the numeric `price` field. */
  priceRegister: UseFormRegisterReturn
  /** Controlled value of the `currency` field: '' (or undefined) means "inherit the trip default". */
  currencyValue: string | undefined
  onCurrencyChange: (value: string) => void
  /** The trip's default currency, shown as the "inherit" option. */
  tripCurrency: string
  error?: string
}

/**
 * Price input paired with a compact currency selector, shared by every item form. Currency defaults
 * to the trip's currency (the "Trip default" option) and can be overridden per item — e.g. a hotel
 * paid in JPY on a USD-home trip. The selector shows only ISO codes to stay narrow, leaving the
 * number input the room.
 */
export function PriceCurrencyField({
  priceRegister,
  currencyValue,
  onCurrencyChange,
  tripCurrency,
  error,
}: PriceCurrencyFieldProps) {
  const options: StyledSelectOption[] = [
    {
      value: '',
      // Inherited state reads as muted in the trigger, so an override stands out from the default.
      triggerLabel: <span className="text-ink/50 dark:text-mist-light/50">{tripCurrency}</span>,
      label: <span className="text-ink/60 dark:text-mist-light/60">Trip default ({tripCurrency})</span>,
    },
    ...CURRENCIES.map((c) => codeOption(c.code)),
  ]

  return (
    <div>
      <label className={labelClass} htmlFor={priceRegister.name}>
        Price (optional)
      </label>
      <div className="flex gap-2">
        <input
          id={priceRegister.name}
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          {...priceRegister}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <StyledSelect
          ariaLabel="Currency"
          value={currencyValue ?? ''}
          onChange={onCurrencyChange}
          options={options}
          className="w-24 shrink-0"
        />
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}
