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
  /** 当前选中集合,透传给内部 ImageCard */
  selectedIds?: Set<string>
  /** 图片点击/Shift+点击 选中回调,透传给内部 ImageCard */
  onImageSelect?: (id: string, shiftKey: boolean) => void
  /** 点击空白区域清空选中的回调 */
  onBackgroundClick?: () => void
}

export const TierBoard = forwardRef<HTMLDivElement, TierBoardProps>(
  (
    {
      state,
      onRemoveImage,
      onLabelChange,
      onColorChange,
      overContainerId,
      readOnly,
      selectedIds,
      onImageSelect,
      onBackgroundClick,
    },
    ref,
  ) => {
    const imageSrcs: Record<string, string> = {}
    Object.values(state.images).forEach((img) => {
      imageSrcs[img.id] = img.src
    })

    return (
      <div
        ref={ref}
        className="flex flex-col gap-3"
        onClick={(e) => {
          // 仅当点击目标就是外层容器(非子元素冒泡)时才清空选中
          if (e.target === e.currentTarget) {
            onBackgroundClick?.()
          }
        }}
      >
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
              selectedIds={selectedIds}
              onImageSelect={onImageSelect}
            />
          ),
        )}
      </div>
    )
  },
)

TierBoard.displayName = 'TierBoard'
