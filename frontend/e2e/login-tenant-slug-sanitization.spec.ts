import { test, expect } from "@playwright/test";

/**
 * Regression: el tenant slug tecleado/pegado en el login acaba como valor de
 * header HTTP (X-Tenant-Slug), y los headers solo admiten ISO-8859-1. Texto
 * pegado en macOS puede llegar en forma NFD (acento combinante U+0301, fuera
 * de Latin-1): si se guarda crudo en sessionStorage, todo fetch posterior
 * lanza "String contains non ISO-8859-1 code point" (p. ej. en Albaranes).
 *
 * El backend se mockea con page.route; solo se valida la lógica frontend.
 */
const MOCK_USER = {
  id: "u1",
  email: "auth@test.com",
  name: "Auth User",
  role: "ADMIN",
  tenantId: "t1",
};

// "Chefchek Démo" = «Chefchek Démo» con la tilde descompuesta (NFD).
const NFD_TYPED_SLUG = "Chefchek Démo";

async function fillLoginForm(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "auth@test.com");
  await page.fill('input[name="password"]', "secret123");
  await page.fill("#tenantSlug", NFD_TYPED_SLUG);
}

test("el slug NFD se guarda saneado tras un login correcto", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          user: MOCK_USER,
          session: {
            id: "sess-nfd-1",
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
          cookie: "",
        },
        message: "ok",
      }),
    }),
  );
  await page.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("/auth/login")) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await fillLoginForm(page);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);

  const storedSlug = await page.evaluate(() =>
    sessionStorage.getItem("tenant_slug"),
  );
  // Saneado a kebab ASCII: sin mayúsculas, espacios ni marcas combinantes.
  expect(storedSlug).toBe("chefchek-demo");
});

test("un login fallido no deja tenant_slug envenenado", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Invalid credentials" }),
    }),
  );

  await fillLoginForm(page);
  await page.click('button[type="submit"]');

  // Sigue en /login y el slug del intento fallido no queda en sessionStorage,
  // donde rompería los headers de todas las peticiones posteriores del tab.
  await expect(page).toHaveURL(/\/login/);
  const storedSlug = await page.evaluate(() =>
    sessionStorage.getItem("tenant_slug"),
  );
  expect(storedSlug).toBeNull();
});
