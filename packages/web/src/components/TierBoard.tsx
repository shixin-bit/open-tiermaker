import { forwardRef } from 'react'
import type { TierState } from '@/lib/types'
import { TierRow } from './TierRow'
import { ReadOnlyTierRow } from './ReadOnlyTierRow'

interface TierBoardProps {
  state: TierState
  onRemoveImage?: (id: string) => void
  onLabelChange?: (tierId: string, label: string) => void
  onColorChange?: (tierId: string, color: string) => void
  overContainerId: string | null
  readOnly?: boolean
}

export const TierBoard = forwardRef<HTMLDivElement, TierBoardProps>(
  ({ state, onRemoveImage, onLabelChange, onColorChange, overContainerId, readOnly }, ref) => {
    const imageSrcs: Record<string, string> = {}
    Object.values(state.images).forEach((img) => {
      imageSrcs[img.id] = img.src
    })

    return (
      <div ref={ref} className="flex flex-col gap-3">
        {state.tiers.map((tier) =>
          readOnly ? (
            <ReadOnlyTierRow key={tier.id} tier={tier} imageSrcs={imageSrcs} />
          ) : (
            <TierRow
              key={tier.id}
              tier={tier}
              imageSrcs={imageSrcs}
              onRemoveImage={onRemoveImage!}
              onLabelChange={onLabelChange!}
              onColorChange={onColorChange!}
              isOver={overContainerId === `tier-${tier.id}`}
            />
          ),
        )}
      </div>
    )
  },
)

TierBoard.displayName = 'TierBoard'
