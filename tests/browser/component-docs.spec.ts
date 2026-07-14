import { expect, test } from "@playwright/test";

test.describe("component documentation", () => {
  test("opens every documented component from the component index", async ({
    page,
  }) => {
    await page.goto("/components");

    const componentLinks = page.locator('a[href^="/components/"]');
    const hrefs = await componentLinks.evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => href !== null),
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator("article h1")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
    }
  });

  test("returns not found for an unknown component", async ({ page }) => {
    const response = await page.goto("/components/not-a-component");

    expect(response?.status()).toBe(404);
  });

  test("rotates the shared arrow when a component link is hovered", async ({
    page,
  }) => {
    await page.goto("/components");

    const componentLink = page.locator('a[href^="/components/"]').first();
    const arrow = componentLink.locator("[data-rotating-arrow]");
    const restingRotation = await arrow.evaluate(
      (element) => getComputedStyle(element).rotate,
    );

    await expect(arrow).toHaveCSS("transition-duration", "0.14s");
    await expect(arrow).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.25, 0.1, 0.25, 1)",
    );

    await componentLink.hover();

    await expect
      .poll(() => arrow.evaluate((element) => getComputedStyle(element).rotate))
      .not.toBe(restingRotation);

    await arrow.hover();
    await expect(arrow).toHaveCSS("transition-duration", "0.14s");
  });

  test("removes rotating-arrow movement for reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/components");

    const componentLink = page.locator('a[href^="/components/"]').first();
    const arrow = componentLink.locator("[data-rotating-arrow]");

    await expect(arrow).toHaveCSS("transition-duration", "0s");
  });

  test("shows focused component API props without inherited DOM attributes", async ({
    page,
  }) => {
    for (const slug of ["activity-grid", "contribution-graph"]) {
      await page.goto(`/components/${slug}`);

      const apiHeading = page.getByRole("heading", { name: "API reference" });
      const apiTable = apiHeading.locator("xpath=following-sibling::div[1]");

      await expect(apiTable.getByRole("row")).toHaveCount(13);
      await expect(
        apiTable.getByRole("cell", { name: /^defaultChecked\??$/ }),
      ).toHaveCount(0);
      await expect(
        apiTable.getByRole("cell", { name: /^className\??$/ }),
      ).toBeVisible();
      await expect(
        apiTable
          .locator('.docs-highlighted-type span[style*="--shiki-light"]')
          .first(),
      ).toBeVisible();
    }
  });

  test("switches preview and installation tabs with the keyboard", async ({
    page,
  }) => {
    await page.goto("/components/floating-tooltip");

    const exampleTabs = page.getByRole("tablist", {
      name: "Floating Tooltip example",
    });
    const previewTab = exampleTabs.getByRole("tab", { name: "Preview" });
    await previewTab.focus();
    await page.keyboard.press("ArrowRight");

    await expect(
      exampleTabs.getByRole("tab", { name: "Code" }),
    ).toHaveAttribute("aria-selected", "true");

    const installTabs = page.getByRole("tablist", {
      name: "Floating Tooltip installation method",
    });
    await expect(
      installTabs.getByRole("tab", { name: "Command" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
