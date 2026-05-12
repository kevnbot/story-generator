import { render, screen } from "@testing-library/react"
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

  it("shows admin link for platform admins", () => {
    render(<Nav userName={null} credits={5} isAdmin />)

    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin")
  })
})
