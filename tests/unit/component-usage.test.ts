import { describe, expect, it } from "vitest";
import { componentRegistry } from "@/data/components";
import { captureComponentUsage } from "@/lib/component-usage";

describe("captureComponentUsage", () => {
  for (const entry of componentRegistry) {
    it(`captures a concise ${entry.slug} usage`, async () => {
      const usage = await captureComponentUsage(entry.usage);

      expect(usage.code).toContain(`<${entry.usage.selector}`);
      expect(usage.code).not.toContain("function ");
      expect(usage.language).toBe("tsx");
      expect(usage.title).toMatch(/^[a-z\d-]+\.tsx$/);
    });
  }

  it("captures GlobalHotkeys for the Theme Hotkey code example", async () => {
    const themeHotkey = componentRegistry.find(
      (entry) => entry.slug === "theme-hotkey",
    );
    if (!themeHotkey) throw new Error("Theme Hotkey is not registered.");

    const usage = await captureComponentUsage(themeHotkey.usage);

    expect(usage.title).toBe("global-hotkeys.tsx");
    expect(usage.code).toContain(
      'import GlobalHotkeys from "./GlobalHotkeys";',
    );
    expect(usage.code).toContain("<GlobalHotkeys />");
    expect(usage.code).not.toContain("<Tooltip");
  });
});
