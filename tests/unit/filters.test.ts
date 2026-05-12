import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_FILTERS, applyFiltersAndSort } from "@/components/library/filters"
import type { Story } from "@/types"

function story(overrides: Partial<Story>): Story {
  return {
    id: "story-1",
    account_id: "account-1",
    user_id: "user-1",
    kid_profile_id: "kid-luna",
    story_template_id: "template-bedtime",
    job_id: null,
    parent_story_id: null,
    version_number: 1,
    has_images: false,
    title: "Luna Story",
    content: "short story",
    images: [],
    generation_params: {
      kid_profile_id: "kid-luna",
      story_template_id: "template-bedtime",
      prompt_summary: "",
      system_prompt: "",
      user_prompt: "",
      image_prompt: "",
      model: "test-model",
      image_model: "",
    },
    credits_used: 1,
    deleted_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  }
}

const stories = [
  story({ id: "a", title: "Moon Garden", kid_profile_id: "kid-luna", story_template_id: "template-bedtime", created_at: "2026-05-10T00:00:00.000Z" }),
  story({ id: "b", title: "Rocket Race", kid_profile_id: "kid-max", story_template_id: "template-adventure", created_at: "2026-04-01T00:00:00.000Z" }),
  story({ id: "c", title: "Apple Castle", kid_profile_id: "kid-luna", story_template_id: "template-adventure", created_at: "2026-05-09T00:00:00.000Z", content: "word ".repeat(350) }),
]

describe("applyFiltersAndSort", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("filters by child, date, length, and template", () => {
    expect(
      applyFiltersAndSort(
        stories,
        { childId: "kid-luna", dateRange: "7d", length: "medium", template: "template-adventure" },
        "newest"
      ).map((item) => item.id)
    ).toEqual(["c"])
  })

  it("sorts by title and created date", () => {
    expect(applyFiltersAndSort(stories, DEFAULT_FILTERS, "title_asc").map((item) => item.title)).toEqual([
      "Apple Castle",
      "Moon Garden",
      "Rocket Race",
    ])
    expect(applyFiltersAndSort(stories, DEFAULT_FILTERS, "oldest").map((item) => item.id)).toEqual(["b", "c", "a"])
  })
})
