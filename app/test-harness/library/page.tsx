import { notFound } from "next/navigation"
import StoryLibrary from "@/components/library/StoryLibrary"
import type { KidProfile, Story, StoryTemplate } from "@/types"

const profiles: KidProfile[] = [
  {
    id: "kid-luna",
    account_id: "account-1",
    name: "Luna",
    age: 6,
    age_months: 3,
    gender: "girl",
    appearance: {},
    personality_tags: [],
    toy: { name: "Moon Bear" },
    prompt_summary: "",
    reference_image_path: null,
    reference_image_url: null,
    combined_reference_path: null,
    character_illustration_path: null,
    deleted_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "kid-max",
    account_id: "account-1",
    name: "Max",
    age: 4,
    age_months: 0,
    gender: "boy",
    appearance: {},
    personality_tags: [],
    toy: { name: "Rocket" },
    prompt_summary: "",
    reference_image_path: null,
    reference_image_url: null,
    combined_reference_path: null,
    character_illustration_path: null,
    deleted_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  },
]

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
  {
    id: "template-adventure",
    name: "Adventure",
    description: "",
    system_prompt: "",
    user_prompt_template: "",
    image_prompt_template: "",
    credits_cost: 1,
    is_active: true,
    created_at: "2026-05-01T00:00:00.000Z",
  },
]

const baseStory = {
  account_id: "account-1",
  user_id: "user-1",
  job_id: null,
  parent_story_id: null,
  version_number: 1,
  has_images: false,
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
} satisfies Partial<Story>

const stories: Story[] = [
  {
    ...baseStory,
    id: "story-moon",
    kid_profile_id: "kid-luna",
    story_template_id: "template-bedtime",
    title: "Luna Moon Mission",
    content: "Luna visits the moon with a gentle bear.",
    created_at: "2026-05-08T00:00:00.000Z",
  } as Story,
  {
    ...baseStory,
    id: "story-rocket",
    kid_profile_id: "kid-max",
    story_template_id: "template-adventure",
    title: "Max Rocket Race",
    content: "Max builds a cardboard rocket and races past pillow planets.",
    created_at: "2026-05-10T00:00:00.000Z",
  } as Story,
  {
    ...baseStory,
    id: "story-garden",
    kid_profile_id: "kid-luna",
    story_template_id: "template-adventure",
    title: "Garden Door",
    content: "Luna finds a tiny door under a bright leaf.",
    created_at: "2026-05-09T00:00:00.000Z",
  } as Story,
]

export default function LibraryHarnessPage() {
  if (process.env.NEXT_PUBLIC_E2E_TEST !== "true") notFound()

  return (
    <main className="min-h-screen bg-background p-6">
      <StoryLibrary stories={stories} profiles={profiles} templates={templates} />
    </main>
  )
}
