import { expect, test } from "@playwright/test";

test("features the session tools on the homepage with source links", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["session-hub", "claude-fleet", "electron-boilerplate"]) {
    const heading = page.getByRole("heading", { name, exact: true });
    await expect(heading).toBeVisible();
    await expect(
      page.getByRole("link").filter({ has: heading }),
    ).toHaveAttribute("href", `https://github.com/zAcherttp/${name}`);
  }
});

test("lists both tools and filters Session Hub by Swift", async ({ page }) => {
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "session-hub", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "claude-fleet", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Swift", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "session-hub", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "claude-fleet", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "claude-fleet", exact: true }),
  ).toBeVisible();
});
