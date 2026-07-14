import { expect, test } from "@playwright/test";

const framedPreviews = [
  { slug: "activity-grid", mode: "wide" },
  { slug: "contribution-graph", mode: "wide" },
  { slug: "dither-footer", mode: "canvas" },
  { slug: "theme-hotkey", mode: "compact" },
  { slug: "kbd", mode: "wide" },
] as const;

test.describe("component preview contrast", () => {
  for (const { slug, mode } of framedPreviews) {
    test(`${slug} uses a borderless page-colored ${mode} frame`, async ({
      page,
    }) => {
      await page.goto(`/components/${slug}`);

      const frame = page.locator(`[data-preview-frame="${mode}"]`);
      await expect(frame).toBeVisible();

      const styles = await frame.evaluate((element) => {
        const panel = element.closest('[role="tabpanel"]');
        if (!(panel instanceof HTMLElement)) {
          throw new Error("Preview frame is missing its tab panel");
        }

        const frameStyle = getComputedStyle(element);
        const panelStyle = getComputedStyle(panel);
        const bodyStyle = getComputedStyle(document.body);

        return {
          backgroundColor: frameStyle.backgroundColor,
          bodyBackgroundColor: bodyStyle.backgroundColor,
          borderBottomWidth: frameStyle.borderBottomWidth,
          borderLeftWidth: frameStyle.borderLeftWidth,
          borderRightWidth: frameStyle.borderRightWidth,
          borderTopWidth: frameStyle.borderTopWidth,
          borderRadius: frameStyle.borderRadius,
          boxShadow: frameStyle.boxShadow,
          panelBorderRadius: panelStyle.borderRadius,
        };
      });

      expect(styles.backgroundColor).toBe(styles.bodyBackgroundColor);
      expect(styles.borderBottomWidth).toBe("0px");
      expect(styles.borderLeftWidth).toBe("0px");
      expect(styles.borderRightWidth).toBe("0px");
      expect(styles.borderTopWidth).toBe("0px");
      expect(styles.boxShadow).toBe("none");
      expect(styles.borderRadius).toBe(styles.panelBorderRadius);
    });
  }

  test("keeps the floating tooltip preview bare", async ({ page }) => {
    await page.goto("/components/floating-tooltip");

    await expect(page.locator("[data-preview-frame]")).toHaveCount(0);
  });
});
