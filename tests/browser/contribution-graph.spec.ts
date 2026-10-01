import { expect, test } from "@playwright/test";

test.describe("contribution graph", () => {
  test("shows combined personal and work activity on the homepage", async ({
    page,
  }) => {
    await page.route("**/api/github-contributions", (route) =>
      route.fulfill({
        json: [
          { date: "2026-09-29", count: 0, level: 0 },
          { date: "2026-09-30", count: 2, level: 1 },
          { date: "2026-10-01", count: 8, level: 4 },
        ],
      }),
    );
    await page.goto("/");
    await expect(
      page.getByText("Personal + work activity", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("10 combined contributions in the last year", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(
        'svg rect[data-date="2026-10-01"][data-count="8"][data-level="4"]',
      ),
    ).toBeVisible();
  });

  test("shows an unavailable message instead of an empty activity total", async ({
    page,
  }) => {
    await page.route("**/api/github-contributions", (route) =>
      route.fulfill({
        status: 502,
        json: { error: { code: "upstream_unavailable" } },
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("status").filter({
        hasText: "Personal + work activity is temporarily unavailable.",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/\d+ combined contributions in the last year/),
    ).toHaveCount(0);
  });

  for (const route of [
    "/",
    "/components/activity-grid",
    "/components/contribution-graph",
    "/dev/components/contribution-graph",
  ]) {
    test(`fills the available width in ${route}`, async ({ page }) => {
      await page.goto(route);
      const graph = page
        .locator('svg:has(> title:text-is("Contribution Graph"))')
        .first();
      await expect(graph).toBeVisible();
      const viewport = graph.locator(
        "xpath=ancestor::div[contains(@class, 'overflow-x-auto')][1]",
      );
      await expect
        .poll(
          async () => {
            const [graphBox, viewportBox, intrinsicWidth] = await Promise.all([
              graph.boundingBox(),
              viewport.boundingBox(),
              graph
                .locator("..")
                .evaluate((element) =>
                  Number.parseFloat(getComputedStyle(element).minWidth),
                ),
            ]);
            if (!graphBox || !viewportBox) return Number.POSITIVE_INFINITY;
            return Math.abs(
              graphBox.width - Math.max(viewportBox.width, intrinsicWidth),
            );
          },
          { message: `${route} should fill its viewport` },
        )
        .toBeLessThan(1);
    });
  }

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
