import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Nav } from "@/components/dashboard/nav"

vi.mock("@/app/actions/auth", () => ({
  logout: vi.fn(),
}))

describe("Nav", () => {
  it("hides admin link for non-admin users", () => {
    render(<Nav userName={null} credits={5} isAdmin={false} />)

    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument()
  })

  it("shows admin link for platform admins", async () => {
    const user = userEvent.setup()
    render(<Nav userName={null} credits={5} isAdmin />)

    await user.click(screen.getByRole("button", { name: /account menu/i }))

    expect(screen.getByRole("menuitem", { name: /admin/i })).toHaveAttribute("href", "/admin")
  })
})
