import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import StoryLibrary from "@/components/library/StoryLibrary"
import type { KidProfile, Story, StoryTemplate } from "@/types"

function profile(id: string, name: string): KidProfile {
  return {
    id,
    account_id: "account-1",
    name,
    age: 6,
    age_months: 0,
    gender: "girl",
    appearance: {},
    personality_tags: [],
    toy: { name: "Toy" },
    prompt_summary: "",
    reference_image_path: null,
    reference_image_url: null,
    deleted_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  }
}

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
    title: "Luna Moon Mission",
    content: "A short story.",
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
    created_at: "2026-05-10T00:00:00.000Z",
    ...overrides,
  }
}

const profiles = [profile("kid-luna", "Luna"), profile("kid-max", "Max")]
const templates: StoryTemplate[] = [
  {
    id: "template-bedtime",
    name: "Bedtime",
    description: "",
    system_prompt: "",
    user_prompt_template: "",
    image_prompt_template: "",
    credits_cost: 1,
    is_active: true,
    created_at: "2026-05-01T00:00:00.000Z",
  },
]

describe("StoryLibrary", () => {
  it("filters stories and clears active filters", async () => {
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"))
    const user = userEvent.setup()

    render(
      <StoryLibrary
        profiles={profiles}
        templates={templates}
        stories={[
          story({ id: "moon", title: "Luna Moon Mission", kid_profile_id: "kid-luna" }),
          story({ id: "rocket", title: "Max Rocket Race", kid_profile_id: "kid-max" }),
        ]}
      />
    )

    await user.selectOptions(screen.getByLabelText("All kids"), "kid-max")

    expect(screen.getByText("1 story of 2")).toBeInTheDocument()
    expect(screen.getByText("Max Rocket Race")).toBeInTheDocument()
    expect(screen.queryByText("Luna Moon Mission")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear" }))

    expect(screen.getByText("2 stories")).toBeInTheDocument()
  })

  it("shows empty state and new story link", () => {
    render(<StoryLibrary profiles={profiles} templates={templates} stories={[]} />)

    expect(screen.getByText("Your story shelf is empty.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Grant my first wish/ })).toHaveAttribute("href", "/generate")
  })
})
