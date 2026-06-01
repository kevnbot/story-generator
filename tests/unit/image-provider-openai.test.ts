import { beforeEach, describe, expect, it, vi } from "vitest"
import { openaiProvider } from "@/lib/ai/providers/image/openai"

const outputBase64 = Buffer.alloc(6000, 1).toString("base64")
const inputBytes = new Uint8Array([1, 2, 3, 4])

describe("OpenAI image provider", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key")
  })

  it("parses b64_json from text-to-image generations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: outputBase64 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const result = await openaiProvider.generateImage("paint the page")

    expect(result).toMatchObject({
      url: `data:image/png;base64,${outputBase64}`,
      error: null,
      isBlackImage: false,
      attempts: 1,
      modelId: "gpt-image-2",
      referenceImageCount: 0,
      statusCode: 200,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"output_format":"png"'),
      })
    )
  })

  it("sends all reference images to the edit endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).startsWith("https://refs.example.com/")) {
        return new Response(inputBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        })
      }
      return new Response(JSON.stringify({ data: [{ b64_json: outputBase64 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    const result = await openaiProvider.generateImage("paint the page", {
      referenceImageUrls: [
        "https://refs.example.com/luna.png",
        "https://refs.example.com/max.png",
        "https://refs.example.com/ava.png",
      ],
      referenceImageLabels: [
        "Luna's profile reference",
        "Max's profile reference",
        "Ava's profile reference",
      ],
    })

    expect(result.referenceImageCount).toBe(3)
    expect(result.url).toBe(`data:image/png;base64,${outputBase64}`)

    const editCall = fetchMock.mock.calls.find(([url]) => url === "https://api.openai.com/v1/images/edits")
    expect(editCall).toBeDefined()
    const form = editCall?.[1]?.body as FormData
    const entries = Array.from(form.entries())
    expect(entries.filter(([key]) => key === "image[]")).toHaveLength(3)
    expect(entries.find(([key]) => key === "model")?.[1]).toBe("gpt-image-2")
    expect(entries.find(([key]) => key === "prompt")?.[1]).toContain("Reference image 3 is Ava's profile reference.")
  })
})
