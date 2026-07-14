import { expect, test } from "@playwright/test";

test.describe("server and client page boundaries", () => {
  test("renders the server homepage around its interactive islands", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Tuấn Phát" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bookmarks" }),
    ).toBeVisible();
    await expect(
      page.getByText("Recent Design", { exact: true }),
    ).toBeVisible();
  });

  test("filters projects inside the client list", async ({ page }) => {
    await page.goto("/projects");

    await expect(page.locator("h3")).toHaveCount(9);
    await page.getByRole("button", { name: "PowerShell" }).click();

    await expect(page.locator("h3")).toHaveCount(1);
    await expect(page.getByText("next-wms", { exact: true })).toBeVisible();
    await expect(page.getByText("miniclaw", { exact: true })).toHaveCount(0);
  });

  test("filters bookmarks inside the client list", async ({ page }) => {
    await page.goto("/bookmarks");

    await page.getByRole("button", { name: "Resources" }).click();

    await expect(
      page.getByText("Animations.dev", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Linear", { exact: true })).toHaveCount(0);
  });

  test("keeps generic bookmark hover instant while its arrow animates", async ({
    page,
  }) => {
    await page.goto("/bookmarks");

    const bookmarkRow = page
      .getByText("Linear", { exact: true })
      .locator("xpath=ancestor::a[1]");
    const arrow = bookmarkRow.locator("[data-rotating-arrow]");

    await expect(bookmarkRow).not.toHaveCSS("transition-duration", "0s");
    await expect(arrow).not.toHaveCSS("transition-duration", "0s");

    await bookmarkRow.hover();

    await expect(bookmarkRow).toHaveCSS("transition-duration", "0s");
    await expect(arrow).not.toHaveCSS("transition-duration", "0s");
  });

  test("keeps the see-all favicon cascade readable", async ({ page }) => {
    await page.goto("/");

    const reveal = page.locator("[data-see-all-reveal]").first();
    const lastItem = reveal.locator("[data-reveal-item]").last();

    await reveal.hover();
    await page.waitForTimeout(120);

    expect(
      await lastItem.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).opacity),
      ),
    ).toBeLessThan(0.1);
    await expect(lastItem).toHaveCSS("opacity", "1", { timeout: 700 });
  });

  test("preserves browser-history back navigation", async ({ page }) => {
    await page.goto("/");
    await page.goto("/projects");
    await page.getByRole("button", { name: "Back" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "Tuấn Phát" }),
    ).toBeVisible();
  });
});
