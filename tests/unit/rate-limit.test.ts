import { afterEach, describe, expect, it, vi } from "vitest"

describe("rate-limit helpers", () => {
  afterEach(() => {
    vi.resetModules()
  })

  it("allows requests locally when Redis env vars are missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")

    const { checkStoryRateLimit, checkSmsRateLimit } = await import("@/lib/rate-limit")

    await expect(checkStoryRateLimit("user-1")).resolves.toEqual({ allowed: true, remaining: 999 })
    await expect(checkSmsRateLimit("user-1")).resolves.toEqual({ allowed: true, remaining: 999 })
  })
})
