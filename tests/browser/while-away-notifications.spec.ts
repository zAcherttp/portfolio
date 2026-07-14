import { expect, test } from "@playwright/test";

test.describe("while-away notifications", () => {
  test("queues a temporary notification for the tab that wakes", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let visibilityState: DocumentVisibilityState = "visible";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibilityState,
      });
      Object.assign(window, {
        setFixtureVisibility(nextState: DocumentVisibilityState) {
          visibilityState = nextState;
          document.dispatchEvent(new Event("visibilitychange"));
        },
      });
    });
    await page.goto("/components/while-away-notifications");
    await page.evaluate(() => {
      (
        window as typeof window & {
          setFixtureVisibility: (state: DocumentVisibilityState) => void;
        }
      ).setFixtureVisibility("hidden");
    });
    await page.waitForTimeout(1600);

    await page.evaluate(() => {
      (
        window as typeof window & {
          setFixtureVisibility: (state: DocumentVisibilityState) => void;
        }
      ).setFixtureVisibility("visible");
    });
    await expect(page.locator("[data-notification-toast]")).toHaveCount(1);
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

    await expect(page.locator("[data-notification-toast]")).toHaveCount(3);
    const trigger = page.getByRole("button", {
      name: "Open notifications, 4 unread",
    });
    await expect(trigger).toBeVisible();
    await page
      .getByRole("button", { name: "Open", exact: true })
      .first()
      .click();

    await expect(page.locator("[data-notification-toast]")).toHaveCount(0);
    await expect(page.locator("[data-notification-center]")).toBeVisible();
    await expect(page.locator("[data-notification-id]")).toHaveCount(4);
    await expect(page.getByText("NEW", { exact: true })).toHaveCount(3);

    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(
      page.getByRole("button", { name: "Open notifications" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-notification-center]")).toBeHidden();
    await page.getByRole("button", { name: "Set tab away" }).click();
    await expect(page.getByText("away", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Return to tab" }).click();
    await expect(page.locator("[data-notification-toast]")).toHaveCount(0);
  });

  test("collapses overflow into one digest toast", async ({ page }) => {
    await page.goto("/dev/components/while-away-notifications?case=digest");

    await page.getByRole("button", { name: "Set tab away" }).click();
    await expect(page.getByText("away", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Queue 5" }).click();
    await page.getByRole("button", { name: "Return to tab" }).click();

    await expect(page.locator('[data-notification-digest="5"]')).toBeVisible();
    await expect(page.locator("[data-notification-toast]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open notifications, 6 unread" }),
    ).toBeVisible();
  });

  test("supports an empty notification center and reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/components/while-away-notifications?case=empty");

    await page.getByRole("button", { name: "Open notifications" }).click();
    const center = page.locator("[data-notification-center]");
    await expect(center).toBeVisible();
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    await expect(center).toHaveCSS("transform", "none");
  });
});
