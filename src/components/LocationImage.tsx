import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface LocationImageProps {
  src?: string
  alt: string
  className?: string
}

export function LocationImage({ src, alt, className = 'mb-2 h-28 w-full rounded-lg object-cover' }: LocationImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/20 bg-black/5 text-ink/40 dark:border-mist-light/20 dark:bg-white/5 dark:text-mist-light/40 ${className}`}
      >
        <ImageOff size={18} />
        <span className="text-[11px] font-medium">No image added</span>
      </div>
    )
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
}
