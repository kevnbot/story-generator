export async function generateStoryImage(prompt: string): Promise<string | null> {
  if (!process.env.FAL_KEY) {
    console.warn("FAL_KEY not set — skipping image generation")
    return null
  }

  const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Authorization": `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_4_3",
      num_inference_steps: 4,
      num_images: 1,
    }),
  })

  if (!response.ok) {
    console.error("fal.ai error:", await response.text())
    return null
  }

  const data = await response.json()
  return data.images?.[0]?.url ?? null
}
