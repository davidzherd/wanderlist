import { useRef } from 'react'
import { useLocations } from '../context/LocationContext'
import { MapView } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'
import { Skeleton } from '../components/Skeleton'
import { ToastStack } from '../components/Toast'
import { useToasts } from '../hooks/useToasts'
import { useTheme } from '../hooks/useTheme'

export function HomeMapView() {
  const { filteredLocations, isLoading, error, filters, setFilters, toggleVisited, removeLocation } = useLocations()
  const { theme } = useTheme()
  const { toasts, pushToast, dismissToast } = useToasts()
  const hasWarnedRef = useRef(false)

  if (error && !hasWarnedRef.current) {
    hasWarnedRef.current = true
    pushToast('error', error)
  }

  const handleToggleVisited = async (id: string) => {
    try {
      await toggleVisited(id)
    } catch {
      pushToast('error', 'Could not update that location. Try again.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await removeLocation(id)
      pushToast('success', 'Location removed from your bucket list.')
    } catch {
      pushToast('error', 'Could not remove that location. Try again.')
    }
  }

  return (
    <div className="relative h-full w-full bg-[#d5e8eb] dark:bg-[#262626]">
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="w-full max-w-md space-y-3 px-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ) : (
        <>
          <MapView
            locations={filteredLocations}
            theme={theme}
            onToggleVisited={handleToggleVisited}
            onDelete={handleDelete}
          />
          <FilterPanel filters={filters} onChange={setFilters} resultCount={filteredLocations.length} />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
