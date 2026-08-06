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
      aria-label="Add day"
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-harbor text-white shadow-lg transition-transform duration-200 hover:rotate-180 ${
        isShrinking ? 'scale-0' : 'scale-100'
      }`}
    >
      <Plus size={18} />
    </button>
  )
}
