import { useEffect } from 'react'
import { X } from 'lucide-react'
import { LocationImage } from './LocationImage'

interface BucketlistCelebrationProps {
  name: string
  imageUrl?: string
  onClose: () => void
}

/** Centered congratulations modal shown after a custom trip stop is promoted to a bucket-list
 * location. Closing it is what "finishes" the flow (the star on the trip card is already gone by
 * then, since the item has been re-linked). */
export function BucketlistCelebration({ name, imageUrl, onClose }: BucketlistCelebrationProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Location added to bucket list"
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="relative max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div aria-hidden="true" className="glow-border animate-glow-pulse" />
        <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-glass dark:bg-ink">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-1 text-white transition-colors hover:bg-black/50"
          >
            <X size={16} />
          </button>

          <LocationImage src={imageUrl} alt={name} className="h-36 w-full rounded-xl object-cover" />

          <h2 className="font-display text-xl font-semibold text-ink dark:text-mist-light">
            Added to your bucket list!
          </h2>
          <p className="text-sm text-ink/70 dark:text-mist-light/70">
            <span className="font-semibold text-harbor dark:text-harbor-light">{name}</span> is now saved to your bucket
            list and pinned to your map.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-full bg-harbor px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  )
}
