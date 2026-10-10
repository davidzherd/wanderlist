import { useState } from 'react'
import { Plus } from 'lucide-react'

interface AddDayButtonProps {
  onAdd: () => Promise<void>
}

export function AddDayButton({ onAdd }: AddDayButtonProps) {
  const [isShrinking, setIsShrinking] = useState(false)

  const handleClick = async () => {
    setIsShrinking(true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await onAdd()
    setIsShrinking(false)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-10 items-center gap-1.5 rounded-full bg-harbor px-4 text-sm font-medium text-white shadow-md transition-transform duration-200 hover:scale-105 ${
        isShrinking ? 'scale-0' : 'scale-100'
      }`}
    >
      <Plus size={16} /> Add day
    </button>
  )
}
