import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const mocks = vi.hoisted(() => {
  const calls: Array<{ table: string; action: string; payload?: unknown; filters: Array<[string, unknown]> }> = []
  const defaultProfiles = [
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
      reference_image_path: "illustrations/luna.jpg",
      reference_image_url: null,
      combined_reference_path: null,
      character_illustration_path: null,
      deleted_at: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    },
  ]
  const state = {
    creditBalance: 10,
    profiles: [...defaultProfiles],
    imageKeyAvailable: false,
    signedUrlMissingPaths: new Set<string>(),
  }
  const imageProvider = {
    id: "fal-kontext-multi",
    label: "FLUX Pro Kontext Multi",
    modelId: "fal-ai/flux-pro/kontext/multi",
    supportsReferenceImages: true,
    referenceMode: "multi",
    maxReferenceImages: null,
    supportsSeedControl: true,
    generateImage: vi.fn(),
  }

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
          data: state.profiles,
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
      if (this.table === "story_types") {
        return {
          data: {
            id: "bedtime",
            name: "Bedtime Story",
            system_prompt_suffix: "This is a bedtime story.",
            structure_template: "A gentle arc ending in sleep.",
            page_guidance: { first: "Set the scene.", middle: "Gentle adventure.", last: "Fall asleep." },
            extra_input_label: null,
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
    defaultProfiles,
    imageProvider,
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

vi.mock("@/lib/ai/providers/image/registry", () => ({
  getImageProvider: vi.fn(() => mocks.imageProvider),
  isImageProviderKeyAvailable: vi.fn(() => mocks.state.imageKeyAvailable),
}))

vi.mock("@/lib/storage/images", () => ({
  buildStoryImagePath: vi.fn((_accountId: string, _jobId: string, sceneIndex: number, extension: string) => `story-${sceneIndex}.${extension}`),
  copyRemoteImageToStoragePath: vi.fn(async () => null),
  createSignedImageUrlsMap: vi.fn(async (_service: unknown, paths: string[]) =>
    new Map(paths
      .filter((path) => !mocks.state.signedUrlMissingPaths.has(path))
      .map((path) => [path, `https://signed.local/${path}`]))
  ),
}))

vi.mock("@/lib/ai/story", () => ({
  extractStoryTitle: vi.fn(async () => "Fallback Title"),
  extractStoryVisuals: vi.fn(),
  generateStoryStream: mocks.generateStoryStream,
  splitStoryPages: vi.fn((content: string) => [content]),
}))

vi.mock("@/lib/ai/prompt-builder/visual-context", () => ({
  extractVisualContext: vi.fn(async () => ({
    result: {
      setting: "",
      timeOfDay: "evening",
      recurringElements: [],
      outfits: {},
      storyCharacters: [],
      pageScenes: [],
    },
  })),
}))

async function readResponseText(response: Response) {
  return response.text()
}

describe("POST /api/generate-story", () => {
  beforeEach(() => {
    mocks.calls.length = 0
    mocks.state.creditBalance = 10
    mocks.state.profiles = [...mocks.defaultProfiles]
    mocks.state.imageKeyAvailable = false
    mocks.state.signedUrlMissingPaths.clear()
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.checkStoryRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
    mocks.imageProvider.generateImage.mockResolvedValue({
      url: "https://generated.local/story-image.png",
      error: null,
      isBlackImage: false,
      attempts: 1,
      modelId: "fal-ai/flux-pro/kontext/multi",
      referenceImageCount: 2,
    })
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
        body: JSON.stringify({ profileIds: ["kid-luna"], storyLength: "short", storyDescription: "moon bedtime", storyTypeId: "bedtime" }),
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

  it("passes all selected profile references to the multi-reference image provider", async () => {
    mocks.state.imageKeyAvailable = true
    mocks.state.profiles = [
      {
        ...mocks.defaultProfiles[0],
        id: "kid-luna",
        name: "Luna",
        reference_image_path: "illustrations/luna.jpg",
      },
      {
        ...mocks.defaultProfiles[0],
        id: "kid-max",
        name: "Max",
        gender: "boy",
        reference_image_path: null,
        character_illustration_path: "illustrations/max-character.jpg",
      },
      {
        ...mocks.defaultProfiles[0],
        id: "kid-ava",
        name: "Ava",
        gender: "girl",
        reference_image_path: null,
        character_illustration_path: "illustrations/ava-character.jpg",
      },
    ]
    const { POST } = await import("@/app/api/generate-story/route")

    const response = await POST(
      new Request("http://test.local/api/generate-story", {
        method: "POST",
        body: JSON.stringify({
          profileIds: ["kid-luna", "kid-max", "kid-ava"],
          storyLength: "short",
          storyTypeId: "bedtime",
          includeImages: true,
        }),
      }) as NextRequest
    )
    const text = await readResponseText(response)

    expect(response.status).toBe(200)
    expect(text).toContain('"type":"done"')
    expect(mocks.imageProvider.generateImage).toHaveBeenCalled()
    expect(mocks.imageProvider.generateImage.mock.calls[0][1]).toMatchObject({
      referenceImageUrl: "https://signed.local/illustrations/luna.jpg",
      referenceImageUrls: [
        "https://signed.local/illustrations/luna.jpg",
        "https://signed.local/illustrations/max-character.jpg",
        "https://signed.local/illustrations/ava-character.jpg",
      ],
      referenceImageLabels: [
        "Luna",
        "Max",
        "Ava",
      ],
    })
  })

  it("fails before generation when no profile reference images can be resolved", async () => {
    mocks.state.imageKeyAvailable = true
    mocks.state.profiles = [
      {
        ...mocks.defaultProfiles[0],
        id: "kid-luna",
        name: "Luna",
        reference_image_path: "illustrations/luna.jpg",
      },
      {
        ...mocks.defaultProfiles[0],
        id: "kid-max",
        name: "Max",
        reference_image_path: "illustrations/max.jpg",
      },
    ]
    mocks.state.signedUrlMissingPaths.add("illustrations/luna.jpg")
    mocks.state.signedUrlMissingPaths.add("illustrations/max.jpg")
    const { POST } = await import("@/app/api/generate-story/route")

    const response = await POST(
      new Request("http://test.local/api/generate-story", {
        method: "POST",
        body: JSON.stringify({
          profileIds: ["kid-luna", "kid-max"],
          storyLength: "short",
          storyTypeId: "bedtime",
          includeImages: true,
        }),
      }) as NextRequest
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Reference images could not be resolved for the selected profiles.",
    })
    expect(mocks.generateStoryStream).not.toHaveBeenCalled()
    expect(mocks.calls).not.toContainEqual(
      expect.objectContaining({
        table: "generation_jobs",
        action: "insert",
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
        body: JSON.stringify({ profileIds: ["kid-luna"], storyLength: "short", storyTypeId: "bedtime" }),
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
