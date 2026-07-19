import { expect, test } from "@playwright/test";

async function canvasFrame(page: import("@playwright/test").Page) {
  return page.getByTestId("fixture-stage").locator("canvas").screenshot();
}

async function frameDifference(
  page: import("@playwright/test").Page,
  first: Buffer,
  second: Buffer,
) {
  return page.evaluate(
    async ({ firstFrame, secondFrame }) => {
      const pixels = async (frame: string) => {
        const response = await fetch(`data:image/png;base64,${frame}`);
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Unable to compare canvas frames");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };

      const firstPixels = await pixels(firstFrame);
      const secondPixels = await pixels(secondFrame);

      let difference = 0;
      for (let index = 0; index < firstPixels.length; index += 1) {
        difference += Math.abs(firstPixels[index] - secondPixels[index]);
      }
      return difference / (firstPixels.length * 255);
    },
    {
      firstFrame: first.toString("base64"),
      secondFrame: second.toString("base64"),
    },
  );
}

async function settledCanvasFrame(page: import("@playwright/test").Page) {
  let previous = await canvasFrame(page);

  await expect
    .poll(
      async () => {
        const current = await canvasFrame(page);
        const difference = await frameDifference(page, previous, current);
        previous = current;
        return difference;
      },
      { intervals: [100], timeout: 3_000 },
    )
    .toBeLessThan(0.001);

  return previous;
}

test.describe("dither footer", () => {
  test("mounts a responsive WebGL canvas", async ({ page }) => {
    await page.goto("/dev/components/dither-footer");
    const stage = page.getByTestId("fixture-stage");
    const canvas = stage.locator("canvas");

    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => (await canvas.boundingBox())?.height)
      .toBe(320);
    const box = await canvas.boundingBox();
    const stageBox = await stage.boundingBox();
    expect(box).not.toBeNull();
    expect(stageBox).not.toBeNull();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.width).toBeLessThanOrEqual(stageBox?.width ?? 0);
  });

  test("changes pixels when animated", async ({ page }) => {
    await page.goto("/dev/components/dither-footer");
    await expect(
      page.getByTestId("fixture-stage").locator("canvas"),
    ).toBeVisible();
    const first = await canvasFrame(page);
    await expect
      .poll(async () => frameDifference(page, first, await canvasFrame(page)))
      .toBeGreaterThan(0.001);
  });

  test("holds the same pixels when animation is disabled", async ({ page }) => {
    await page.goto("/dev/components/dither-footer?case=static");
    await expect(
      page.getByTestId("fixture-stage").locator("canvas"),
    ).toBeVisible();
    const first = await settledCanvasFrame(page);
    const comparisonStart = Date.now();
    await expect
      .poll(
        async () => {
          if (Date.now() - comparisonStart < 200) return 1;
          return frameDifference(page, first, await canvasFrame(page));
        },
        { intervals: [100], timeout: 3_000 },
      )
      .toBeLessThan(0.001);
  });

  test("only mounts the footer wrapper on the home route", async ({ page }) => {
    await page.goto("/components/theme-hotkey");
    await expect(page.getByTestId("bottom-shader")).toHaveCount(0);
    await expect(page.getByTestId("bottom-shader-fallback")).toHaveCount(0);
  });

  test("starts the component showcase without a scroll nudge", async ({
    page,
  }) => {
    await page.goto("/components/dither-footer");

    const showcase = page.getByTestId("dither-showcase");
    await expect(showcase).toBeVisible();
    await expect(showcase.locator("canvas")).toBeVisible();
    await expect(page.getByTestId("bottom-shader")).toHaveCount(0);
  });

  test("remounts the showcase after client-side navigation", async ({
    page,
  }) => {
    await page.goto("/components/dither-footer");
    await expect(
      page.getByTestId("dither-showcase").locator("canvas"),
    ).toBeVisible();

    const nextComponent = page.getByRole("link", {
      name: "Next component: Theme Hotkey",
    });
    await Promise.all([
      page.waitForURL(/\/components\/theme-hotkey$/, { timeout: 15_000 }),
      nextComponent.click(),
    ]);
    const previousComponent = page.getByRole("link", {
      name: "Previous component: Dither Footer",
    });
    await Promise.all([
      page.waitForURL(/\/components\/dither-footer$/, { timeout: 15_000 }),
      previousComponent.click(),
    ]);

    const canvas = page.getByTestId("dither-showcase").locator("canvas");
    await expect(canvas).toBeVisible();
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const canvasElement = element as HTMLCanvasElement;
          const context =
            canvasElement.getContext("webgl2") ??
            canvasElement.getContext("webgl");
          return context?.isContextLost();
        }),
      )
      .toBe(false);
    const first = await canvas.screenshot();
    await expect
      .poll(async () =>
        (await canvas.screenshot()).equals(first) ? "unchanged" : "changed",
      )
      .toBe("changed");
  });

  test("uses the fallback without creating a WebGL canvas", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "WebGLRenderingContext", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto("/");

    await expect(page.getByTestId("bottom-shader-fallback")).toBeVisible();
    await expect(
      page.getByTestId("bottom-shader-fallback").locator("canvas"),
    ).toHaveCount(0);
  });

  test("activates after a downward nudge at the page bottom", async ({
    page,
  }) => {
    await page.goto("/");
    const shader = page.getByTestId("bottom-shader");
    await expect(shader).toBeVisible();
    await expect(shader.locator("canvas")).toHaveCount(0);

    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.mouse.wheel(0, 20);
    await expect(shader.locator("canvas")).toBeVisible();

    const first = await shader.locator("canvas").screenshot();
    await expect
      .poll(async () =>
        (await shader.locator("canvas").screenshot()).equals(first)
          ? "unchanged"
          : "changed",
      )
      .toBe("changed");
  });
});
