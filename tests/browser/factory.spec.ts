import { expect, type Page, test } from "@playwright/test";

// These exercise rendering and controls, not high-DPI image quality.
test.use({ deviceScaleFactor: 1 });

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
  test.beforeEach(async ({ page }) => {
    // Cover the scene and controls without multiplying software-GPU fill work.
    await page.addInitScript(() => {
      window.__factoryProfile = { factor: 1 };
    });
  });

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

  test("draws a powered frame without GL errors", async ({ page }) => {
    // Cold shader compilation on SwiftShader can exceed the UI test budget.
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    await expect
      .poll(() => page.evaluate(() => window.__factoryProfile?.frames ?? 0), {
        timeout: 60_000,
      })
      .toBeGreaterThan(0);
    const renderedFrames = await page.evaluate(
      () => window.__factoryProfile?.frames ?? 0,
    );
    await factory.getByRole("button", { name: "Power on" }).click();
    await expect(factory.locator("output")).toHaveText(
      /^2[2-4]\d screws\/min$/,
    );
    // Reduced motion draws the powered, settled line on demand. A continuous
    // loop can saturate SwiftShader and starve the browser's test protocol.
    await expect
      .poll(() => page.evaluate(() => window.__factoryProfile?.frames ?? 0), {
        timeout: 60_000,
      })
      .toBeGreaterThan(renderedFrames);
    const error = await factory
      .locator("canvas:not([aria-hidden])")
      .evaluate((canvas: HTMLCanvasElement) => {
        const gl = canvas.getContext("webgl2");
        if (!gl)
          throw new Error("The factory requires a real WebGL 2 context.");
        gl.finish();
        return gl.getError();
      });
    expect(error).toBe(0);
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
