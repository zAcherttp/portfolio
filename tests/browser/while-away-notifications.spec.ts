import { expect, test } from "@playwright/test";

test.describe("while-away notifications", () => {
  test("queues a temporary notification for the tab that wakes", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let visibilityState: DocumentVisibilityState = "visible";
      let focused = true;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibilityState,
      });
      Object.defineProperty(document, "hasFocus", {
        configurable: true,
        value: () => focused,
      });
      Object.assign(window, {
        setFixtureVisibility(nextState: DocumentVisibilityState) {
          visibilityState = nextState;
          focused = nextState === "visible";
          document.dispatchEvent(new Event("visibilitychange"));
          window.dispatchEvent(new Event(focused ? "focus" : "blur"));
        },
      });
    });
    await page.goto("/components/while-away-notifications");
    await expect(
      page.getByText("Tab scoped · Active", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add one now" }),
    ).toBeVisible();
    await page.evaluate(() => {
      (
        window as typeof window & {
          setFixtureVisibility: (state: DocumentVisibilityState) => void;
        }
      ).setFixtureVisibility("hidden");
    });
    await expect(page.getByText("Tab scoped · Waiting")).toBeVisible();
    await expect(page.getByText("Tab scoped · Away")).toBeVisible({
      timeout: 2500,
    });
    const notificationButton = page.getByRole("button", {
      name: "Open notifications, 2 unread",
    });
    await expect(notificationButton).toBeVisible();
    await expect(notificationButton).toHaveCSS("border-radius", "10px");

    await page.evaluate(() => {
      (
        window as typeof window & {
          setFixtureVisibility: (state: DocumentVisibilityState) => void;
        }
      ).setFixtureVisibility("visible");
    });
    const toast = page.locator('[data-testid^="notification-toast-"]');
    const previewCard = page.locator("[data-notification-preview-card]");
    await expect(toast).toHaveCount(1);
    await expect(previewCard).toBeVisible();
    await expect(toast).toHaveAttribute("data-styled", "true");
    await expect(toast).toHaveCSS("user-select", "none");
    await expect(
      toast.locator('[data-slot="notification-status-rail"]'),
    ).toBeVisible();
    await expect(toast.getByRole("button", { name: "Open" })).toBeVisible();

    const geometry = await toast.evaluate((element) => {
      const statusElement = element.querySelector(
        '[data-slot="notification-status-rail"]',
      );
      const contentElement = element.querySelector("[data-content]");
      const outerBounds = element.getBoundingClientRect();
      const statusBounds = (statusElement as Element).getBoundingClientRect();
      const contentBounds = (contentElement as Element).getBoundingClientRect();
      return {
        contentHeight: contentBounds.height,
        contentInsetBottom: outerBounds.bottom - contentBounds.bottom,
        contentInsetTop: contentBounds.top - outerBounds.top,
        outerHeight: outerBounds.height,
        railHeight: statusBounds.height,
        railWidth: statusBounds.width,
      };
    });
    expect(geometry.railHeight).toBeCloseTo(16, 2);
    expect(geometry.railWidth).toBeCloseTo(2, 2);
    expect(geometry.outerHeight).toBeGreaterThan(geometry.contentHeight);
    expect(geometry.contentInsetTop).toBeGreaterThanOrEqual(12);
    expect(geometry.contentInsetBottom).toBeCloseTo(
      geometry.contentInsetTop,
      1,
    );
    const [toastRadius, previewCardRadius] = await Promise.all([
      toast.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).borderRadius),
      ),
      previewCard.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).borderRadius),
      ),
    ]);
    expect(toastRadius).toBe(previewCardRadius);
    await expect(
      page.getByRole("button", { name: "Open notifications, 2 unread" }),
    ).toBeVisible();
  });

  test("presents a queued return batch once and preserves unread state", async ({
    page,
  }) => {
    await page.goto("/dev/components/while-away-notifications?case=catch-up");

    await page.getByRole("button", { name: "Set tab away" }).click();
    await expect(page.getByText("away", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Queue 3" }).click();
    await page.getByRole("button", { name: "Return to tab" }).click();

    const batchToasts = page.locator('[data-testid^="notification-toast-"]');
    await expect(batchToasts).toHaveCount(3);
    const toastGeometry = await batchToasts.evaluateAll((elements) =>
      elements.map((element) => {
        const outerBounds = element.getBoundingClientRect();
        const contentBounds = element
          .querySelector("[data-content]")
          ?.getBoundingClientRect();
        const railBounds = element
          .querySelector('[data-slot="notification-status-rail"]')
          ?.getBoundingClientRect();
        const railStyles = railBounds
          ? getComputedStyle(
              element.querySelector(
                '[data-slot="notification-status-rail"]',
              ) as Element,
            )
          : null;
        return {
          contentHeight: contentBounds?.height ?? 0,
          outerHeight: outerBounds.height,
          railHeight: Number.parseFloat(railStyles?.height ?? "0"),
          railWidth: Number.parseFloat(railStyles?.width ?? "0"),
        };
      }),
    );
    for (const {
      contentHeight,
      outerHeight,
      railHeight,
      railWidth,
    } of toastGeometry) {
      expect(outerHeight).toBeGreaterThan(contentHeight);
      expect(railHeight).toBeCloseTo(16, 2);
      expect(railWidth).toBeCloseTo(2, 2);
    }
    const trigger = page.getByRole("button", {
      name: "Open notifications, 4 unread",
    });
    await expect(trigger).toBeVisible();
    await page
      .getByRole("button", { name: "Open", exact: true })
      .first()
      .click();

    await expect(batchToasts).toHaveCount(0);
    const center = page.getByRole("dialog", { name: "Notifications" });
    await expect(center).toBeVisible();
    const list = center.getByRole("list", { name: "Notification list" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(
      list.getByRole("button", { name: /Existing notification/ }),
    ).toBeVisible();
    await expect(
      list.getByRole("button", { name: /Queued notification 3/ }),
    ).toBeVisible();
    const header = center.locator("[data-notification-center-header]");
    const firstItem = center.locator("[data-notification-id]").first();
    await expect
      .poll(async () => {
        const [headerBounds, firstItemBounds] = await Promise.all([
          header.boundingBox(),
          firstItem.boundingBox(),
        ]);
        if (!headerBounds || !firstItemBounds) {
          return Number.POSITIVE_INFINITY;
        }
        return Math.abs(
          firstItemBounds.y - (headerBounds.y + headerBounds.height),
        );
      })
      .toBeLessThanOrEqual(1);
    const centerGeometry = await center.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const radius = Number.parseFloat(getComputedStyle(element).borderRadius);
      const titleBounds = element
        .querySelector('[data-slot="popover-title"]')
        ?.getBoundingClientRect();
      const actionBounds = Array.from(element.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Mark all read"))
        ?.getBoundingClientRect();
      const firstItemBounds = element
        .querySelector("[data-notification-id]")
        ?.getBoundingClientRect();
      const firstItemTitleBounds = element
        .querySelector('[data-slot="item-title"]')
        ?.getBoundingClientRect();

      return {
        actionInset: actionBounds ? bounds.right - actionBounds.right : null,
        itemTitleInset:
          firstItemBounds && firstItemTitleBounds
            ? firstItemTitleBounds.top - firstItemBounds.top
            : null,
        radius,
        titleInset: titleBounds ? titleBounds.left - bounds.left : null,
      };
    });
    expect(centerGeometry.titleInset).toBeCloseTo(centerGeometry.radius, 0);
    expect(centerGeometry.actionInset).toBeCloseTo(16, 0);
    expect(centerGeometry.itemTitleInset).toBeLessThanOrEqual(10);
    await expect(page.getByText("NEW", { exact: true })).toHaveCount(3);

    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(
      page.getByRole("button", { name: "Open notifications" }),
    ).toBeVisible();
    await expect(page.getByText("NEW", { exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(center).toBeHidden();
    await page.getByRole("button", { name: "Set tab away" }).click();
    await expect(page.getByText("away", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Return to tab" }).click();
    await expect(batchToasts).toHaveCount(0);
  });

  test("collapses overflow into one digest toast", async ({ page }) => {
    await page.goto("/dev/components/while-away-notifications?case=digest");

    await page.getByRole("button", { name: "Set tab away" }).click();
    await expect(page.getByText("away", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Queue 5" }).click();
    await page.getByRole("button", { name: "Return to tab" }).click();

    await expect(
      page.getByText("5 notifications while you were away", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "View all" })).toBeVisible();
    const digest = page.getByTestId("notification-digest");
    await expect(digest).toHaveAttribute("data-styled", "true");
    await expect(
      digest.locator('[data-slot="notification-status-rail"]'),
    ).toHaveCSS("height", "16px");
    await expect(
      digest.locator('[data-slot="notification-status-rail"]'),
    ).toHaveCSS("width", "2px");
    await expect(digest).toContainText(
      "Queued notification 1 · Queued notification 2",
    );
    await expect(
      page.locator('[data-testid^="notification-toast-"]'),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open notifications, 6 unread" }),
    ).toBeVisible();

    await page.addStyleTag({
      content:
        '[data-notification-scroll-area] [data-slot="scroll-area-viewport"] { height: 150px !important; max-height: 150px !important; }',
    });

    await page.getByRole("button", { name: "View all" }).click();
    const center = page.getByRole("dialog", { name: "Notifications" });
    await expect(center).toBeVisible();
    const viewport = center.locator('[data-slot="scroll-area-viewport"]');
    await expect(viewport).toBeVisible();
    const scrollSize = await viewport.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(scrollSize.scrollHeight).toBeGreaterThan(scrollSize.clientHeight);

    const newLabels = center.getByText("NEW", { exact: true });
    await expect(newLabels).toHaveCount(5);

    await viewport.hover();
    await page.mouse.wheel(0, 100);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await expect.poll(() => newLabels.count()).toBeLessThan(5);

    await page.keyboard.press("Escape");
    await expect(center).toBeHidden();
    await page
      .getByRole("button", { name: "Open notifications, 6 unread" })
      .click();
    await expect(center).toBeVisible();

    const newFlags = await center
      .locator("[data-notification-id]")
      .evaluateAll((items) =>
        items.map((item) => item.hasAttribute("data-new")),
      );
    const firstSeenIndex = newFlags.indexOf(false);
    expect(firstSeenIndex).toBeGreaterThan(0);
    expect(newFlags.slice(firstSeenIndex)).not.toContain(true);
  });

  test("keeps an empty notification center inside a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dev/components/while-away-notifications?case=empty");

    await page.getByRole("button", { name: "Open notifications" }).click();
    const center = page.getByRole("dialog", { name: "Notifications" });
    await expect(center).toBeVisible();
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    await expect
      .poll(async () => (await center.boundingBox())?.x)
      .toBeGreaterThanOrEqual(0);
    await expect
      .poll(async () => {
        const bounds = await center.boundingBox();
        return bounds ? bounds.x + bounds.width : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(390);
  });

  test("removes notification-center movement for reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/components/while-away-notifications?case=empty");

    await page.getByRole("button", { name: "Open notifications" }).click();
    await expect(page.getByRole("dialog", { name: "Notifications" })).toHaveCSS(
      "transform",
      "none",
    );
  });
});
