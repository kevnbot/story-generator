import { describe, expect, it } from "vitest"
import {
  buildCharacterAnchor,
  buildCharacterAnchorSlim,
  buildProfilePicturePrompt,
  buildPromptSummary,
  buildReferenceImagePrompt,
  buildToyIllustrationPrompt,
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
    expect(referencePrompt).toContain("Simple white background")
    expect(referencePrompt).not.toContain("Moon Bear")
    expect(referencePrompt).not.toContain("a silver stuffed bear")
    expect(referencePrompt).not.toContain("plushie")
    expect(referencePrompt).not.toContain("stuffed")
    expect(referencePrompt).not.toContain("The toy is a separate")
    expect(anchor).toContain("a separate stuffed object Luna holds, not part of their body")
    expect(slimAnchor).toBe("Luna (human girl) wearing a yellow raincoat")
  })

  it("buildProfilePicturePrompt describes toy in text without @Image2", () => {
    const result = buildProfilePicturePrompt(profile(), { name: "Uni", description: "a stuffed rainbow unicorn" })
    expect(result).toContain("@Image1")
    expect(result).not.toContain("@Image2")
    expect(result).toContain("Uni")
    expect(result).toContain("a stuffed rainbow unicorn")
  })

  it("buildProfilePicturePrompt omits @Image2 and treasured item language when no toy", () => {
    const result = buildProfilePicturePrompt(profile(), null)
    expect(result).toContain("@Image1")
    expect(result).not.toContain("@Image2")
    expect(result).not.toContain("treasured item")
  })

  it("buildProfilePicturePrompt handles toy with no description", () => {
    const result = buildProfilePicturePrompt(profile(), { name: "Uni", description: null })
    expect(result).toContain("Uni")
    expect(result).not.toContain("@Image2")
  })

  it("buildToyIllustrationPrompt — tiara/accessory uses accessory phrasing", () => {
    const result = buildToyIllustrationPrompt({ name: "rainbow tiara", description: "rainbow colors with sparkly gems" })
    expect(result).toContain("accessory object")
    expect(result).toContain("not worn by or placed on any character or animal")
    expect(result).toContain("No characters, no animals")
    expect(result).not.toContain("plushie")
    expect(result).not.toContain("companion")
  })

  it("buildToyIllustrationPrompt — stuffed animal uses plushie phrasing", () => {
    const result = buildToyIllustrationPrompt({ name: "Moon Bear", description: "a silver stuffed bear" })
    expect(result).toContain("stuffed plushie toy")
    expect(result).toContain("sitting upright")
    expect(result).toContain("No characters, no animals")
  })

  it("buildToyIllustrationPrompt — game console uses handheld phrasing", () => {
    const result = buildToyIllustrationPrompt({ name: "game console", description: undefined })
    expect(result).toContain("handheld object")
    expect(result).toContain("no hands holding it")
  })

  it("buildToyIllustrationPrompt — no description does not crash and includes toy name", () => {
    const result = buildToyIllustrationPrompt({ name: "Uni", description: undefined })
    expect(result).toContain("Uni")
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
