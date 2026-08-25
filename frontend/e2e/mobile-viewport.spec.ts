import { test, expect } from "@playwright/test";

/**
 * Regression (móvil): el dashboard debe cargarse sin desbordamiento
 * horizontal y sin quedar zoomeado tras el login.
 *
 * 1) iOS Safari auto-zoomea al enfocar un control con font-size < 16px y ese
 *    zoom persiste tras la navegación client-side: el login (inputs a 14px)
 *    dejaba el dashboard "desbordado" hasta que el usuario reducía con los
 *    dedos. globals.css fuerza 16px en input/select/textarea bajo 768px;
 *    aquí se verifica que ese suelo se aplica de verdad.
 * 2) El layout móvil del dashboard no debe generar scroll horizontal en
 *    pantallas estrechas.
 */
const MOCK_USER = {
  id: "u1",
  email: "auth@test.com",
  name: "Auth User",
  role: "ADMIN",
  tenantId: "t1",
};

test.describe("móvil 390px (login)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("los controles del login tienen fuente >= 16px (sin auto-zoom iOS)", async ({
    page,
  }) => {
    await page.goto("/login");

    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input, select, textarea")).map((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
    );

    expect(sizes.length).toBeGreaterThan(0);
    // Si algún control baja de 16px, iOS zoomea al enfocarlo y ese zoom
    // acompaña al dashboard tras el login.
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(16);
    }
  });
});

test.describe("móvil 360px (dashboard)", () => {
  test.use({ viewport: { width: 360, height: 844 } });

  test("el dashboard no desborda horizontalmente", async ({ page }) => {
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

    await page.goto("/login");
    await page.evaluate((u) => {
      localStorage.setItem("session_id", "sess-1");
      localStorage.setItem("tenant_slug", "authtest");
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("tenant_id", u.tenantId);
    }, MOCK_USER);
    await page.goto("/dashboard");

    await expect(page.getByText("Tareas de Prep. Próximas").first()).toBeVisible();
    await page.waitForTimeout(300);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
