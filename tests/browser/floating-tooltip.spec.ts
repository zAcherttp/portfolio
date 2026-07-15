import { expect, type Locator, type Page, test } from "@playwright/test";

async function expectInsideViewport(page: Page, locator: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport size is unavailable.");

  await expect
    .poll(async () => (await locator.boundingBox())?.x)
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(async () => (await locator.boundingBox())?.y)
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? box.x + box.width : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(viewport.width);
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(viewport.height);
}

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
      if (testInfo.project.name === "chromium") {
        await expect(tooltip).toHaveAttribute("data-placement", placement);
      } else {
        await expect(tooltip).toHaveAttribute(
          "data-placement",
          new RegExp(`^(${placements.join("|")})$`),
        );
        await expectInsideViewport(page, tooltip);
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
      await expectInsideViewport(page, tooltip);
    }
  });

  test("positions a tooltip from a virtual target", async ({ page }) => {
    await page.goto("/dev/components/floating-tooltip?case=virtual-targets");
    const target = page.getByRole("button", { name: "Large target" });

    await target.hover();

    const tooltip = page.getByRole("tooltip", { name: "Large target" });
    await expect(tooltip).toBeVisible();
    await expectInsideViewport(page, tooltip);
  });

  test("follows externally controlled open state", async ({ page }) => {
    await page.goto("/dev/components/floating-tooltip?case=controlled");
    const tooltip = page.getByRole("tooltip", {
      name: "Controlled and stable",
    });

    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(tooltip).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(tooltip).toBeHidden();
  });

  test("hides controlled content while its anchor is unstable", async ({
    page,
  }) => {
    await page.goto("/dev/components/floating-tooltip?case=controlled");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.getByRole("button", { name: "Pause", exact: true }).click();

    await expect(page.getByRole("tooltip")).toHaveCSS("opacity", "0");
    await expect(
      page.getByRole("button", { name: "Resume", exact: true }),
    ).toBeVisible();
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
