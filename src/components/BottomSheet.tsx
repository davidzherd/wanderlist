import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import { Drawer } from 'vaul'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  subtitle?: ReactNode
  /** Extra header content under the title/subtitle (e.g. a filter input that should stay put while the body scrolls). */
  headerExtra?: ReactNode
  /** 'tall' fills 85% of the screen (chat); 'auto' (default) hugs its content, capped at 85%. */
  size?: 'auto' | 'tall'
  /** Only the grab handle drags the sheet closed — use for forms, so a stray swipe can't discard input. */
  handleOnly?: boolean
  children: ReactNode
}

// In-sheet navigation: a picker opened from inside a sheet (a form's time/date/select field) swaps the sheet's
// content in place — with a "← Back" header — instead of stacking a second sheet on top (two grab handles, the
// form peeking out behind). The sheet's own content stays mounted underneath (just hidden), so form state survives.
interface SheetView {
  title: ReactNode
  onBack: () => void
}
interface SheetNav {
  slotEl: HTMLElement | null
  show: (view: SheetView) => void
  hide: () => void
}
const SheetNavContext = createContext<SheetNav | null>(null)

/**
 * Shared mobile bottom sheet (Vaul): grab handle, dimmed backdrop, swipe down / tap outside / back to close.
 * Every mobile "sheet" in the app goes through this so they look and behave the same. `children` sit in a
 * flex column that takes the remaining height — scrollable content should bring its own `overflow-y-auto`.
 */
export function BottomSheet({ open, onOpenChange, title, subtitle, headerExtra, size = 'auto', handleOnly, children }: BottomSheetProps) {
  const [view, setView] = useState<SheetView | null>(null)
  const [slotEl, setSlotEl] = useState<HTMLDivElement | null>(null)
  const nav = useMemo<SheetNav>(() => ({ slotEl, show: setView, hide: () => setView(null) }), [slotEl])

  useEffect(() => {
    if (!open) setView(null)
  }, [open])

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly={handleOnly} repositionInputs>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[1000] bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className={`fixed inset-x-0 bottom-0 z-[1001] flex flex-col rounded-t-3xl border-t border-white/60 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-glass outline-none backdrop-blur-2xl dark:border-white/10 dark:bg-[#333]/90 ${
            size === 'tall' ? 'h-[85dvh]' : 'max-h-[85dvh]'
          }`}
        >
          <Drawer.Handle className="mt-3 !w-12 !bg-ink/20 dark:!bg-mist-light/30" />
          {view ? (
            <div className="relative border-b border-dashed border-black/10 px-4 pb-3 pt-2 text-center dark:border-white/10">
              <button
                type="button"
                onClick={view.onBack}
                className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-harbor"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <Drawer.Title className="font-display text-sm font-semibold text-ink dark:text-mist-light">{view.title}</Drawer.Title>
            </div>
          ) : (
            <div className="border-b border-dashed border-black/10 px-4 pb-3 pt-2 text-center dark:border-white/10">
              <Drawer.Title className="font-display text-sm font-semibold text-ink dark:text-mist-light">{title}</Drawer.Title>
              {subtitle && <p className="mx-auto max-w-sm text-xs text-ink/50 dark:text-mist-light/50">{subtitle}</p>}
              {headerExtra && <div className="mt-3 text-left">{headerExtra}</div>}
            </div>
          )}
          <SheetNavContext.Provider value={nav}>
            <div className={view ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>{children}</div>
          </SheetNavContext.Provider>
          <div ref={setSlotEl} className={view ? 'trip-scroll min-h-0 flex-1 overflow-y-auto' : 'hidden'} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

interface SheetPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  children: ReactNode
}

/**
 * What a mobile picker (time, date, select) renders its panel into. Inside another sheet it takes over that
 * sheet's content in place (with a Back header); on its own it opens a regular BottomSheet.
 */
export function SheetPicker({ open, onOpenChange, title, children }: SheetPickerProps) {
  const nav = useContext(SheetNavContext)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  useEffect(() => {
    if (!nav || !open) return
    nav.show({ title, onBack: () => onOpenChangeRef.current(false) })
    return () => nav.hide()
  }, [nav, open, title])

  if (!nav) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
        {children}
      </BottomSheet>
    )
  }
  return open && nav.slotEl ? createPortal(children, nav.slotEl) : null
}
