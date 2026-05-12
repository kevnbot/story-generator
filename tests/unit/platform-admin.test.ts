import { afterEach, describe, expect, it, vi } from "vitest"

const maybeSingleMock = vi.fn()
const isMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const eqMock = vi.fn(() => ({ is: isMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
const createServiceRoleClientMock = vi.fn(() => ({ from: fromMock }))

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}))

describe("platform admin authz", () => {
  afterEach(() => {
    maybeSingleMock.mockReset()
    fromMock.mockClear()
    selectMock.mockClear()
    eqMock.mockClear()
    isMock.mockClear()
    createServiceRoleClientMock.mockClear()
    vi.unstubAllEnvs()
  })

  it("returns true when the user has an active platform_admins row", async () => {
    maybeSingleMock.mockResolvedValue({ data: { user_id: "user-1" }, error: null })
    const { isPlatformAdmin } = await import("@/lib/auth/platform-admin")

    await expect(isPlatformAdmin("user-1")).resolves.toBe(true)
    expect(fromMock).toHaveBeenCalledWith("platform_admins")
  })

  it("returns false when no DB row exists and fallback env does not include user", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    vi.stubEnv("ADMIN_USER_IDS", "user-2,user-3")
    const { isPlatformAdmin } = await import("@/lib/auth/platform-admin")

    await expect(isPlatformAdmin("user-1")).resolves.toBe(false)
  })

  it("uses ADMIN_USER_IDS as fallback when DB lookup errors", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: "42P01", message: "missing table" } })
    vi.stubEnv("ADMIN_USER_IDS", "user-1")
    const { isPlatformAdmin } = await import("@/lib/auth/platform-admin")

    await expect(isPlatformAdmin("user-1")).resolves.toBe(true)
  })

  it("assertPlatformAdmin throws for unauthorized users", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const { assertPlatformAdmin } = await import("@/lib/auth/platform-admin")

    await expect(assertPlatformAdmin("user-1")).rejects.toThrow("FORBIDDEN_PLATFORM_ADMIN")
  })
})
