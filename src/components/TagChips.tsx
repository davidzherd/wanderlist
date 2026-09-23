interface TagChipsProps {
  tags: string[]
  // Show at most this many chips, then a "+N" chip for the rest (keeps compact cards tidy).
  limit?: number
  chipClassName: string
  className?: string
}

/** Read-only row of a location's tags, as chips. Renders nothing when there are no tags. */
export function TagChips({ tags, limit, chipClassName, className = '' }: TagChipsProps) {
  if (tags.length === 0) return null
  const shown = limit !== undefined ? tags.slice(0, limit) : tags
  const hidden = tags.length - shown.length
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {shown.map((tag) => (
        <span key={tag} className={chipClassName}>
          {tag}
        </span>
      ))}
      {hidden > 0 && (
        <span className={chipClassName} title={tags.slice(shown.length).join(', ')}>
          +{hidden}
        </span>
      )}
    </span>
  )
}
