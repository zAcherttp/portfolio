import { expect, test } from "@playwright/test";

async function activeTheme(page: import("@playwright/test").Page) {
  const status = page.getByRole("status");
  await expect(status).toContainText(/Active theme: (light|dark)/);
  const theme = (await status.textContent())?.replace("Active theme: ", "");
  if (theme !== "light" && theme !== "dark") {
    throw new Error(`Unexpected active theme: ${theme ?? "missing"}`);
  }
  return theme;
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
    await expect(page.getByRole("status")).toHaveText(
      `Active theme: ${toggled}`,
    );
  });

  test("does not toggle while typing in an input", async ({ page }) => {
    await page.goto("/dev/components/theme-hotkey?case=input");
    const initial = await activeTheme(page);

    await page
      .getByPlaceholder("Type here without toggling the theme")
      .fill("d");
    await expect(page.getByRole("status")).toHaveText(
      `Active theme: ${initial}`,
    );
  });

  test("coalesces rapid key events and reopens after the throttle window", async ({
    page,
  }) => {
    await page.goto("/dev/components/theme-hotkey?case=rapid");
    const initial = await activeTheme(page);
    const toggled = initial === "dark" ? "light" : "dark";
    const status = page.getByRole("status");

    await page.evaluate(() => {
      for (let index = 0; index < 8; index += 1) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            code: "KeyD",
            key: "d",
          }),
        );
      }
    });
    await expect(status).toHaveText(`Active theme: ${toggled}`);

    await expect
      .poll(
        async () => {
          await page.evaluate(() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", {
                bubbles: true,
                code: "KeyD",
                key: "d",
              }),
            );
          });
          return status.textContent();
        },
        { intervals: [10, 10, 10, 10, 10], timeout: 250 },
      )
      .toBe(`Active theme: ${initial}`);
  });

  test("ignores synthetic Telex key events without a physical code", async ({
    page,
  }) => {
    await page.goto("/dev/components/theme-hotkey");
    const initial = await activeTheme(page);

    await page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "", key: "d" }),
      );
    });

    await expect(page.getByRole("status")).toHaveText(
      `Active theme: ${initial}`,
    );
  });
});
