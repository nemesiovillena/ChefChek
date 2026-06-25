import { test, expect } from "@playwright/test";

/**
 * Smoke: an unauthenticated visit to /dashboard is redirected to /login by the
 * client-side auth guard in the dashboard layout. No backend needed.
 */
test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "Iniciar Sesión" }),
  ).toBeVisible();
});
