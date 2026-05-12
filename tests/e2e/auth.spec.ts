import { expect, test } from "@playwright/test"

test("public auth pages render and enforce required fields", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.locator("#email")).toBeFocused()

  await page.goto("/signup")
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible()
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.locator("#name")).toBeFocused()
})

test("unauthenticated dashboard requests redirect to login", async ({ page }) => {
  await page.goto("/generate")

  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fgenerate$/)
})
