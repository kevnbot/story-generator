import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildProfileReferenceImagePath,
  buildStoryImagePath,
  copyRemoteImageToStoragePath,
  resolveStoryImagesForUi,
} from "@/lib/storage/images"

describe("storage image helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("builds stable storage paths", () => {
    expect(buildProfileReferenceImagePath("acct", "kid", "png", 123)).toBe(
      "accounts/acct/profiles/kid/reference/123.png"
    )

    expect(buildStoryImagePath("acct", "story", 2, "jpg", 456)).toBe(
      "accounts/acct/stories/story/456-scene-3.jpg"
    )
  })

  it("copies a remote image into storage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    )

    const upload = vi.fn(async () => ({ error: null }))
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload,
        })),
      },
    } as unknown as Parameters<typeof copyRemoteImageToStoragePath>[0]["supabase"]

    const path = await copyRemoteImageToStoragePath({
      supabase,
      sourceUrl: "https://cdn.example.com/image.png",
      buildPath: (extension) => `some/path/file.${extension}`,
    })

    expect(path).toBe("some/path/file.png")
    expect(upload).toHaveBeenCalledWith(
      "some/path/file.png",
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: "image/png", upsert: true })
    )
  })

  it("copies a data URI image into storage", async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload,
        })),
      },
    } as unknown as Parameters<typeof copyRemoteImageToStoragePath>[0]["supabase"]

    const sourceUrl = `data:image/png;base64,${Buffer.from([1, 2, 3, 4]).toString("base64")}`
    const path = await copyRemoteImageToStoragePath({
      supabase,
      sourceUrl,
      buildPath: (extension) => `some/path/file.${extension}`,
    })

    expect(path).toBe("some/path/file.png")
    expect(upload).toHaveBeenCalledWith(
      "some/path/file.png",
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: "image/png", upsert: true })
    )
  })

  it("returns null when remote content is not an image", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not an image", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    )

    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
        })),
      },
    } as unknown as Parameters<typeof copyRemoteImageToStoragePath>[0]["supabase"]

    const path = await copyRemoteImageToStoragePath({
      supabase,
      sourceUrl: "https://cdn.example.com/file.txt",
      buildPath: () => "unused",
    })

    expect(path).toBeNull()
  })

  it("returns null when storage upload fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/webp" },
      })
    )

    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: { message: "boom", statusCode: "500" } })),
        })),
      },
    } as unknown as Parameters<typeof copyRemoteImageToStoragePath>[0]["supabase"]

    const path = await copyRemoteImageToStoragePath({
      supabase,
      sourceUrl: "https://cdn.example.com/image.webp",
      buildPath: () => "file.webp",
    })

    expect(path).toBeNull()
  })

  it("resolves image URLs by path first, then legacy URL fallback", () => {
    const resolved = resolveStoryImagesForUi(
      [
        { path: "a/1.png", url: "https://legacy.example.com/1.png", caption: null, scene_index: 0 },
        { url: "https://legacy.example.com/2.png", caption: null, scene_index: 1 },
        { path: "missing/3.png", caption: null, scene_index: 2 },
      ],
      new Map([["a/1.png", "https://signed.example.com/1"]])
    )

    expect(resolved).toEqual([
      { path: "a/1.png", url: "https://signed.example.com/1", caption: null, scene_index: 0 },
      { url: "https://legacy.example.com/2.png", caption: null, scene_index: 1 },
    ])
  })
})
