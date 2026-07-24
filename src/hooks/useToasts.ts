import { useCallback, useState } from 'react'
import type { ToastData, ToastType } from '../components/Toast'

export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return { toasts, pushToast, dismissToast }
}
