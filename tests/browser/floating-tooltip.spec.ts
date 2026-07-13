import { expect, test } from "@playwright/test";

test.describe("floating tooltip", () => {
  test("supports pointer and keyboard discovery", async ({ page }) => {
    await page.goto("/dev/components/floating-tooltip");
    const trigger = page.getByRole("button", { name: "Hover or focus" });

    await trigger.hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveText("Default tooltip");
    await expect(tooltip).toBeVisible();

    const tooltipId = await tooltip.getAttribute("id");
    await expect(trigger).toHaveAttribute(
      "aria-describedby",
      new RegExp(tooltipId ?? "missing-tooltip-id"),
    );

    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();

    await trigger.focus();
    await expect(tooltip).toBeVisible();
    await trigger.press("Escape");
    await expect(tooltip).toBeHidden();
  });

  test("resolves every requested placement", async ({ page }, testInfo) => {
    await page.goto("/dev/components/floating-tooltip?case=placements");
    const placements = [
      "top-left",
      "top",
      "top-right",
      "left",
      "right",
      "bottom-left",
      "bottom",
      "bottom-right",
    ];

    for (const placement of placements) {
      await page.getByRole("button", { name: placement, exact: true }).hover();
      const tooltip = page.getByRole("tooltip", {
        name: placement,
        exact: true,
      });
      const resolvedPlacement = await tooltip.getAttribute("data-placement");

      expect(placements).toContain(resolvedPlacement);
      if (testInfo.project.name === "chromium") {
        expect(resolvedPlacement).toBe(placement);
      } else {
        const box = await tooltip.boundingBox();
        const viewport = page.viewportSize();
        expect(box).not.toBeNull();
        expect((box?.x ?? -1) >= 0).toBe(true);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
          viewport?.width ?? 0,
        );
      }
    }
  });

  test("keeps collision results inside the viewport", async ({ page }) => {
    await page.goto("/dev/components/floating-tooltip?case=collision");
    const targets = [
      { content: "Requested top-left", trigger: "Top left edge" },
      { content: "Requested top-right", trigger: "Top right edge" },
      { content: "Requested bottom-left", trigger: "Bottom left edge" },
      { content: "Requested bottom-right", trigger: "Bottom right edge" },
    ];

    for (const target of targets) {
      await page.getByRole("button", { name: target.trigger }).hover();
      const tooltip = page.getByRole("tooltip", {
        name: target.content,
        exact: true,
      });
      await expect(tooltip).toBeVisible();
      const box = await tooltip.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport?.width ?? 0,
      );
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport?.height ?? 0,
      );
    }
  });

  test("updates content size without replacing the tooltip", async ({
    page,
  }) => {
    await page.goto("/dev/components/floating-tooltip?case=content-resize");
    const trigger = page.getByRole("button", { name: "Toggle content size" });
    await trigger.hover();

    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveText("Short content");
    const tooltipId = await tooltip.getAttribute("id");

    await trigger.click();
    await expect(tooltip).toHaveText(
      "A longer tooltip that exercises interruptible content resizing",
    );
    await expect(tooltip).toHaveAttribute("id", tooltipId ?? "");
  });

  test("hides while its scroll environment is unstable", async ({ page }) => {
    await page.goto("/dev/components/floating-tooltip?case=scroll");
    const trigger = page.getByRole("button", { name: "Hover, then scroll" });
    await trigger.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.getByTestId("tooltip-scroll-region").evaluate((element) => {
      element.scrollTop += 80;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(page.getByRole("tooltip")).toBeHidden();
  });
});
