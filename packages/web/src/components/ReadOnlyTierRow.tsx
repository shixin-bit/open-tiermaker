import type { Tier } from '@/lib/types'
import { cn } from '@/lib/utils'

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface ReadOnlyTierRowProps {
  tier: Tier
  imageSrcs: Record<string, string>
}

export function ReadOnlyTierRow({ tier, imageSrcs }: ReadOnlyTierRowProps) {
  return (
    <div
      className="flex border border-border rounded-md overflow-hidden"
      style={{ backgroundColor: hexToRgba(tier.color, 0.08) }}
    >
      <div
        className="w-16 sm:w-20 flex items-center justify-center text-center font-bold text-sm sm:text-base px-2 py-3 shrink-0 select-none"
        style={{ backgroundColor: tier.color, color: '#fff' }}
      >
        {tier.label}
      </div>
      <div
        className={cn(
          'flex-1 flex flex-wrap items-start content-start gap-2 p-3 min-h-[110px] transition-colors',
        )}
      >
        {tier.imageIds.length === 0 ? (
          <span className="text-muted-foreground text-sm select-none">（空）</span>
        ) : (
          tier.imageIds.map((imgId) => {
            const src = imageSrcs[imgId]
            if (!src) return null
            return (
              <div
                key={imgId}
                className="w-24 h-24 rounded-md overflow-hidden border border-border bg-card shadow-sm"
              >
                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
