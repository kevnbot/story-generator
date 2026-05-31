import { expect, test } from "@playwright/test"

test("story generator handles a mocked streamed success response", async ({ page }) => {
  await page.route("**/api/generate-story", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: [
        JSON.stringify({ type: "status", message: "Writing" }),
        JSON.stringify({ type: "done", storyId: "story-123", title: "Rocket Bedtime", hasImages: false }),
        "",
      ].join("\n"),
    })
  })

  await page.goto("/test-harness/generate")
  await page.getByRole("button", { name: /Medium/ }).click()
  await page.getByLabel(/Title/).fill("Rocket Bedtime")
  await page.getByLabel("What should the story be about?").fill("a rocket bedtime race")
  await page.getByRole("button", { name: "✦ Grant my wishes" }).click()

  await expect(page.getByRole("heading", { name: "Rocket Bedtime" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Read Story" })).toHaveAttribute("href", "/library/story-123")
})

test("story generator shows mocked API errors", async ({ page }) => {
  await page.route("**/api/generate-story", async (route) => {
    await route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({ error: "Insufficient credits" }),
    })
  })

  await page.goto("/test-harness/generate")
  await page.getByRole("button", { name: "✦ Grant my wishes" }).click()

  await expect(page.getByText("Not enough wishes")).toBeVisible()
})
