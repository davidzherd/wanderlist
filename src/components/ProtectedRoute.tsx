import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isInitializing } = useAuth()

  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-mist-light dark:bg-ink">
        <Loader2 size={24} className="animate-spin text-harbor" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
