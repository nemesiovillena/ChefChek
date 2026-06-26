import { test, expect } from "@playwright/test";

/**
 * Regression: after login, a hard reload (or full-reload navigation via the
 * menu's <a href> links) must restore the authenticated user instead of
 * redirecting back to /login.
 *
 * The backend /auth/validate call is mocked with page.route so no real
 * backend is required. This isolates the frontend session-restoration logic.
 */
const MOCK_USER = {
  id: "u1",
  email: "auth@test.com",
  name: "Auth User",
  role: "ADMIN",
  tenantId: "t1",
};

async function seedSession(page: import("@playwright/test").Page) {
  await page.evaluate((u) => {
    sessionStorage.setItem("session_id", "sess-1");
    sessionStorage.setItem("tenant_slug", "authtest");
    sessionStorage.setItem("user", JSON.stringify(u));
    sessionStorage.setItem("tenant_id", u.tenantId);
  }, MOCK_USER);
}

test.beforeEach(async ({ page }) => {
  // Mock validate to return the persisted user (simulates a valid backend session).
  await page.route("**/api/v1/auth/validate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { user: MOCK_USER, isValid: true },
        message: "Session is valid",
      }),
    }),
  );
  // Swallow other backend API calls (no backend running) so they don't 401.
  await page.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("/auth/validate")) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
});

test("hard reload to /dashboard keeps the session", async ({ page }) => {
  await page.goto("/login");
  await seedSession(page);

  // Hard navigation (full reload) to a protected route.
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("full-reload menu navigation keeps the session", async ({ page }) => {
  await page.goto("/login");
  await seedSession(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // The menu uses <a href> (full reload). Navigating to a module must not
  // bounce back to /login.
  await page.click('a[href="/dashboard/recipes"]');

  await expect(page).toHaveURL(/\/dashboard\/recipes/);
  await expect(page).not.toHaveURL(/\/login/);
});
