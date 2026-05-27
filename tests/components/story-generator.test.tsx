import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { StoryGenerator } from "@/components/generate/story-generator"

const profiles = [
  { id: "kid-luna", name: "Luna", age: 6, age_months: 3, reference_image_path: "/illustrations/luna.jpg" },
  { id: "kid-max", name: "Max", age: 4, age_months: 0, reference_image_path: "/illustrations/max.jpg" },
]

const artStyles = [{ id: "watercolor", name: "Watercolor" }]

function streamResponse(lines: object[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
        }
        controller.close()
      },
    }),
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  )
}

describe("StoryGenerator", () => {
  it("shows an empty state when no profiles exist", () => {
    render(<StoryGenerator profiles={[]} artStyles={[]} credits={1} imagesAvailable={false} />)

    expect(screen.getByRole("heading", { name: "Add a kid profile first" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Add Profile" })).toHaveAttribute("href", "/profiles")
  })

  it("disables generation when credits are insufficient", async () => {
    const user = userEvent.setup()
    render(<StoryGenerator profiles={profiles} artStyles={artStyles} credits={1} imagesAvailable={true} />)

    await user.click(screen.getByRole("switch", { name: "Include images" }))

    expect(screen.getByText("Not enough credits. You have 1.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate Story" })).toBeDisabled()
  })

  it("sends selected values and handles a successful streamed response", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      streamResponse([
        { type: "status", message: "Writing" },
        { type: "done", storyId: "story-123", title: "Rocket Bedtime", hasImages: false },
      ])
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<StoryGenerator profiles={profiles} artStyles={artStyles} credits={8} imagesAvailable={true} />)

    await user.click(screen.getByRole("button", { name: /Medium/ }))
    await user.type(screen.getByLabelText(/Title/), "Rocket Bedtime")
    await user.type(screen.getByLabelText("What should the story be about?"), "a rocket bedtime race")
    await user.click(screen.getByRole("button", { name: "Generate Story" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Rocket Bedtime" })).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate-story",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      })
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      profileIds: ["kid-luna", "kid-max"],
      artStyleId: "watercolor",
      storyLength: "medium",
      storyDescription: "a rocket bedtime race",
      customTitle: "Rocket Bedtime",
      includeImages: false,
    })
    expect(screen.getByRole("link", { name: "Read Story" })).toHaveAttribute("href", "/library/story-123")
  })

  it("shows API errors", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 }))
    )

    render(<StoryGenerator profiles={profiles} artStyles={artStyles} credits={8} imagesAvailable={false} />)

    await user.click(screen.getByRole("button", { name: "Generate Story" }))

    expect(await screen.findByText("Insufficient credits")).toBeInTheDocument()
  })
})
