import { useState } from 'react'
import { Hotel, Pencil, PenLine, Plane } from 'lucide-react'
import type { TripItemKind } from '../types/trip'

export const TOOL_DEFS: { kind: Exclude<TripItemKind, 'location'>; label: string; icon: typeof PenLine }[] = [
  { kind: 'note', label: 'Note', icon: PenLine },
  { kind: 'transport', label: 'Transport', icon: Plane },
  { kind: 'lodging', label: 'Lodging', icon: Hotel },
]

const HINT_DISMISSED_KEY = 'wanderlist:trip-tools-hint-dismissed'

interface TripToolsBarProps {
  isOpen: boolean
  onToggle: () => void
  onSelect: (kind: Exclude<TripItemKind, 'location'>) => void
}

export function TripToolsBar({ isOpen, onToggle, onSelect }: TripToolsBarProps) {
  const [showHint, setShowHint] = useState(() => {
    try {
      return sessionStorage.getItem(HINT_DISMISSED_KEY) !== 'true'
    } catch {
      return true
    }
  })

  const handleToggle = () => {
    if (showHint) {
      setShowHint(false)
      try {
        sessionStorage.setItem(HINT_DISMISSED_KEY, 'true')
      } catch {
        // storage unavailable (e.g. private browsing) — animation just won't persist across visits
      }
    }
    onToggle()
  }

  return (
    <div className="pointer-events-none fixed right-4 top-1/2 z-[45] flex -translate-y-1/2 items-center gap-2">
      <div
        className={`glass-panel flex w-36 flex-col gap-3 rounded-2xl p-3 shadow-lg transition-transform duration-300 ease-in-out ${
          isOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-[calc(100%+5rem)]'
        }`}
      >
        <h3 className="font-display text-sm font-semibold text-espresso dark:text-sand-light">Tools</h3>
        {TOOL_DEFS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(kind)}
            className="flex flex-col items-center gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-4 text-xs font-medium text-espresso transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 dark:border-white/10 dark:bg-black/30 dark:text-sand-light dark:hover:bg-terracotta/10"
          >
            <span>{label}</span>
            <Icon size={26} className="text-terracotta" />
          </button>
        ))}
      </div>

      <div className="pointer-events-auto relative">
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
          <span
            aria-hidden="true"
            className={`block h-2 w-7 rounded-full bg-black/40 blur-[2px] dark:bg-black/60 ${
              showHint ? 'animate-tools-jump-shadow' : ''
            }`}
          />
        </span>
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isOpen ? 'Close trip tools' : 'Open trip tools'}
          aria-pressed={isOpen}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta text-white shadow-lg transition-transform hover:scale-105 ${
            showHint ? 'animate-tools-jump' : ''
          }`}
        >
          <Pencil size={18} />
        </button>
      </div>
    </div>
  )
}
