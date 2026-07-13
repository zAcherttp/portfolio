import { expect, test } from "@playwright/test";

test.describe("KBD", () => {
  test("visualizes keydown, keyup, and blur on the 60% keyboard", async ({
    page,
  }) => {
    await page.goto("/dev/components/kbd");
    const keyboard = page.getByTestId("keyboard-60");
    const key = keyboard.locator('kbd[data-key="A"]');

    await expect(keyboard).toHaveAttribute("data-ready", "true");
    await expect(key).toHaveAttribute("data-state", "idle");
    await page.keyboard.down("a");
    await expect(key).toHaveAttribute("data-state", "pressed");
    await page.keyboard.up("a");
    await expect(key).toHaveAttribute("data-state", "idle");

    await page.keyboard.down("a");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(key).toHaveAttribute("data-state", "idle");
    await page.keyboard.up("a");
  });

  test("keeps inert and controlled KBD states independent", async ({
    page,
  }) => {
    await page.goto("/dev/components/kbd?case=states");
    const idle = page.getByTestId("kbd-idle");
    const controlled = page.getByTestId("kbd-controlled");
    const reactive = page.getByTestId("kbd-reactive");

    await expect(page.getByTestId("kbd-states")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(idle).toHaveAttribute("data-state", "idle");
    await expect(controlled).toHaveAttribute("data-state", "pressed");
    await page.keyboard.down("d");
    await expect(reactive).toHaveAttribute("data-state", "pressed");
    await expect(idle).toHaveAttribute("data-state", "idle");
    await page.keyboard.up("d");
    await expect(reactive).toHaveAttribute("data-state", "idle");
  });

  test("keeps the keyboard inspectable on a narrow viewport", async ({
    page,
  }) => {
    await page.goto("/dev/components/kbd");
    const keyboard = page.getByTestId("keyboard-60");
    const dimensions = await keyboard.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeGreaterThanOrEqual(
      dimensions.clientWidth,
    );
    await expect(keyboard.locator("kbd").first()).toBeVisible();
  });
});
