import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the ChefChek frontend.
 * Smoke tests run against the Next.js dev server; they exercise routing and
 * the client-side auth guard, so no backend is required for the smoke suite.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    // E2E_BASE_URL permite apuntar los tests a un dev server alternativo
    // (p. ej. en un worktree) sin tocar el que corre en :3000.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
