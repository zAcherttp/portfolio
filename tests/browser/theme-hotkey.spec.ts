import { expect, test } from "@playwright/test";

async function activeTheme(page: import("@playwright/test").Page) {
  const status = page.getByRole("status");
  await expect(status).toContainText(/Active theme: (light|dark)/);
  return (await status.textContent())?.replace("Active theme: ", "");
}

test.describe("theme hotkey", () => {
  test("toggles with D and persists the selected theme", async ({ page }) => {
    await page.goto("/dev/components/theme-hotkey");
    const initial = await activeTheme(page);

    await page.keyboard.press("D");
    const toggled = initial === "dark" ? "light" : "dark";
    await expect(page.getByRole("status")).toHaveText(
      `Active theme: ${toggled}`,
    );

    await page.reload();
    expect(await activeTheme(page)).toBe(toggled);
  });

  test("does not toggle while typing in an input", async ({ page }) => {
    await page.goto("/dev/components/theme-hotkey?case=input");
    const initial = await activeTheme(page);

    await page
      .getByPlaceholder("Type here without toggling the theme")
      .fill("d");
    expect(await activeTheme(page)).toBe(initial);
  });

  test("throttles rapid key events to the 50 ms contract", async ({ page }) => {
    await page.goto("/dev/components/theme-hotkey?case=rapid");
    await activeTheme(page);

    const toggleTimes = await page.evaluate(async () => {
      const times: number[] = [];
      const observer = new MutationObserver(() =>
        times.push(performance.now()),
      );
      observer.observe(document.documentElement, {
        attributeFilter: ["class"],
        attributes: true,
      });

      for (let index = 0; index < 8; index += 1) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            code: "KeyD",
            key: "d",
          }),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 130));
      observer.disconnect();
      return times;
    });

    expect(toggleTimes.length).toBeGreaterThan(0);
    for (let index = 1; index < toggleTimes.length; index += 1) {
      expect(
        toggleTimes[index] - toggleTimes[index - 1],
      ).toBeGreaterThanOrEqual(45);
    }
  });
});
