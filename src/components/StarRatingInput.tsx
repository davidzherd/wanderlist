import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  size?: number
  className?: string
}

export function StarRatingInput({ value, onChange, size = 20, className = '' }: StarRatingInputProps) {
  const [hoverValue, setHoverValue] = useState(0)
  const displayValue = hoverValue || value

  return (
    <div className={`flex items-center gap-1 ${className}`} onMouseLeave={() => setHoverValue(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            aria-label={`Set priority to ${star} star${star === 1 ? '' : 's'}`}
            className="text-brass transition-opacity"
          >
            <Star
              size={size}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={filled ? 0 : 1.5}
              className={filled ? (hoverValue > 0 ? 'opacity-60' : 'opacity-100') : 'text-ink/25 dark:text-mist-light/25'}
            />
          </button>
        )
      })}
    </div>
  )
}
