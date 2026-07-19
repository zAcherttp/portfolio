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
    const expandedHandles = page.locator(
      '[data-slot="transaction-card-handle"][aria-expanded="true"]',
    );
    await expect(expandedHandles).toHaveCount(2);
    await expect(
      page.locator('[data-slot="transaction-card"][inert]'),
    ).toHaveCount(1);

    const scrollRegion = cards
      .filter({
        has: page.locator(
          '[data-slot="transaction-card-handle"][aria-expanded="true"]',
        ),
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
        has: page.locator(
          '[data-slot="transaction-card-handle"][aria-expanded="false"]',
        ),
      })
      .first();
    const collapsedInvoice = await collapsedCard.getAttribute("aria-label");
    if (!collapsedInvoice) throw new Error("Collapsed card has no label.");
    const handle = collapsedCard.locator(
      '[data-slot="transaction-card-handle"]',
    );
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
    await expect
      .poll(() =>
        collapsedCard.evaluate((element) =>
          Math.round(element.getBoundingClientRect().top),
        ),
      )
      .toBeLessThan(Math.round(handleBox.y));
    await page.mouse.up();

    const restoredCard = page.locator(
      `[data-slot="transaction-card"][aria-label="${collapsedInvoice}"]`,
    );
    await expect(
      restoredCard.locator(
        '[data-slot="transaction-card-handle"][aria-expanded="true"]',
      ),
    ).toBeVisible();

    const expandedCards = cards.filter({
      has: page.locator(
        '[data-slot="transaction-card-handle"][aria-expanded="true"]',
      ),
    });
    await expandedCards
      .first()
      .getByRole("button", { name: "Close transaction" })
      .click();

    await expect(cards).toHaveCount(3);
    await expect(expandedHandles).toHaveCount(2);
  });

  test("animates slot changes and clears compositor hints at rest", async ({
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
    await viewDetails.nth(0).click();
    const firstCard = page.locator('[data-slot="transaction-card"]').first();
    const firstLabel = await firstCard.getAttribute("aria-label");
    if (!firstLabel) throw new Error("Transaction card has no label.");
    const movingCard = page.locator(
      `[data-slot="transaction-card"][aria-label="${firstLabel}"]`,
    );
    await expect
      .poll(() =>
        movingCard.evaluate((element) =>
          Math.round(element.getBoundingClientRect().left),
        ),
      )
      .toBe(16);
    await movingCard.evaluate((element) => {
      const observedCard = element as HTMLElement & {
        motionSamples?: number[];
      };
      observedCard.motionSamples = [];
      new MutationObserver(() => {
        observedCard.motionSamples?.push(
          Number.parseFloat(observedCard.style.left),
        );
      }).observe(observedCard, {
        attributeFilter: ["style"],
        attributes: true,
      });
    });

    await viewDetails.nth(1).click();
    await expect
      .poll(() =>
        movingCard.evaluate((element) =>
          Math.round(element.getBoundingClientRect().left),
        ),
      )
      .toBe(340);
    const motionSamples = await movingCard.evaluate(
      (element) =>
        (element as HTMLElement & { motionSamples?: number[] }).motionSamples ??
        [],
    );
    expect(motionSamples.some((left) => left > 16 && left < 340)).toBe(true);
    await expect
      .poll(() =>
        movingCard.evaluate((element) => ({
          transform: getComputedStyle(element).transform,
          willChange: getComputedStyle(element).willChange,
        })),
      )
      .toEqual({ transform: "none", willChange: "auto" });

    await movingCard.getByRole("button", { name: "Close transaction" }).click();
    await expect(viewDetails.nth(0)).toBeFocused();
    await expect(page.locator('[data-slot="transaction-card"]')).toHaveCount(1);
  });

  test("keeps disclosure focus stable across click and keyboard toggles", async ({
    page,
  }) => {
    await page.goto("/components/transaction-dock");

    const viewDetails = page.getByRole("button", { name: "View details" });
    await viewDetails.nth(0).click();
    const firstCard = page.locator('[data-slot="transaction-card"]').first();
    const firstLabel = await firstCard.getAttribute("aria-label");
    if (!firstLabel) throw new Error("Transaction card has no label.");

    const card = page.locator(
      `[data-slot="transaction-card"][aria-label="${firstLabel}"]`,
    );
    const handle = card.getByRole("button", {
      name: /Transaction details for/,
    });
    await expect(
      card.getByRole("button", { name: /Minimize|Expand transaction/ }),
    ).toHaveCount(0);
    const contentId = await handle.getAttribute("aria-controls");
    if (!contentId) throw new Error("Transaction handle has no controlled ID.");
    const content = card.locator(`[id="${contentId}"]`);

    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await handle.focus();
    await handle.press("Enter");
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await expect(handle).toBeFocused();
    await expect(content).toHaveAttribute("aria-hidden", "true");
    await expect(content).toHaveAttribute("inert", "");

    await handle.press("Space");
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await expect(handle).toBeFocused();
    await expect(content).toHaveAttribute("aria-hidden", "false");
    await expect(content).not.toHaveAttribute("inert", "");

    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await expect(handle).toBeFocused();
    await card.getByRole("button", { name: "Close transaction" }).click();
    await expect(viewDetails.nth(0)).toBeFocused();
  });

  test("animates capacity collapse and restoration across viewport resize", async ({
    page,
  }) => {
    const supportsHover = await page.evaluate(
      () => window.matchMedia("(hover: hover)").matches,
    );
    test.skip(!supportsHover, "requires a multi-slot, hover-capable viewport");

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/components/transaction-dock");
    const dock = page.locator("[data-transaction-dock]");
    await expect(dock).toHaveAttribute("data-slot-count", "3");

    const viewDetails = page.getByRole("button", { name: "View details" });
    await viewDetails.nth(0).click();
    const firstCard = page.locator('[data-slot="transaction-card"]').first();
    const firstLabel = await firstCard.getAttribute("aria-label");
    if (!firstLabel) throw new Error("Transaction card has no label.");
    await viewDetails.nth(1).click();
    await viewDetails.nth(2).click();

    const resizingCard = page.locator(
      `[data-slot="transaction-card"][aria-label="${firstLabel}"]`,
    );
    const handle = resizingCard.locator(
      '[data-slot="transaction-card-handle"]',
    );
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await resizingCard.evaluate((element) => {
      const observedCard = element as HTMLElement & {
        resizeSamples?: number[];
      };
      observedCard.resizeSamples = [];
      new MutationObserver(() => {
        const bottom = Number.parseFloat(observedCard.style.bottom);
        if (Number.isFinite(bottom)) observedCard.resizeSamples?.push(bottom);
      }).observe(observedCard, {
        attributeFilter: ["style"],
        attributes: true,
      });
    });

    await page.setViewportSize({ width: 720, height: 720 });
    await expect(dock).toHaveAttribute("data-slot-count", "2");
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await expect
      .poll(() =>
        resizingCard.evaluate((element) =>
          Math.round(Number.parseFloat(element.style.bottom)),
        ),
      )
      .toBeLessThan(-450);
    const collapsedBottom = await resizingCard.evaluate((element) =>
      Number.parseFloat(element.style.bottom),
    );
    const collapseSamples = await resizingCard.evaluate(
      (element) =>
        (element as HTMLElement & { resizeSamples?: number[] }).resizeSamples ??
        [],
    );
    expect(
      collapseSamples.some((bottom) => bottom < 16 && bottom > collapsedBottom),
    ).toBe(true);

    await resizingCard.evaluate((element) => {
      (element as HTMLElement & { resizeSamples?: number[] }).resizeSamples =
        [];
    });
    await page.setViewportSize({ width: 1400, height: 720 });
    await expect(dock).toHaveAttribute("data-slot-count", "4");
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() =>
        resizingCard.evaluate((element) =>
          Math.round(Number.parseFloat(element.style.bottom)),
        ),
      )
      .toBe(16);
    const restoreSamples = await resizingCard.evaluate(
      (element) =>
        (element as HTMLElement & { resizeSamples?: number[] }).resizeSamples ??
        [],
    );
    expect(
      restoreSamples.some((bottom) => bottom > collapsedBottom && bottom < 16),
    ).toBe(true);
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
      page.locator(
        '[data-slot="transaction-card-handle"][aria-expanded="true"]',
      ),
    ).toHaveCount(1);
  });
});
