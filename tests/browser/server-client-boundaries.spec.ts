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
