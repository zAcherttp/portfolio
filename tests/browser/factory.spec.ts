import { expect, type Page, test } from "@playwright/test";

async function openFactory(page: Page) {
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "Screw factory" });
  await heading.scrollIntoViewIfNeeded();
  return page.locator(".factory");
}

function minerStatus(page: Page) {
  return page
    .locator(".factory li")
    .filter({ hasText: "Miner" })
    .locator(".sr-only");
}

test.describe("screw factory", () => {
  test("draws the factory without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const factory = await openFactory(page);
    await expect(factory.locator("canvas:not([aria-hidden])")).toBeVisible({
      timeout: 20_000,
    });
    expect(errors).toEqual([]);
  });

  test("powers the line from its switch", async ({ page }) => {
    const factory = await openFactory(page);
    const power = factory.getByRole("button", { name: "Power on" });
    await power.click();
    await expect(
      factory.getByRole("button", { name: "Power off" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(minerStatus(page)).toContainText("working", {
      timeout: 10_000,
    });
  });

  test("draws without GL errors while it runs", async ({ page }) => {
    // An unbound texture, or a shadow cube read while it is drawn into,
    // makes the driver drop draws and three.js warn on each one.
    const problems: string[] = [];
    page.on("console", (message) => {
      if (/texture units|feedback loop|GL_INVALID/i.test(message.text())) {
        problems.push(message.text());
      }
    });
    // As most GPUs do: WebGL 2's least, 16 textures per fragment shader.
    await page.addInitScript(() => {
      const MAX_TEXTURE_IMAGE_UNITS = 0x8872;
      const original = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (
        this: WebGL2RenderingContext,
        name: number,
      ) {
        const value = original.call(this, name);
        return name === MAX_TEXTURE_IMAGE_UNITS ? Math.min(value, 16) : value;
      };
    });
    const factory = await openFactory(page);
    await expect(factory.locator("canvas:not([aria-hidden])")).toBeVisible({
      timeout: 20_000,
    });
    // The picture shows once drawn; that first frame drew every shadow cube
    // and every material. Let a couple more frames pass for their warnings.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect(problems).toEqual([]);
  });

  test("keeps the line running when frames stall", async ({ page }) => {
    // A software GPU can take seconds per frame; the line must not wait on it.
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        window.setTimeout(() => raf(callback), 60_000);
    });
    const factory = await openFactory(page);
    await factory.getByRole("button", { name: "Power on" }).click();
    await expect(minerStatus(page)).toContainText("working", {
      timeout: 5_000,
    });
  });

  test("shows the settled line at once under reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const factory = await openFactory(page);
    await factory.getByRole("button", { name: "Power on" }).click();
    await expect(factory.locator("output")).toHaveText(
      /^2[2-4]\d screws\/min$/,
    );
  });

  test("still runs the line where WebGL 2 is missing", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === "webgl2") return null;
        return (original as (...args: unknown[]) => unknown).call(
          this,
          type,
          ...rest,
        );
      } as typeof original;
    });
    const factory = await openFactory(page);
    await expect(
      factory.getByText("This browser can't draw the factory"),
    ).toBeVisible();
    await factory.getByRole("button", { name: "Power on" }).click();
    await expect(minerStatus(page)).toContainText("working", {
      timeout: 10_000,
    });
  });
});
