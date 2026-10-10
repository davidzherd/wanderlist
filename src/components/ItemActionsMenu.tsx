import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import { BottomSheet } from './BottomSheet'

export interface ItemAction {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  /** Destructive (Delete): red, always listed last by the caller. */
  danger?: boolean
  /** Shows a spinner instead of the icon and blocks re-selection (e.g. while saving to the bucket list). */
  isBusy?: boolean
}

interface ItemActionsMenuProps {
  /** Shown as the mobile sheet's title and in the button's accessible name. */
  itemName: string
  actions: ItemAction[]
}

const MENU_WIDTH = 208

/**
 * One "⋯" button per itinerary card, replacing the column of tiny action icons. Desktop: a small dropdown
 * (fixed-positioned so the list's scroll container can't clip it; flips above the button near the bottom).
 * Phones/tablets: the same actions as rows in the shared BottomSheet. Callers pass actions in one fixed order
 * (Edit, Move to day, Duplicate, Save to bucket list, Delete) and just omit the ones an item doesn't support.
 */
export function ItemActionsMenu({ itemName, actions }: ItemActionsMenuProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const open = () => {
    if (!isMobile && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const estimatedHeight = actions.length * 40 + 12
      const openUp = rect.bottom + estimatedHeight > window.innerHeight - 8
      setPosition({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - MENU_WIDTH),
        openUp,
      })
    }
    setIsOpen(true)
  }

  // Desktop dropdown: close on outside click, Esc, scroll or resize (its fixed position would go stale).
  useEffect(() => {
    if (!isOpen || isMobile) return
    const close = () => setIsOpen(false)
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen, isMobile])

  const select = (action: ItemAction) => {
    if (action.isBusy) return
    setIsOpen(false)
    action.onSelect()
  }

  const rowClass = (action: ItemAction) =>
    `flex w-full items-center gap-3 text-left text-sm transition-colors disabled:cursor-wait ${
      action.danger
        ? 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
        : 'text-ink hover:bg-harbor/10 dark:text-mist-light'
    }`

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup={isMobile ? 'dialog' : 'menu'}
        aria-expanded={isOpen}
        aria-label={`Actions for ${itemName}`}
        title="More actions"
        className={`flex shrink-0 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-black/5 hover:text-ink dark:text-mist-light/50 dark:hover:bg-white/10 dark:hover:text-mist-light ${
          isMobile ? 'h-10 w-10' : 'h-8 w-8'
        }`}
      >
        <MoreHorizontal size={18} />
      </button>

      {isMobile ? (
        <BottomSheet open={isOpen} onOpenChange={setIsOpen} title={itemName}>
          <ul className="px-2 pb-3 pt-2">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <li key={action.key}>
                  <button type="button" onClick={() => select(action)} disabled={action.isBusy} className={`${rowClass(action)} rounded-xl px-4 py-3.5`}>
                    {action.isBusy ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                    {action.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </BottomSheet>
      ) : (
        isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${itemName}`}
            style={{
              position: 'fixed',
              left: position.left,
              width: MENU_WIDTH,
              ...(position.openUp ? { bottom: window.innerHeight - position.top } : { top: position.top }),
            }}
            className="z-[1200] overflow-hidden rounded-xl border border-black/10 bg-mist-light py-1 shadow-lg dark:border-white/10 dark:bg-ink"
          >
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  onClick={() => select(action)}
                  disabled={action.isBusy}
                  className={`${rowClass(action)} px-3 py-2.5`}
                >
                  {action.isBusy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                  {action.label}
                </button>
              )
            })}
          </div>,
          document.body,
        )
      )}
    </>
  )
}
