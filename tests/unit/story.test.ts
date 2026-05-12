import { describe, expect, it, vi } from "vitest"

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn() }
  },
}))

import { splitStoryPages } from "@/lib/ai/story"

describe("splitStoryPages", () => {
  it("splits explicit page markers", () => {
    expect(splitStoryPages("Title: Moon\n\n--- Page 1 ---\nFirst page.\n--- Page 2 ---\nSecond page.")).toEqual([
      "Title: Moon",
      "First page.",
      "Second page.",
    ])
  })

  it("accepts decorated page markers", () => {
    expect(splitStoryPages("One\n\n**Page 2**\nTwo\n\n---**Page 3**---\nThree")).toEqual([
      "One",
      "Two",
      "Three",
    ])
  })

  it("falls back to blank-line paragraphs", () => {
    expect(splitStoryPages("First paragraph.\n\nSecond paragraph.")).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ])
  })
})
