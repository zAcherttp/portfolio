import { expect, test } from "@playwright/test";

test("hydrates the theme preview with a stored dark theme", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration failed|hydration mismatch/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });

  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/components/theme-hotkey");

  await expect(
    page.getByRole("button", { name: "Toggle theme" }),
  ).toBeVisible();
  await expect(page.locator(".lucide-sun")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
