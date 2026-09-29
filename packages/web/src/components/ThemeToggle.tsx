import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useTheme, type Theme } from '@/hooks/useTheme'

interface ThemeOption {
  value: Theme
  label: string
  icon: string
}

const OPTIONS: ThemeOption[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'system', label: '跟随系统', icon: '💻' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5"
      role="group"
      aria-label="主题切换"
    >
      {OPTIONS.map((option) => {
        const isActive = theme === option.value
        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTheme(option.value)}
            className={cn('h-7 px-2 text-xs gap-1', !isActive && 'opacity-70')}
            aria-label={`切换到${option.label}主题`}
            aria-pressed={isActive}
            title={option.label}
          >
            <span aria-hidden="true">{option.icon}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
