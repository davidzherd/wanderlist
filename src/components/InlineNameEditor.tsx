import { useState, type ReactNode } from 'react'
import { Check, Pencil } from 'lucide-react'

interface InlineNameEditorProps {
  /** The current effective name shown when not editing and seeded into the input on edit. */
  value: string
  /** Called with the raw draft when the user confirms (Enter or the check button). */
  onSave: (name: string) => void
  maxLength: number
  ariaLabelEdit: string
  ariaLabelSave: string
  /** Classes for the read-only display text (so callers can match their heading size). */
  displayClassName?: string
  inputClassName?: string
  /** Extra content shown after the name only when NOT editing (e.g. a day's date). */
  trailing?: ReactNode
  pencilSize?: number
  checkSize?: number
  /** When set, clicking the read-only name calls this (used to focus a day on the map). */
  onDisplayClick?: () => void
}

const defaultInputClass =
  'rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-harbor dark:border-white/10 dark:bg-black/30 dark:text-mist-light dark:placeholder:text-mist-light/40'

/**
 * A small "click the pencil to edit a name inline" control: shows the name with a
 * pencil, swaps to a text input + check on click. Escape cancels, Enter/check saves.
 * Reused for the trip name and each day's custom label.
 */
export function InlineNameEditor({
  value,
  onSave,
  maxLength,
  ariaLabelEdit,
  ariaLabelSave,
  displayClassName = 'truncate font-display text-sm font-semibold text-ink dark:text-mist-light',
  inputClassName = `${defaultInputClass} max-w-xs`,
  trailing,
  pencilSize = 15,
  checkSize = 18,
  onDisplayClick,
}: InlineNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEditing = () => {
    setDraft(value)
    setIsEditing(true)
  }

  const save = () => {
    onSave(draft)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <>
        <input
          type="text"
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          autoFocus
          className={inputClassName}
        />
        <button
          type="button"
          onClick={save}
          aria-label={ariaLabelSave}
          title={ariaLabelSave}
          className="shrink-0 text-harbor hover:opacity-80"
        >
          <Check size={checkSize} />
        </button>
      </>
    )
  }

  return (
    <>
      {onDisplayClick ? (
        <button type="button" onClick={onDisplayClick} className={`${displayClassName} cursor-pointer text-left hover:text-harbor dark:hover:text-harbor-light`}>
          {value}
        </button>
      ) : (
        <span className={displayClassName}>{value}</span>
      )}
      <button
        type="button"
        onClick={startEditing}
        aria-label={ariaLabelEdit}
        title={ariaLabelEdit}
        className="pdf-hide shrink-0 text-ink/40 hover:text-harbor dark:text-mist-light/40 dark:hover:text-harbor-light"
      >
        <Pencil size={pencilSize} />
      </button>
      {trailing}
    </>
  )
}
