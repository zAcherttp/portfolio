import { expect, test } from "@playwright/test";

test.describe("contribution graph", () => {
  test("fills the available width in every portfolio host", async ({
    page,
  }) => {
    const routes = [
      "/",
      "/components/activity-grid",
      "/components/contribution-graph",
      "/dev/components/contribution-graph",
    ];

    for (const route of routes) {
      await page.goto(route);
      const graph = page
        .locator('svg:has(> title:text-is("Contribution Graph"))')
        .first();
      await expect(graph).toBeVisible();
      const viewport = graph.locator(
        "xpath=ancestor::div[contains(@class, 'overflow-x-auto')][1]",
      );
      const graphBox = await graph.boundingBox();
      const viewportBox = await viewport.boundingBox();
      const intrinsicWidth = await graph
        .locator("..")
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).minWidth),
        );

      expect(graphBox, `${route} graph bounds`).not.toBeNull();
      expect(viewportBox, `${route} viewport bounds`).not.toBeNull();
      expect(
        Math.abs(
          (graphBox?.width ?? 0) -
            Math.max(viewportBox?.width ?? 0, intrinsicWidth),
        ),
        `${route} should fill its viewport without shrinking below its intrinsic width`,
      ).toBeLessThan(1);
    }
  });

  test("shows contribution details for an active day", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Pointer hover behavior is covered by the desktop pointer project.",
    );
    await page.goto("/dev/components/contribution-graph");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const stage = page.getByTestId("fixture-stage");
    const activeCell = stage.locator('svg rect[data-count="8"]').first();
    const box = await activeCell.boundingBox();
    expect(box).not.toBeNull();

    const clientX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const clientY = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    await activeCell.hover();
    await page.mouse.move(clientX + 0.25, clientY + 0.25);
    await expect(page.getByRole("tooltip")).toContainText(
      /8 contributions on [A-Z][a-z]{2} \d{1,2}, 202[56]/,
    );
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.mouse.move(0, 0);
    await expect(page.getByRole("tooltip")).toBeHidden();
  });

  test("renders sparse data and footer totals", async ({ page }) => {
    await page.goto("/dev/components/contribution-graph?case=sparse");
    const stage = page.getByTestId("fixture-stage");
    await expect(stage.locator('rect[data-level="0"]')).not.toHaveCount(0);
    await expect(stage.locator('rect[data-level="4"]')).not.toHaveCount(0);
    await expect(stage.getByText(/deterministic contributions/)).toBeVisible();
  });

  test("can omit month labels without removing the calendar", async ({
    page,
  }) => {
    await page.goto("/dev/components/contribution-graph?case=no-labels");
    const stage = page.getByTestId("fixture-stage");
    await expect(stage.locator("svg > text, svg > g > text")).toHaveCount(0);
    await expect(stage.locator("svg rect")).not.toHaveCount(0);
  });
});
