interface LogoProps {
  className?: string
  showWordmark?: boolean
}

export function Logo({ className = 'h-9 w-9', showWordmark = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="gr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C79A3D" />
            <stop offset="100%" stopColor="#12857B" />
          </linearGradient>
        </defs>
        {/* Map pin silhouette */}
        <path
          d="M24 4C15.163 4 8 11.163 8 20c0 11.5 16 24 16 24s16-12.5 16-24c0-8.837-7.163-16-16-16z"
          fill="url(#gr-grad)"
        />
        {/* Compass ring */}
        <circle cx="24" cy="20" r="10" fill="#F0EEE6" />
        <circle cx="24" cy="20" r="10" fill="none" stroke="#16212B" strokeOpacity="0.15" strokeWidth="1" />
        {/* Compass needle */}
        <path d="M24 12l4 8-4 8-4-8z" fill="#12857B" />
        <path d="M24 12l4 8-4-2-4 2z" fill="#16212B" fillOpacity="0.35" />
        <circle cx="24" cy="20" r="1.6" fill="#16212B" />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-ink dark:text-mist-light">
          Going<span className="text-harbor">Roam</span>
        </span>
      )}
    </div>
  )
}
