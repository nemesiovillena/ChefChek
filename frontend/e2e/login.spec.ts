import { test, expect } from "@playwright/test";

/**
 * Smoke: the login page renders the sign-in form without a backend.
 */
test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "CHEFCHEK" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Iniciar Sesión" }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});
