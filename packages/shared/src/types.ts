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
