export type StoryLength = "short" | "medium" | "long"

export const STORY_LENGTHS = {
  short:  { label: "Short",  pages: 4, imageCount: 4, imageCost: 1 },
  medium: { label: "Medium", pages: 6, imageCount: 6, imageCost: 2 },
  long:   { label: "Long",   pages: 8, imageCount: 8, imageCost: 3 },
} as const satisfies Record<StoryLength, { label: string; pages: number; imageCount: number; imageCost: number }>
