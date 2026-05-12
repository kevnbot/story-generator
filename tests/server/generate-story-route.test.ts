import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const mocks = vi.hoisted(() => {
  const calls: Array<{ table: string; action: string; payload?: unknown; filters: Array<[string, unknown]> }> = []
  const state = { creditBalance: 10 }

  class Query {
    private filters: Array<[string, unknown]> = []
    private action = "select"
    private payload: unknown

    constructor(private readonly table: string) {}

    select() { return this }
    order() { return this }
    limit() { return this }
    in(column: string, value: unknown) { this.filters.push([column, value]); return this }
    eq(column: string, value: unknown) { this.filters.push([column, value]); return this }
    is(column: string, value: unknown) { this.filters.push([column, value]); return this }
    insert(payload: unknown) { this.action = "insert"; this.payload = payload; return this }
    update(payload: unknown) { this.action = "update"; this.payload = payload; return this }
    maybeSingle() { return Promise.resolve(this.resolve()) }
    single() { return Promise.resolve(this.resolve()) }
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(this.resolve()).then(onfulfilled, onrejected)
    }

    private resolve() {
      calls.push({ table: this.table, action: this.action, payload: this.payload, filters: this.filters })

      if (this.table === "users") return { data: { account_id: "account-1" }, error: null }
      if (this.table === "accounts" && this.action === "select") return { data: { credit_balance: state.creditBalance }, error: null }
      if (this.table === "kid_profiles") {
        return {
          data: [
            {
              id: "kid-luna",
              account_id: "account-1",
              name: "Luna",
              age: 6,
              age_months: 0,
              gender: "girl",
              appearance: {},
              personality_tags: ["curious"],
              toy: { name: "Moon Bear" },
              prompt_summary: "Luna is curious.",
              reference_image_url: null,
              deleted_at: null,
              created_at: "2026-05-01T00:00:00.000Z",
              updated_at: "2026-05-01T00:00:00.000Z",
            },
          ],
          error: null,
        }
      }
      if (this.table === "story_templates") {
        return {
          data: {
            id: "template-1",
            system_prompt: "system",
          },
          error: null,
        }
      }
      if (this.table === "generation_jobs" && this.action === "insert") return { data: { id: "job-1" }, error: null }
      if (this.table === "stories" && this.action === "insert") return { data: { id: "story-1" }, error: null }
      return { data: null, error: null }
    }
  }

  return {
    calls,
    state,
    getUser: vi.fn(),
    checkStoryRateLimit: vi.fn(),
    generateStoryStream: vi.fn(),
    serviceClient: {
      from(table: string) {
        return new Query(table)
      },
    },
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
  createServiceClient: vi.fn(() => mocks.serviceClient),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkStoryRateLimit: mocks.checkStoryRateLimit,
}))

vi.mock("@/lib/config", () => ({
  config: {
    creditsPerStory: vi.fn(async () => 1),
  },
}))

vi.mock("@/lib/ai/image", () => ({
  applyArtStyleToReference: vi.fn(),
  generateGroupReferenceImage: vi.fn(),
  generateProfileReferenceImage: vi.fn(),
  generateStoryImageWithReference: vi.fn(),
}))

vi.mock("@/lib/ai/story", () => ({
  extractStoryTitle: vi.fn(async () => "Fallback Title"),
  extractStoryVisuals: vi.fn(),
  generateStoryStream: mocks.generateStoryStream,
  splitStoryPages: vi.fn((content: string) => [content]),
}))

async function readResponseText(response: Response) {
  return response.text()
}

describe("POST /api/generate-story", () => {
  beforeEach(() => {
    mocks.calls.length = 0
    mocks.state.creditBalance = 10
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.checkStoryRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
    mocks.generateStoryStream.mockImplementation(async function* () {
      yield "Title: Luna Moon Mission\n\nOnce upon a moon."
    })
    vi.stubEnv("FAL_KEY", "")
  })

  it("requires authentication", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const { POST } = await import("@/app/api/generate-story/route")

    const response = await POST(new Request("http://test.local/api/generate-story", { method: "POST", body: "{}" }) as NextRequest)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns insufficient credits before generation starts", async () => {
    mocks.state.creditBalance = 0
    const { POST } = await import("@/app/api/generate-story/route")

    const response = await POST(
      new Request("http://test.local/api/generate-story", {
        method: "POST",
        body: JSON.stringify({ profileIds: ["kid-luna"], storyLength: "short" }),
      }) as NextRequest
    )

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toEqual({ error: "Insufficient credits" })
    expect(mocks.generateStoryStream).not.toHaveBeenCalled()
  })

  it("scopes profile reads by account and streams successful completion", async () => {
    const { POST } = await import("@/app/api/generate-story/route")

    const response = await POST(
      new Request("http://test.local/api/generate-story", {
        method: "POST",
        body: JSON.stringify({ profileIds: ["kid-luna"], storyLength: "short", storyDescription: "moon bedtime" }),
      }) as NextRequest
    )
    const text = await readResponseText(response)

    expect(response.status).toBe(200)
    expect(text).toContain('"type":"done"')
    expect(text).toContain('"storyId":"story-1"')
    expect(mocks.calls).toContainEqual(
      expect.objectContaining({
        table: "kid_profiles",
        filters: expect.arrayContaining([
          ["account_id", "account-1"],
          ["deleted_at", null],
        ]),
      })
    )
    expect(mocks.calls).toContainEqual(
      expect.objectContaining({
        table: "accounts",
        action: "update",
        payload: { credit_balance: 9 },
      })
    )
  })

  it("marks the generation job failed when streaming throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.generateStoryStream.mockImplementation(async function* () {
      yield "partial"
      throw new Error("model failed")
    })
    const { POST } = await import("@/app/api/generate-story/route")

    const response = await POST(
      new Request("http://test.local/api/generate-story", {
        method: "POST",
        body: JSON.stringify({ profileIds: ["kid-luna"], storyLength: "short" }),
      }) as NextRequest
    )
    const text = await readResponseText(response)

    expect(text).toContain('"type":"error"')
    expect(mocks.calls).toContainEqual(
      expect.objectContaining({
        table: "generation_jobs",
        action: "update",
        payload: expect.objectContaining({ status: "failed" }),
      })
    )
  })
})
