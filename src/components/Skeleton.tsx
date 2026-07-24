interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700/50 rounded-lg ${className}`} />
}
