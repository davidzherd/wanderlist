import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { MapPin, type LucideIcon } from 'lucide-react'

/** Colour of the icon tile on the left (used when there's no photo). */
export type PushTone = 'success' | 'error' | 'info' | 'removed'

export interface PushNotificationData {
  /** New id → a fresh notification (replaces the one showing and restarts its timer). */
  id: string
  title: string
  /** Regular-weight text right after the bold title, e.g. "just updated". */
  titleSuffix?: string
  subtitle?: string
  /** Small icon before the subtitle (e.g. a map pin before a country). */
  subtitleIcon?: LucideIcon
  /** Photo tile on the left. Falls back to the icon tile if missing or it fails to load. */
  imageUrl?: string
  /** Icon tile on the left when there's no photo. Defaults to a map pin. */
  icon?: LucideIcon
  tone?: PushTone
  onClick?: () => void
}

const TONE_TILE: Record<PushTone, string> = {
  success: 'bg-harbor text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-brass text-white',
  removed: 'bg-ink/80 text-white dark:bg-white/20',
}

interface PushNotificationProps {
  notification: PushNotificationData | null
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 5000
// Must match the .wl-push-leave animation in index.css.
const LEAVE_MS = 250
// How far up (px) a drag has to go to count as "flick away"; smaller drags snap back.
const DISMISS_DRAG_PX = 40
// Movement under this is still a tap.
const TAP_SLOP_PX = 6

/**
 * Phone-style push notification: slides down at the top centre of the content area (below the navbar), auto-dismisses (paused on hover), can be
 * flicked/dragged upward to dismiss, and runs `onClick` when tapped. One at a time — a new id replaces it.
 */
export function PushNotification({ notification, onDismiss }: PushNotificationProps) {
  if (!notification) return null
  // Keyed so a new notification remounts: entrance animation, timer and drag state all start fresh.
  return <PushCard key={notification.id} notification={notification} onDismiss={onDismiss} />
}

function PushCard({ notification, onDismiss }: { notification: PushNotificationData; onDismiss: () => void }) {
  const [isLeaving, setIsLeaving] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const dragStartRef = useRef<number | null>(null)
  const movedRef = useRef(false)

  const leave = () => setIsLeaving(true)

  useEffect(() => {
    if (!isLeaving) return
    const timer = setTimeout(onDismiss, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [isLeaving, onDismiss])

  useEffect(() => {
    if (isPaused || isDragging || isLeaving) return
    const timer = setTimeout(() => setIsLeaving(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [isPaused, isDragging, isLeaving])

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    dragStartRef.current = e.clientY
    movedRef.current = false
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragStartRef.current === null) return
    const dy = e.clientY - dragStartRef.current
    if (Math.abs(dy) > TAP_SLOP_PX) movedRef.current = true
    // Free movement upward; downward only stretches a little, like the real thing.
    setDragY(dy < 0 ? dy : dy / 4)
  }
  const handlePointerEnd = () => {
    if (dragStartRef.current === null) return
    dragStartRef.current = null
    setIsDragging(false)
    if (dragY < -DISMISS_DRAG_PX) leave()
    else setDragY(0)
  }

  const handleClick = () => {
    // A drag that ended back in place isn't a tap.
    if (movedRef.current || isLeaving) return
    notification.onClick?.()
    leave()
  }

  const showImage = notification.imageUrl && !imageFailed
  const TileIcon = notification.icon ?? MapPin
  const SubtitleIcon = notification.subtitleIcon

  return (
    // Absolute, not fixed: it anchors to the page's content area (Layout's relative <main>), so it always sits just
    // under the navbar whatever the navbar's height — and main's overflow clip makes it slide out from beneath it.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-4 z-[1100] flex justify-center px-2"
    >
      <div className={isLeaving ? 'wl-push-leave' : 'wl-push-enter'}>
        <button
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          style={{
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 200ms ease-out',
          }}
          className="pointer-events-auto flex w-[min(380px,calc(100vw-16px))] touch-none select-none items-center gap-3 rounded-[20px] border border-white/60 bg-white/80 px-3 py-2.5 text-left font-body text-ink shadow-glass backdrop-blur-2xl dark:border-white/10 dark:bg-[#333]/80 dark:text-mist-light"
        >
          {showImage ? (
            <img
              src={notification.imageUrl}
              alt=""
              draggable={false}
              onError={() => setImageFailed(true)}
              className="h-[46px] w-[46px] shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span
              className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl ${
                notification.tone ? TONE_TILE[notification.tone] : 'bg-harbor-light text-white dark:bg-harbor-dark'
              }`}
            >
              <TileIcon size={22} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="mb-px flex justify-between text-[11px] tracking-wide text-ink/60 dark:text-mist-light/60">
              <span>GoingRoam</span>
              <span>now</span>
            </span>
            {/* Up to 3 lines so longer messages (errors) stay readable; names rarely need more than one. */}
            <span className="line-clamp-3 font-display text-sm font-semibold leading-tight">
              {notification.title}
              {notification.titleSuffix && <span className="font-body font-normal"> {notification.titleSuffix}</span>}
            </span>
            {notification.subtitle && (
              <span className="flex items-center gap-1 text-xs text-ink/70 dark:text-mist-light/70">
                {SubtitleIcon && <SubtitleIcon size={12} className="shrink-0" />}
                <span className="truncate">{notification.subtitle}</span>
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
