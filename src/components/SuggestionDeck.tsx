import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useSuggestions } from '../hooks/useSuggestions'
import { useLocations } from '../context/LocationContext'
import { ApiError } from '../api/client'
import { SuggestionSwiper } from './SuggestionSwiper'
import type { Suggestion } from '../api/wikivoyage'
import type { LocationFormValues } from '../types/location'
import type { ToastType } from './Toast'

// Wikivoyage intro sentences can run past the notes field's 500-char cap — trim before saving.
const MAX_NOTES = 480

// A swipe-right saves straight to the bucket list, but the schema needs a category and priority the
// suggestion doesn't carry — seed them so the save is instant. The user can refine both later on the
// map card. (Chosen defaults: a "suggestion" category and the lowest priority.)
const DEFAULT_CATEGORY = 'suggestion'
const DEFAULT_PRIORITY = 1
// A distinct pin so suggestion-sourced places stand out on the map: purple with the same stars
// (Sparkles) glyph as the discover button. 'sparkles' resolves through pinStyle's TRAVEL_ICON_MAP.
const SUGGESTION_PIN_COLOR = '#7C3AED'
const SUGGESTION_PIN_ICON = 'sparkles'

function toFormValues(suggestion: Suggestion, images: string[]): LocationFormValues {
  const notes = suggestion.description
  return {
    name: suggestion.name,
    country: suggestion.country,
    category: DEFAULT_CATEGORY,
    priority: DEFAULT_PRIORITY,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    notes: notes && notes.length > MAX_NOTES ? `${notes.slice(0, MAX_NOTES - 1).trimEnd()}…` : notes,
    images,
    color: SUGGESTION_PIN_COLOR,
    emoji: '',
    icon: SUGGESTION_PIN_ICON,
  }
}

interface SuggestionDeckProps {
  pushToast: (type: ToastType, message: string) => void
}

// The live map's entry point to Wikivoyage suggestions: a floating button (top-right, level with the
// Filter panel) that opens a full-screen, dating-app-style swiper. Right = save to the bucket list,
// left = skip. Closed by default — nothing opens until the button is tapped.
export function SuggestionDeck({ pushToast }: SuggestionDeckProps) {
  const { suggestions, isLoading, dismiss } = useSuggestions()
  const { addLocation } = useLocations()
  const [isOpen, setIsOpen] = useState(false)

  // Nothing to discover and nothing on the way — don't show the button at all.
  if (!isOpen && suggestions.length === 0 && !isLoading) return null

  const handleSwipeRight = (suggestion: Suggestion, images: string[]) => {
    dismiss(suggestion.name) // remove from the pool so the deck advances deterministically
    void addLocation(toFormValues(suggestion, images)).catch((err) => {
      if (err instanceof ApiError && err.status === 401) return // session expiry handled globally
      pushToast('error', `Couldn't save ${suggestion.name}. Try again.`)
    })
  }

  const handleSwipeLeft = (suggestion: Suggestion) => {
    dismiss(suggestion.name)
  }

  return (
    <>
      <div className="pointer-events-none absolute right-4 top-4 z-[500]">
        <div className="pointer-events-auto relative">
          {/* Colorful masked-ring glow, echoing the old suggestions panel's border. */}
          <span aria-hidden="true" className="glow-ring animate-glow-pulse" />
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Discover places to add to your bucket list"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-harbor text-white shadow-lg transition-transform hover:scale-105"
          >
            <Sparkles size={20} />
            {suggestions.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brass px-1 text-[11px] font-bold text-ink">
                {suggestions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <SuggestionSwiper
          suggestions={suggestions}
          isLoading={isLoading}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
