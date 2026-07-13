import { expect, test } from "@playwright/test";

test.describe("KBD", () => {
  test("keeps the 60% layout at the default KBD scale", async ({ page }) => {
    await page.goto("/dev/components/kbd");
    const keyboard = page.getByTestId("keyboard-60");
    await expect(keyboard).toHaveAttribute("data-ready", "true");

    const dimensions = await keyboard.evaluate((element) => {
      const layout = element.firstElementChild;
      const key = element.querySelector<HTMLElement>('kbd[data-key="A"]');
      return {
        keyHeight: key?.getBoundingClientRect().height,
        keyWidth: key?.getBoundingClientRect().width,
        layoutWidth: layout?.getBoundingClientRect().width,
      };
    });

    expect(dimensions.layoutWidth).toBe(384);
    expect(dimensions.keyHeight).toBe(20);
    expect(dimensions.keyWidth).toBeGreaterThan(21);
    expect(dimensions.keyWidth).toBeLessThan(22);

    const edgeWidths = await keyboard.evaluate((element) => ({
      backspace: element
        .querySelector<HTMLElement>('kbd[data-key="Backspace"]')
        ?.getBoundingClientRect().width,
      escape: element
        .querySelector<HTMLElement>('kbd[data-key="Escape"]')
        ?.getBoundingClientRect().width,
    }));
    expect(edgeWidths.escape).toBeGreaterThan(26);
    expect(edgeWidths.backspace).toBeGreaterThan(57);

    const bottomWidths = await keyboard.evaluate((element) => ({
      leftControl: element
        .querySelector<HTMLElement>('kbd[data-key="Control"]')
        ?.getBoundingClientRect().width,
      menu: Array.from(element.querySelectorAll<HTMLElement>("kbd"))
        .find((key) => key.textContent === "Menu")
        ?.getBoundingClientRect().width,
      meta: element
        .querySelector<HTMLElement>('kbd[data-key="Meta"]')
        ?.getBoundingClientRect().width,
      rightControl: Array.from(
        element.querySelectorAll<HTMLElement>('kbd[data-key="Control"]'),
      )
        .at(-1)
        ?.getBoundingClientRect().width,
    }));
    expect(bottomWidths.leftControl).toBeGreaterThan(32);
    expect(bottomWidths.meta).toBeGreaterThan(32);
    expect(bottomWidths.menu).toBeGreaterThan(32);
    expect(bottomWidths.rightControl).toBeGreaterThan(32);
  });

  test("visualizes keydown, keyup, and blur on the 60% keyboard", async ({
    page,
  }) => {
    await page.goto("/dev/components/kbd");
    const keyboard = page.getByTestId("keyboard-60");
    const key = keyboard.locator('kbd[data-key="A"]');

    await expect(keyboard).toHaveAttribute("data-ready", "true");
    await expect(key).toHaveAttribute("data-state", "idle");
    const idleColors = await key.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    await page.keyboard.down("a");
    await expect(key).toHaveAttribute("data-state", "pressed");
    await expect(key).toHaveCSS("filter", "brightness(0.9)");
    expect(
      await key.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      }),
    ).toEqual(idleColors);
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

  test("owns preview-only keys without taking browser navigation", async ({
    page,
  }) => {
    await page.goto("/components/kbd");
    const keyboard = page.getByTestId("keyboard-60");
    const menu = keyboard.getByText("Menu", { exact: true });
    const fn = keyboard.getByText("Fn", { exact: true });
    await expect(keyboard).toHaveAttribute("data-ready", "true");

    const nativeBehavior = await page.evaluate(() => {
      const dispatchKey = (key: string, code: string) => {
        const event = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          code,
          key,
        });
        document.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const menuKey = dispatchKey("ContextMenu", "ContextMenu");
      const contextMenu = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(contextMenu);
      return {
        contextMenu: contextMenu.defaultPrevented,
        menuKey,
        navigation: dispatchKey("Tab", "Tab"),
      };
    });

    expect(nativeBehavior.menuKey).toBe(true);
    expect(nativeBehavior.contextMenu).toBe(true);
    expect(nativeBehavior.navigation).toBe(false);
    await expect(menu).toHaveAttribute("data-state", "pressed");

    await page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keyup", {
          bubbles: true,
          code: "ContextMenu",
          key: "ContextMenu",
        }),
      );
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "Fn",
          key: "Fn",
        }),
      );
    });
    await expect(menu).toHaveAttribute("data-state", "idle");
    await expect(fn).toHaveAttribute("data-state", "pressed");

    await page.waitForTimeout(260);
    expect(
      await page.evaluate(() => {
        const event = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(false);

    const initialTheme = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    await page.keyboard.press("D");
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(initialTheme);
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
