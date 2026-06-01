import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import PromptViewer from "@/components/admin/PromptViewer"
import type { Story } from "@/types"

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: "story-1",
    account_id: "account-1",
    user_id: "user-1",
    kid_profile_id: "kid-luna",
    story_template_id: "template-1",
    job_id: "job-1",
    parent_story_id: null,
    version_number: 1,
    has_images: false,
    title: "Moon Adventure",
    content: "Once upon a moon.",
    images: [],
    generation_params: {
      kid_profile_id: "kid-luna",
      kid_profile_ids: ["kid-luna"],
      kid_names: ["Luna"],
      story_template_id: "template-1",
      prompt_summary: "Luna",
      system_prompt: "System prompt",
      user_prompt: "User prompt",
      image_prompt: "",
      model: "claude-sonnet-4-6",
      image_model: "",
    },
    credits_used: 1,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("PromptViewer", () => {
  it("shows a workbench link for each story without nesting it in the expand button", async () => {
    const user = userEvent.setup()
    render(<PromptViewer stories={[story()]} />)

    const link = screen.getByRole("link", { name: /view in workbench/i })
    expect(link).toHaveAttribute("href", "/admin/workbench?storyId=story-1")

    await user.click(screen.getByRole("button", { name: /moon adventure/i }))

    expect(screen.getByText("System Prompt")).toBeInTheDocument()
    expect(screen.getByText("User Prompt")).toBeInTheDocument()
  })
})
