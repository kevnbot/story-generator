import { describe, expect, it } from "vitest"
import { buildFalRequest, buildKlingReferencePrompt } from "@/lib/ai/providers/image/fal"

describe("fal image provider request builder", () => {
  it("builds single-reference Kontext requests with image_url", () => {
    const request = buildFalRequest("fal-kontext", "paint page one", {
      referenceImageUrl: "https://example.com/luna.png",
      seed: 123,
    })

    expect(request).toMatchObject({
      model: "fal-ai/flux-pro/kontext",
      referenceImageCount: 1,
      body: {
        prompt: "paint page one",
        image_url: "https://example.com/luna.png",
        seed: 123,
      },
    })
    expect("body" in request ? request.body : {}).not.toHaveProperty("image_urls")
  })

  it("builds multi-reference Kontext requests with image_urls", () => {
    const request = buildFalRequest("fal-kontext-multi", "paint page two", {
      referenceImageUrls: ["https://example.com/luna.png", "https://example.com/max.png"],
    })

    expect(request).toMatchObject({
      model: "fal-ai/flux-pro/kontext/multi",
      referenceImageCount: 2,
      body: {
        prompt: "paint page two",
        image_urls: ["https://example.com/luna.png", "https://example.com/max.png"],
      },
    })
    expect("body" in request ? request.body : {}).not.toHaveProperty("image_url")
  })

  it("enforces Nano Banana 2 and Kling reference limits", () => {
    const fifteenUrls = Array.from({ length: 15 }, (_, index) => `https://example.com/${index}.png`)
    const elevenUrls = fifteenUrls.slice(0, 11)

    expect(buildFalRequest("fal-nano-banana-2", "paint", { referenceImageUrls: fifteenUrls })).toMatchObject({
      error: "Nano Banana 2 Edit supports at most 14 reference images; received 15.",
      referenceImageCount: 15,
    })
    expect(buildFalRequest("fal-kling-o1", "paint", { referenceImageUrls: elevenUrls })).toMatchObject({
      error: "Kling O1 Image supports at most 10 reference images; received 11.",
      referenceImageCount: 11,
    })
  })

  it("adds Kling @Image labels when the prompt does not already include them", () => {
    expect(buildKlingReferencePrompt("paint the bedtime page", ["Luna", "Max"])).toBe(
      "@Image1 is Luna. @Image2 is Max. Preserve each referenced person's identity and use the matching reference image for their appearance. paint the bedtime page"
    )
    expect(buildKlingReferencePrompt("Keep @Image1 consistent", ["Luna"])).toBe("Keep @Image1 consistent")
  })
})
