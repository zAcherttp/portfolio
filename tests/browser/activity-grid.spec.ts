import { expect, test } from "@playwright/test";

test.describe("activity grid", () => {
  test("reports cells and clears the active state on pointer leave", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Pointer hover behavior is covered by the desktop pointer project.",
    );
    await page.goto("/dev/components/activity-grid");
    const output = page.getByRole("status");
    const cell = page.locator("svg rect").nth(10);

    const cellBox = await cell.boundingBox();
    expect(cellBox).not.toBeNull();
    await page.mouse.move(
      (cellBox?.x ?? 0) + (cellBox?.width ?? 0) / 2,
      (cellBox?.y ?? 0) + (cellBox?.height ?? 0) / 2,
    );
    await expect(output).toContainText("level");
    await expect(output).not.toHaveText("No active cell");

    await page.mouse.move(0, 0);
    await expect(output).toHaveText("No active cell");
  });

  test("keeps a wide grid horizontally scrollable", async ({ page }) => {
    await page.goto("/dev/components/activity-grid?case=wide");
    const stage = page.getByTestId("fixture-stage");
    const region = stage.locator(".overflow-x-auto");

    const dimensions = await region.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

    await region.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const lastCell = stage.locator("svg rect").last();
    const lastCellBox = await lastCell.boundingBox();
    expect(lastCellBox).not.toBeNull();
    await page.mouse.move(
      (lastCellBox?.x ?? 0) + (lastCellBox?.width ?? 0) / 2,
      (lastCellBox?.y ?? 0) + (lastCellBox?.height ?? 0) / 2,
    );
    await expect(page.getByRole("status")).not.toHaveText("No active cell");
  });

  test("renders no SVG for empty data", async ({ page }) => {
    await page.goto("/dev/components/activity-grid?case=empty");
    const stage = page.getByTestId("fixture-stage");
    await expect(stage.locator("svg")).toHaveCount(0);
    await expect(stage.getByTestId("empty-grid")).toBeVisible();
  });
});
