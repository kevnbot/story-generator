import { describe, expect, it } from "vitest"
import {
  buildCharacterAnchor,
  buildCharacterAnchorSlim,
  buildPromptSummary,
  buildReferenceImagePrompt,
  fillPromptTemplateMulti,
  formatAge,
  joinNames,
} from "@/lib/ai/prompt-builder"
import type { KidProfile } from "@/types"

function profile(overrides: Partial<KidProfile> = {}): KidProfile {
  return {
    id: "kid-1",
    account_id: "account-1",
    name: "Luna",
    age: 6,
    age_months: 3,
    gender: "girl",
    appearance: {
      hair: "curly brown",
      eye_color: "green",
      skin_tone: "warm brown",
    },
    personality_tags: ["curious"],
    toy: {
      name: "Moon Bear",
      description: "a silver stuffed bear",
    },
    prompt_summary: "Luna is curious.",
    reference_image_path: null,
    reference_image_url: null,
    deleted_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("prompt builder helpers", () => {
  it("formats age in years and months", () => {
    expect(formatAge(0, 0)).toBe("a newborn")
    expect(formatAge(0, 1)).toBe("1 month old")
    expect(formatAge(1, 0)).toBe("1 year old")
    expect(formatAge(4, 2)).toBe("4 years and 2 months old")
  })

  it("joins names naturally", () => {
    expect(joinNames(["Luna"])).toBe("Luna")
    expect(joinNames(["Luna", "Max"])).toBe("Luna and Max")
    expect(joinNames(["Luna", "Max", "Ari"])).toBe("Luna, Max, and Ari")
  })

  it("builds prompt summaries from appearance, personality, and toy fields", () => {
    expect(buildPromptSummary(profile())).toBe(
      "Luna is a girl. Luna has curly brown hair, green eyes, warm brown skin. Luna is curious. Their favorite toy is Moon Bear, a silver stuffed bear."
    )
  })

  it("keeps child and toy identity separate in image prompts", () => {
    const referencePrompt = buildReferenceImagePrompt(profile())
    const anchor = buildCharacterAnchor([profile()])
    const slimAnchor = buildCharacterAnchorSlim([profile()], { Luna: "a yellow raincoat" }, new Set(["kid-1"]))

    expect(referencePrompt).toContain("Luna is a human child, not an animal")
    expect(referencePrompt).toContain("The toy is a separate stuffed object")
    expect(anchor).toContain("a separate stuffed object Luna holds, not part of their body")
    expect(slimAnchor).toBe("Luna (human girl) wearing a yellow raincoat")
  })

  it("fills multi-profile template placeholders", () => {
    const luna = profile()
    const max = profile({
      id: "kid-2",
      name: "Max",
      age: 4,
      age_months: 0,
      gender: "boy",
      prompt_summary: "Max likes rockets.",
      personality_tags: ["brave"],
      toy: { name: "Rocket", type: "spaceship" },
    })

    expect(
      fillPromptTemplateMulti(
        "{{child_name}} | {{child_age}} | {{child_gender}} | {{prompt_summary}} | {{toy_summary}} | {{personality_tags}}",
        [luna, max]
      )
    ).toContain("Luna and Max | 6 years and 3 months old and 4 years old | girl, boy")
  })
})
