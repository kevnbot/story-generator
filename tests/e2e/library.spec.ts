import { expect, test } from "@playwright/test"

test("library filters and sorting work with fixture stories", async ({ page }) => {
  await page.goto("/test-harness/library")

  await expect(page.getByText("3 stories")).toBeVisible()
  await page.getByLabel("All kids").selectOption("kid-max")

  await expect(page.getByText("1 story of 3")).toBeVisible()
  await expect(page.getByText("Max Rocket Race")).toBeVisible()
  await expect(page.getByText("Luna Moon Mission")).toHaveCount(0)

  await page.getByRole("button", { name: "Clear" }).click()
  await page.getByLabel("Sort stories").selectOption("title_asc")

  const titles = page.locator("a[href^='/library/'] p.font-serif")
  await expect(titles.first()).toContainText("Garden Door")
})
