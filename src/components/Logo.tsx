interface LogoProps {
  className?: string
  showWordmark?: boolean
}

export function Logo({ className = 'h-9 w-9', showWordmark = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="wl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#C85A32" />
          </linearGradient>
        </defs>
        {/* Map pin silhouette */}
        <path
          d="M24 4C15.163 4 8 11.163 8 20c0 11.5 16 24 16 24s16-12.5 16-24c0-8.837-7.163-16-16-16z"
          fill="url(#wl-grad)"
        />
        {/* Compass ring */}
        <circle cx="24" cy="20" r="10" fill="#F5E6D3" />
        <circle cx="24" cy="20" r="10" fill="none" stroke="#1F1610" strokeOpacity="0.15" strokeWidth="1" />
        {/* Compass needle */}
        <path d="M24 12l4 8-4 8-4-8z" fill="#C85A32" />
        <path d="M24 12l4 8-4-2-4 2z" fill="#1F1610" fillOpacity="0.35" />
        <circle cx="24" cy="20" r="1.6" fill="#1F1610" />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-espresso dark:text-sand-light">
          Wander<span className="text-terracotta">List</span>
        </span>
      )}
    </div>
  )
}
