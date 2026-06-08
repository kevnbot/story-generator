import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/profiles", () => ({
  createProfile: vi.fn(async (_prev: string | null, formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim()
    const age = Number.parseInt(String(formData.get("age") ?? "0"), 10)
    const months = Number.parseInt(String(formData.get("age_months") ?? "0"), 10)

    if (!name) return "Name is required"
    if (Number.isNaN(age) || age < 0 || age > 17) return "Age must be between 0 and 17"
    if (Number.isNaN(months) || months < 0 || months > 11) return "Months must be between 0 and 11"
    return null
  }),
  updateProfile: vi.fn(async () => null),
}))

import { ProfileForm } from "@/components/profiles/profile-form"

describe("ProfileForm", () => {
  it("renders required profile fields", () => {
    render(<ProfileForm />)

    expect(screen.getByLabelText("Child's name")).toBeRequired()
    expect(screen.getByLabelText("Years")).toHaveAttribute("max", "17")
    expect(screen.getByLabelText("Months")).toHaveAttribute("max", "11")
    expect(screen.getByRole("button", { name: "Add Profile" })).toBeEnabled()
  })

  it("renders existing profile values for edit flows", () => {
    render(
      <ProfileForm
        profile={{
          id: "kid-luna",
          name: "Luna",
          age: 6,
          age_months: 3,
          gender: "girl",
          appearance: { hair: "curly brown", eye_color: "green", skin_tone: "warm brown" },
          personality_tags: ["curious"],
          toy: { name: "Moon Bear", description: "a silver stuffed bear" },
        }}
      />
    )

    expect(screen.getByLabelText("Child's name")).toHaveValue("Luna")
    expect(screen.getByLabelText("Years")).toHaveValue(6)
    expect(screen.getByLabelText("Months")).toHaveValue(3)
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled()
  })
})
