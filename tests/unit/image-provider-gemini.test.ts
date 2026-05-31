import { beforeEach, describe, expect, it, vi } from "vitest"
import { geminiProvider } from "@/lib/ai/providers/image/gemini"

const outputBase64 = Buffer.alloc(6000, 1).toString("base64")
const inputBytes = new Uint8Array([1, 2, 3, 4])

describe("Gemini image provider", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
  })

  it("sends prompt plus all reference images as inline parts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).startsWith("https://refs.example.com/")) {
        return new Response(inputBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        })
      }
      return new Response(
        JSON.stringify({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: outputBase64 } }],
            },
          }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    })

    const result = await geminiProvider.generateImage("paint the page", {
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

    expect(result).toMatchObject({
      url: `data:image/png;base64,${outputBase64}`,
      error: null,
      isBlackImage: false,
      attempts: 1,
      modelId: "gemini-3-pro-image-preview",
      referenceImageCount: 3,
    })

    const apiCall = fetchMock.mock.calls.find(([url]) => String(url).includes(":generateContent"))
    expect(apiCall).toBeDefined()
    const body = JSON.parse(String(apiCall?.[1]?.body))
    expect(body.contents[0].parts).toHaveLength(4)
    expect(body.contents[0].parts[0].text).toContain("Reference image 3 is Ava's profile reference.")
    expect(body.contents[0].parts.slice(1)).toEqual([
      { inline_data: { mime_type: "image/png", data: Buffer.from(inputBytes).toString("base64") } },
      { inline_data: { mime_type: "image/png", data: Buffer.from(inputBytes).toString("base64") } },
      { inline_data: { mime_type: "image/png", data: Buffer.from(inputBytes).toString("base64") } },
    ])
    expect(body.generationConfig.responseModalities).toEqual(["Image"])
  })
})
