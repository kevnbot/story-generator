import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { StoryGenerationTab } from "@/components/admin/workbench/StoryGenerationTab"

const profiles = [
  {
    id: "kid-luna",
    name: "Luna",
    age: 6,
    age_months: 0,
    gender: "girl",
    appearance: {},
    personality_tags: ["curious"],
    toy: { name: "Moon Bear" },
    reference_image_path: "illustrations/luna.jpg",
    reference_image_url: "https://example.com/luna.jpg",
    combined_reference_path: null,
    character_illustration_path: null,
  },
  {
    id: "kid-max",
    name: "Max",
    age: 4,
    age_months: 0,
    gender: "boy",
    appearance: {},
    personality_tags: ["brave"],
    toy: { name: "Rocket" },
    reference_image_path: "illustrations/max.jpg",
    reference_image_url: "https://example.com/max.jpg",
    combined_reference_path: null,
    character_illustration_path: null,
  },
]

const storyTypes = [
  {
    id: "bedtime",
    name: "Bedtime",
    description: "A gentle bedtime story",
    occasion_required: false,
    extra_input_label: null,
    extra_input_hint: null,
  },
]

const artStyles = [{ id: "watercolor", name: "Watercolor" }]

function profile(index: number) {
  return {
    id: `kid-${index}`,
    name: `Kid ${index}`,
    age: 6,
    age_months: 0,
    gender: "girl",
    appearance: {},
    personality_tags: ["curious"],
    toy: { name: `Toy ${index}` },
    reference_image_path: `illustrations/kid-${index}.jpg`,
    reference_image_url: `https://example.com/kid-${index}.jpg`,
    combined_reference_path: null,
    character_illustration_path: null,
  }
}

function getImageProviderRadio(value: string): HTMLInputElement {
  const input = screen
    .getAllByDisplayValue(value)
    .find((element) => element.getAttribute("name") === "image-provider")
  if (!input) throw new Error(`Missing image provider radio ${value}`)
  return input as HTMLInputElement
}

describe("StoryGenerationTab image providers", () => {
  it("disables single-image Kontext for multiple profiles while keeping OpenAI and Gemini selectable", async () => {
    const user = userEvent.setup()
    render(<StoryGenerationTab profiles={profiles} storyTypes={storyTypes} artStyles={artStyles} />)

    await user.click(screen.getByLabelText(/Luna/))
    await user.click(screen.getByLabelText(/Max/))

    expect(getImageProviderRadio("fal-kontext")).toBeDisabled()
    expect(getImageProviderRadio("fal-kontext-multi")).toBeEnabled()
    expect(getImageProviderRadio("fal-nano-banana-2")).toBeEnabled()
    expect(getImageProviderRadio("fal-kling-o1")).toBeEnabled()
    expect(getImageProviderRadio("openai")).toBeEnabled()
    expect(getImageProviderRadio("gemini")).toBeEnabled()
    expect(screen.getByText("Some providers are unavailable for the current profile count.")).toBeInTheDocument()
  })

  it("disables providers whose max reference count is exceeded", async () => {
    const user = userEvent.setup()
    render(<StoryGenerationTab profiles={Array.from({ length: 15 }, (_, index) => profile(index + 1))} storyTypes={storyTypes} artStyles={artStyles} />)

    for (const checkbox of screen.getAllByRole("checkbox")) {
      await user.click(checkbox)
    }

    expect(getImageProviderRadio("fal-kontext")).toBeDisabled()
    expect(getImageProviderRadio("fal-kontext-multi")).toBeEnabled()
    expect(getImageProviderRadio("fal-nano-banana-2")).toBeDisabled()
    expect(getImageProviderRadio("fal-kling-o1")).toBeDisabled()
    expect(getImageProviderRadio("openai")).toBeEnabled()
    expect(getImageProviderRadio("gemini")).toBeDisabled()
  })
})
