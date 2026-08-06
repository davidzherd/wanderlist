import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface LocationImageProps {
  src?: string
  alt: string
  className?: string
  /** Set false when the surrounding container is always light (e.g. a Leaflet popup, which
   * doesn't pick up the app's dark theme), so the placeholder doesn't turn near-invisible. */
  themed?: boolean
}

export function LocationImage({
  src,
  alt,
  className = 'mb-2 h-28 w-full rounded-lg object-cover',
  themed = true,
}: LocationImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/20 bg-black/5 text-ink/40 ${themed ? 'dark:border-mist-light/20 dark:bg-white/5 dark:text-mist-light/40' : ''} ${className}`}
      >
        <ImageOff size={18} />
        <span className="text-[11px] font-medium">No image added</span>
      </div>
    )
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
}
