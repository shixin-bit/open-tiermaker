import { useState } from 'react'

interface TierLabelProps {
  label: string
  color: string
  onLabelChange: (label: string) => void
  onColorChange: (color: string) => void
}

function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 155 ? '#1a1a1a' : '#ffffff'
}

export function TierLabel({ label, color, onLabelChange, onColorChange }: TierLabelProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const textColor = getContrastColor(color)

  const handleDoubleClick = () => {
    setValue(label)
    setEditing(true)
  }

  const handleBlur = () => {
    const trimmed = value.trim()
    if (trimmed.length > 0 && trimmed.length <= 20) {
      onLabelChange(trimmed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditing(false)
      setValue(label)
    }
  }

  return (
    <div
      className="w-28 shrink-0 flex items-center justify-center relative group select-none"
      style={{ backgroundColor: color }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center cursor-pointer"
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full text-center font-bold text-lg bg-transparent outline-none border-2 border-white/70"
            style={{ color: textColor }}
            maxLength={20}
          />
        ) : (
          <span className="font-bold text-lg drop-shadow" style={{ color: textColor }}>
            {label}
          </span>
        )}
      </div>
      <input
        type="color"
        value={color}
        onChange={(e) => onColorChange(e.target.value)}
        className="absolute bottom-1 right-1 w-5 h-5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="修改颜色"
      />
    </div>
  )
}
