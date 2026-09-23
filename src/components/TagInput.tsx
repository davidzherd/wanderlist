import { useId, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

const MIN_TAG_LENGTH = 2
const MAX_TAG_LENGTH = 40
const MAX_SUGGESTIONS = 6

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  // Existing tags to offer while typing (e.g. every tag across the user's locations).
  suggestions: string[]
  // true: any typed text becomes a tag (add/edit form). false: only picks from `suggestions` (filter).
  allowCreate: boolean
  max?: number
  placeholder?: string
  ariaLabel: string
  // Styling for the chip + input box, so it can match the surrounding form's inputs.
  className?: string
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Chip-style multi-value input. Type and press Enter (or comma) to turn text into a removable chip;
 * Backspace on an empty box removes the last chip. Matching `suggestions` are listed inline below the
 * box (in flow rather than a floating dropdown, so it isn't clipped by the collapsible filter panel or
 * the popup's scroll areas). Case-insensitive duplicates are ignored, and a typed tag that matches an
 * existing suggestion adopts that suggestion's spelling so tags stay consistent across locations.
 *
 * Render this outside a <label>: a label would forward clicks on chip text to the first chip's
 * remove button.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  allowCreate,
  max,
  placeholder,
  ariaLabel,
  className = '',
}: TagInputProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const listId = useId()

  const isFull = max !== undefined && value.length >= max
  const trimmed = query.trim()
  const matches = suggestions
    .filter((s) => !value.some((v) => sameTag(v, s)))
    .filter((s) => (trimmed ? s.toLowerCase().includes(trimmed.toLowerCase()) : true))
    .slice(0, MAX_SUGGESTIONS)

  const addTag = (raw: string) => {
    const text = raw.trim()
    if (!text || isFull) return
    const existing = suggestions.find((s) => sameTag(s, text))
    const tag = existing ?? (allowCreate ? text : undefined)
    if (!tag || tag.length < MIN_TAG_LENGTH || tag.length > MAX_TAG_LENGTH) return
    if (value.some((v) => sameTag(v, tag))) {
      setQuery('')
      return
    }
    onChange([...value, tag])
    setQuery('')
  }

  const removeTag = (tag: string) => onChange(value.filter((v) => v !== tag))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      // Always swallow Enter — inside a <form> it would otherwise submit mid-typing.
      e.preventDefault()
      // In pick-only mode, Enter takes the top match so the user doesn't have to type it exactly.
      addTag(allowCreate ? query : (matches[0] ?? query))
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  // Some mobile keyboards don't report ',' in keydown, so also split on commas as the text changes.
  const handleChange = (text: string) => {
    if (!text.includes(',')) {
      setQuery(text)
      return
    }
    const parts = text.split(',')
    const rest = parts.pop() ?? ''
    let next = value
    for (const part of parts) {
      const t = part.trim()
      const existing = suggestions.find((s) => sameTag(s, t))
      const tag = existing ?? (allowCreate ? t : undefined)
      if (!tag || tag.length < MIN_TAG_LENGTH || tag.length > MAX_TAG_LENGTH) continue
      if (max !== undefined && next.length >= max) break
      if (!next.some((v) => sameTag(v, tag))) next = [...next, tag]
    }
    if (next !== value) onChange(next)
    setQuery(rest)
  }

  const showSuggestions = isFocused && !isFull && matches.length > 0

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-harbor/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-harbor dark:bg-harbor/25 dark:text-harbor-light"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-harbor/20"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            // Don't lose a typed-but-uncommitted tag when the user moves on (e.g. straight to Save).
            if (allowCreate) addTag(query)
          }}
          disabled={isFull}
          placeholder={isFull ? `Tag limit reached (${max})` : value.length === 0 ? placeholder : ''}
          aria-label={ariaLabel}
          aria-controls={showSuggestions ? listId : undefined}
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm text-ink placeholder:text-ink/40 focus:outline-none disabled:cursor-not-allowed dark:text-mist-light dark:placeholder:text-mist-light/40"
        />
      </div>
      {showSuggestions && (
        <ul id={listId} role="listbox" aria-label={`${ariaLabel} suggestions`} className="mt-1 flex flex-wrap gap-1.5">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                // mousedown + preventDefault keeps focus in the input so the list doesn't vanish first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s)}
                className="rounded-full border border-harbor/30 px-2.5 py-0.5 text-xs text-harbor hover:bg-harbor/10 dark:border-harbor-light/30 dark:text-harbor-light dark:hover:bg-harbor/20"
              >
                + {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
