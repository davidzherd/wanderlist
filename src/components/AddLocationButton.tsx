import { MapPin } from 'lucide-react'

interface AddLocationButtonProps {
  onClick: () => void
}

export function AddLocationButton({ onClick }: AddLocationButtonProps) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[900]">
      <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2">
        <span
          aria-hidden="true"
          className="animate-tools-jump-shadow block h-2 w-8 rounded-full bg-black/40 blur-[2px] dark:bg-black/60"
        />
      </span>
      <button
        type="button"
        onClick={onClick}
        aria-label="Add a bucket list location"
        className="animate-tools-jump pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-harbor text-white shadow-lg transition-transform hover:scale-105"
      >
        <MapPin size={24} strokeWidth={2} />
      </button>
    </div>
  )
}
