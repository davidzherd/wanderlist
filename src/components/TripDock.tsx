import type { ReactNode } from 'react'
import { BookMarked, Plus } from 'lucide-react'
import { TravelBuddyIcon } from './TripChat'

type DockPanel = 'bucket' | 'tools' | 'chat'

interface TripDockProps {
  onOpenBucketList: () => void
  onOpenAdd: () => void
  /** Omitted for non-premium users — the dock then shows just Bucket list + Add. */
  onOpenBuddy?: () => void
  /** 'fixed' (phones/tablets): pinned to the bottom of the screen. 'inline' (desktop): placed by the parent, under
   * the itinerary, with its panels opening above it. */
  variant?: 'fixed' | 'inline'
  /** Desktop: which dock panel is open, so its item reads as pressed. */
  active?: DockPanel | null
}

/**
 * The trip page's one action bar (every screen size), replacing separate floating buttons (trip tools, chat) and
 * the bucket-list tray. Phones/tablets: each slot opens a BottomSheet. Desktop: each opens a panel above the dock.
 * "Add" is the raised primary action in the middle. Capped at ~420px so it doesn't stretch across wide screens.
 */
export function TripDock({ onOpenBucketList, onOpenAdd, onOpenBuddy, variant = 'fixed', active = null }: TripDockProps) {
  return (
    <nav
      aria-label="Trip actions"
      className={
        variant === 'fixed'
          ? 'fixed inset-x-2 bottom-2 z-40 mx-auto max-w-[420px] pb-[env(safe-area-inset-bottom)]'
          : 'pointer-events-auto relative w-full max-w-[420px]'
      }
    >
      <div className="relative">
        <div aria-hidden="true" className="glow-border animate-glow-pulse" />
        <div className="glass-panel relative z-10 flex items-end justify-around rounded-2xl bg-white/80 px-2 pb-2 pt-1.5 shadow-lg dark:bg-[#333]/80">
          <DockItem label="Bucket list" onClick={onOpenBucketList} isActive={active === 'bucket'}>
            <BookMarked size={20} />
          </DockItem>
          <button
            type="button"
            onClick={onOpenAdd}
            aria-label="Open trip tools"
            aria-pressed={variant === 'inline' ? active === 'tools' : undefined}
            className="flex min-w-[4rem] flex-col items-center gap-1 text-[11px] font-medium text-ink/70 dark:text-mist-light/70"
          >
            <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-harbor text-white shadow-lg ring-4 ring-mist-light transition-transform active:scale-95 dark:ring-ink">
              <Plus size={24} />
            </span>
            Add
          </button>
          {onOpenBuddy && (
            <DockItem label="Buddy" ariaLabel="Open your travel buddy" onClick={onOpenBuddy} isActive={active === 'chat'}>
              <TravelBuddyIcon size={20} />
            </DockItem>
          )}
        </div>
      </div>
    </nav>
  )
}

function DockItem({
  label,
  ariaLabel,
  onClick,
  isActive = false,
  children,
}: {
  label: string
  ariaLabel?: string
  onClick: () => void
  isActive?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isActive || undefined}
      className={`flex min-w-[4rem] flex-col items-center gap-1 rounded-xl px-2 pt-1.5 text-[11px] font-medium transition-colors hover:bg-harbor/10 active:bg-harbor/10 ${
        isActive ? 'bg-harbor/10 text-harbor dark:text-harbor-light' : 'text-ink/70 dark:text-mist-light/70'
      }`}
    >
      <span className="text-harbor">{children}</span>
      {label}
    </button>
  )
}
