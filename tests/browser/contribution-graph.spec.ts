import { expect, type Locator, type Page, test } from "@playwright/test";

async function moveOverDay(page: Page, cell: Locator) {
  await cell.scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await cell.hover();
  const box = await cell.boundingBox();
  if (!box) throw new Error("Contribution day has no visible bounds.");
  await page.mouse.move(
    box.x + box.width / 2 + 0.25,
    box.y + box.height / 2 + 0.25,
  );
}

test.describe("contribution graph", () => {
  test("shows contributions without exposing account aggregation", async ({
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
      page.getByText(/personal \+ work|combined contributions/i),
    ).toHaveCount(0);
    await expect(
      page.getByText("10 contributions in the last year", {
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
        hasText: "Contributions are temporarily unavailable.",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/\d+ contributions in the last year/),
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
        .getByRole("img", { name: "Contribution Graph", exact: true })
        .first();
      await expect(graph).toBeVisible();
      await expect(graph.locator("title")).toHaveCount(0);
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

  test("shows details for zero-count days, filled gaps, and active days", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Requires a hover pointer.",
    );
    const calendar = Array.from({ length: 370 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 8, 20) + index * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const count = date === "2026-09-22" ? 2 : date === "2026-09-24" ? 8 : 0;
      return { date, count, level: count === 8 ? 4 : count === 2 ? 1 : 0 };
    }).filter(({ date }) => date !== "2026-09-21" && date !== "2026-09-23");
    await page.route("**/api/github-contributions", (route) =>
      route.fulfill({ json: calendar }),
    );
    await page.goto("/");
    await expect(
      page.getByText("10 contributions in the last year", { exact: true }),
    ).toBeVisible();
    for (const [date, label] of [
      ["2026-09-20", "No contributions on Sep 20, 2026"],
      ["2026-09-21", "No contributions on Sep 21, 2026"],
      ["2026-09-22", "2 contributions on Sep 22, 2026"],
      ["2026-09-23", "No contributions on Sep 23, 2026"],
      ["2026-09-24", "8 contributions on Sep 24, 2026"],
    ]) {
      await moveOverDay(page, page.locator(`svg rect[data-date="${date}"]`));
      await expect(page.getByRole("tooltip")).toHaveText(label);
      await expect(page.getByRole("tooltip")).toHaveCSS("opacity", "1");
    }
  });

  test("reopens the same day after scrolling", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Requires a hover pointer.",
    );
    await page.goto("/dev/components/contribution-graph");
    await page.evaluate(() => {
      document.body.style.minHeight = "1800px";
    });
    const cell = page
      .getByTestId("fixture-stage")
      .locator('rect[data-count="8"]')
      .first();
    const tooltip = page.getByRole("tooltip");
    await moveOverDay(page, cell);
    await expect(tooltip).toHaveCSS("opacity", "1");
    await page.evaluate(() => window.scrollBy(0, 20));
    await expect(tooltip).toBeHidden();
    await moveOverDay(page, cell);
    await expect(tooltip).toHaveCSS("opacity", "1");
    await expect(tooltip).toContainText("8 contributions on");
  });

  for (const scale of [2, 5]) {
    test(`aligns the highlight after ${scale * 100}% pinch zoom and visual viewport panning`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "Chromium exposes pinch emulation through CDP.",
      );
      await page.setViewportSize({ width: 1280, height: 960 });
      await page.goto("/dev/components/contribution-graph");
      const cell = page
        .getByTestId("fixture-stage")
        .locator('rect[data-date="2025-08-12"]');
      await expect(cell).toBeVisible();
      const graph = page.getByRole("img", {
        name: "Contribution Graph",
        exact: true,
      });
      await expect(graph.locator("title")).toHaveCount(0);
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 960,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await session.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 2,
      });
      await session.send("Emulation.setPageScaleFactor", {
        pageScaleFactor: scale,
      });
      for (let gesture = 0; gesture < 2; gesture++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: 200, y: 180 }],
        });
        for (let step = 1; step <= 6; step++) {
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: 200 - step * 15, y: 180 - step * 20 }],
          });
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              ),
          );
        }
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      }
      await expect
        .poll(() => page.evaluate(() => window.visualViewport?.offsetLeft ?? 0))
        .toBeGreaterThan(0);
      let previousViewport: { left: number; top: number } | undefined;
      await expect
        .poll(async () => {
          const next = await page.evaluate(() => ({
            left: window.visualViewport?.offsetLeft ?? 0,
            top: window.visualViewport?.offsetTop ?? 0,
          }));
          const settled =
            previousViewport?.left === next.left &&
            previousViewport.top === next.top;
          previousViewport = next;
          return settled;
        })
        .toBe(true);
      const point = await cell.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const viewport = window.visualViewport;
        return {
          x: rect.left + rect.width / 2 - (viewport?.offsetLeft ?? 0),
          y: rect.top + rect.height / 2 - (viewport?.offsetTop ?? 0),
        };
      });
      await page.mouse.move(point.x, point.y);
      const tooltip = page.getByRole("tooltip");
      await expect(tooltip).toHaveText("6 contributions on Aug 12, 2025");
      await expect(tooltip).toHaveCSS("opacity", "1");
      const highlight = page.locator(
        '[data-slot="floating-tooltip-highlight"]',
      );
      await expect(highlight).toHaveCSS("opacity", "1");
      await expect
        .poll(async () => {
          const [cellBox, highlightBox] = await Promise.all([
            cell.boundingBox(),
            highlight.boundingBox(),
          ]);
          if (!cellBox || !highlightBox) return Number.POSITIVE_INFINITY;
          return Math.max(
            Math.abs(cellBox.x - highlightBox.x),
            Math.abs(cellBox.y - highlightBox.y),
            Math.abs(cellBox.width - highlightBox.width),
            Math.abs(cellBox.height - highlightBox.height),
          );
        })
        .toBeLessThan(1);
      await expect
        .poll(() =>
          tooltip.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const viewport = window.visualViewport;
            if (!viewport) return false;
            return (
              rect.left >= viewport.offsetLeft &&
              rect.top >= viewport.offsetTop &&
              rect.right <= viewport.offsetLeft + viewport.width &&
              rect.bottom <= viewport.offsetTop + viewport.height
            );
          }),
        )
        .toBe(true);
      await session.detach();
    });
  }

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
