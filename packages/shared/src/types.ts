export interface Tier {
  id: string;
  label: string;
  color: string;
  imageIds: string[];
}

export interface ImageItem {
  id: string;
  src: string;
  source: "local" | "url";
  createdAt: number;
}

export interface TierState {
  tiers: Tier[];
  pool: string[];
  images: Record<string, ImageItem>;
}

export const DEFAULT_TIERS: Tier[] = [
  { id: "S", label: "S", color: "#ef4444", imageIds: [] },
  { id: "A", label: "A", color: "#f97316", imageIds: [] },
  { id: "B", label: "B", color: "#eab308", imageIds: [] },
  { id: "C", label: "C", color: "#22c55e", imageIds: [] },
  { id: "D", label: "D", color: "#3b82f6", imageIds: [] },
];

export const DEFAULT_STATE: TierState = {
  tiers: DEFAULT_TIERS,
  pool: [],
  images: {},
};

/**
 * 编辑动作类型,用于 Undo/Redo 历史栈的合并判定。
 * - drag: 拖拽排序(同 300ms 内连续拖拽合并为一条历史)
 * - tier-label: 等级行标签改名
 * - tier-color: 等级行颜色修改
 * - image-add: 新增图片(每次添加视为独立动作,不合并)
 * - image-remove: 单张图片删除
 * - images-remove: 批量删除多张图片(一次 dispatch 一条历史)
 * - reset: 重置排行榜到默认状态
 */
export type ActionType =
  | "drag"
  | "tier-label"
  | "tier-color"
  | "image-add"
  | "image-remove"
  | "images-remove"
  | "reset";

/**
 * 一条编辑历史记录,用于历史栈展示与调试。
 */
export interface EditAction {
  type: ActionType;
  timestamp: number;
}
