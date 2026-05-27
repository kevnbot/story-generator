export type TextDensityKey = "early_reader" | "read_together" | "read_aloud"

export interface TextDensity {
  id: TextDensityKey
  name: string
  description: string       // shown to parent in UI
  promptInstruction: string // injected into user prompt, replaces current per-page sentence guidance
}

export const TEXT_DENSITIES: Record<TextDensityKey, TextDensity> = {
  early_reader: {
    id: "early_reader",
    name: "Early Reader",
    description: "One short sentence per page — perfect for little ones learning to read",
    promptInstruction: "Each page must be exactly one sentence. Maximum 10 words per page. Use the simplest possible vocabulary — words a 3 year old knows. No complex ideas, no compound sentences.",
  },
  read_together: {
    id: "read_together",
    name: "Read Together",
    description: "2-3 sentences per page — great for reading together at bedtime",
    promptInstruction: "Each page should be 2-3 sentences. Clear, simple language. Each sentence should be easy to follow for a young child.",
  },
  read_aloud: {
    id: "read_aloud",
    name: "Read Aloud",
    description: "A rich paragraph per page — written for a parent to read expressively",
    promptInstruction: "Each page is two to three full paragraphs. Each paragraph is 4-5 sentences. Use rich, vivid, descriptive language with layered sensory detail — what things look like, sound like, feel like, smell like. Write with drama and expressiveness — this is meant to be performed by a parent reading aloud. Build atmosphere on every page. Separate the two paragraphs with a blank line. Do not hold back on detail or description.",
  },
}

export const DEFAULT_TEXT_DENSITY: TextDensityKey = "read_together"
