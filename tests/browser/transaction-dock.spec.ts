import { expect, test } from "@playwright/test";

test.describe("transaction dock", () => {
  test("opens, capacity-collapses, restores, and re-enters", async ({
    page,
  }) => {
    const supportsHover = await page.evaluate(
      () => window.matchMedia("(hover: hover)").matches,
    );
    test.skip(!supportsHover, "requires a multi-slot, hover-capable viewport");

    await page.goto("/components/transaction-dock");
    const dock = page.locator("[data-transaction-dock]");
    await dock.evaluate((element) => {
      element.style.width = "1100px";
    });
    await expect(dock).toHaveAttribute("data-slot-count", "3");

    const viewDetails = page.getByRole("button", { name: "View details" });
    for (let index = 0; index < 4; index += 1) {
      await viewDetails.nth(index).click();
    }

    await expect(dock).toHaveAttribute("data-panel-count", "4");
    const cards = page.locator('[data-slot="transaction-card"]');
    await expect(cards).toHaveCount(4);
    await expect
      .poll(() =>
        cards
          .first()
          .evaluate((element) =>
            Math.round(element.getBoundingClientRect().left),
          ),
      )
      .toBe(16);
    await expect(
      page.getByRole("button", { name: "Minimize transaction" }),
    ).toHaveCount(2);

    const scrollRegion = cards
      .filter({
        has: page.getByRole("button", { name: "Minimize transaction" }),
      })
      .first()
      .locator('[data-slot="transaction-card-scroll"]');
    await expect
      .poll(() =>
        scrollRegion.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);
    await scrollRegion.hover();
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    const collapsedCard = cards
      .filter({
        has: page.getByRole("button", { name: "Expand transaction" }),
      })
      .first();
    const collapsedInvoice = await collapsedCard.getAttribute("aria-label");
    if (!collapsedInvoice) throw new Error("Collapsed card has no label.");
    const handle = collapsedCard.locator('[data-slot="drawer-swipe-handle"]');
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("Collapsed card handle is not measurable.");
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      Math.max(20, handleBox.y - 320),
      { steps: 12 },
    );
    await page.mouse.up();

    const restoredCard = page.locator(
      `[data-slot="transaction-card"][aria-label="${collapsedInvoice}"]`,
    );
    await expect(
      restoredCard.getByRole("button", { name: "Minimize transaction" }),
    ).toBeVisible();

    const expandedCards = cards.filter({
      has: page.getByRole("button", { name: "Minimize transaction" }),
    });
    await expandedCards
      .first()
      .getByRole("button", { name: "Close transaction" })
      .click();

    await expect(cards).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Minimize transaction" }),
    ).toHaveCount(2);
  });

  test("uses the dock container width to constrain capacity", async ({
    page,
  }) => {
    await page.goto("/components/transaction-dock");

    const dock = page.locator("[data-transaction-dock]");
    await dock.evaluate((element) => {
      element.style.width = "1000px";
    });
    await expect
      .poll(async () => Number(await dock.getAttribute("data-slot-count")))
      .toBeGreaterThan(1);

    await dock.evaluate((element) => {
      element.style.width = "360px";
    });
    await expect(dock).toHaveAttribute("data-slot-count", "1");

    const viewDetails = page.getByRole("button", { name: "View details" });
    for (let index = 0; index < 4; index += 1) {
      await viewDetails.nth(index).click();
    }

    await expect(dock).toHaveAttribute("data-panel-count", "4");
    await expect(page.locator('[data-slot="transaction-card"]')).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Minimize transaction" }),
    ).toHaveCount(1);
  });
});
