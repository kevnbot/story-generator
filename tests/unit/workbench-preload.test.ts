import { describe, expect, it } from "vitest"
import {
  buildWorkbenchInitialStory,
  getWorkbenchSourceProfileIds,
  inferWorkbenchStoryLength,
} from "@/lib/admin/workbench-preload"

const storyTypes = [
  {
    id: "bedtime",
    name: "Bedtime",
    description: "A gentle story",
    occasion_required: false,
    extra_input_label: null,
    extra_input_hint: null,
    system_prompt_suffix: "Be cozy.",
    structure_template: "Beginning, middle, end.",
    page_guidance: { first: "Open softly.", middle: "Stay gentle.", last: "End warmly." },
  },
]

const artStyles = [{ id: "watercolor", name: "Watercolor" }]

describe("workbench preload helpers", () => {
  it("deduplicates source profile ids from generation params and story fallback", () => {
    expect(getWorkbenchSourceProfileIds(
      { kid_profile_id: "kid-luna", kid_profile_ids: ["kid-luna", "kid-max"] },
      "kid-fallback"
    )).toEqual(["kid-luna", "kid-max"])
  })

  it("infers legacy story length from page count before defaulting", () => {
    const missingFields: string[] = []

    expect(inferWorkbenchStoryLength(undefined, 4, missingFields)).toBe("short")
    expect(missingFields).toContain("Story length was not stored; inferred from page count.")
  })

  it("builds an imported story seed with conservative legacy fallbacks", () => {
    const initialStory = buildWorkbenchInitialStory({
      story: {
        id: "story-1",
        title: "Moon Adventure",
        content: [
          "Title: Moon Adventure",
          "--- Page 1 ---",
          "Luna found a moon map.",
          "--- Page 2 ---",
          "She packed a tiny snack.",
          "--- Page 3 ---",
          "The stars made a path.",
          "--- Page 4 ---",
          "Home felt warm again.",
        ].join("\n"),
        created_at: "2026-01-01T00:00:00.000Z",
        account_id: "account-1",
        user_id: "user-1",
        kid_profile_id: "kid-luna",
        parent_story_id: null,
        has_images: true,
        generation_params: {
          kid_profile_ids: ["kid-luna"],
          kid_names: ["Luna"],
          story_type_id: "bedtime",
          system_prompt: "System prompt",
          user_prompt: "User prompt",
          image_prompts: ["Paint page one"],
          model: "claude-sonnet-4-6",
        },
      },
      sourceContext: {
        storyId: "story-1",
        storyTitle: "Moon Adventure",
        storyCreatedAt: "2026-01-01T00:00:00.000Z",
        accountId: "account-1",
        accountName: "Family",
        userId: "user-1",
        userEmail: "parent@example.com",
        userDisplayName: "Parent",
      },
      storyTypes,
      artStyles,
      sourceProfileIds: ["kid-luna"],
      archivedProfileNames: [],
      resolvedImages: [{ url: "https://example.com/page-1.jpg", caption: null, scene_index: 0 }],
    })

    expect(initialStory.storyLength).toBe("short")
    expect(initialStory.textDensity).toBe("read_together")
    expect(initialStory.artStyleId).toBe("watercolor")
    expect(initialStory.storyDescription).toBe("")
    expect(initialStory.extraInput).toBe("")
    expect(initialStory.promptsResult?.systemPrompt).toBe("System prompt")
    expect(initialStory.storyPages).toHaveLength(4)
    expect(initialStory.imagePrompts).toEqual(["Paint page one"])
    expect(initialStory.generatedImages?.[0]).toMatchObject({ pageIndex: 0, url: "https://example.com/page-1.jpg" })
    expect(initialStory.sourceContext.missingFields).toEqual(
      expect.arrayContaining([
        "Story length was not stored; inferred from page count.",
        "Art style was not stored; defaulted to the first active art style.",
        "Story description was not stored for this log.",
      ])
    )
  })
})
