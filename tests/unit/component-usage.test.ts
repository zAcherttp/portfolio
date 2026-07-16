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

      // Verify that multi-line code is relatively dedented
      const lines = usage.code.split("\n");
      const jsxStartIndex = lines.findIndex((l) =>
        l.includes(`<${entry.usage.selector}`),
      );
      if (jsxStartIndex !== -1 && jsxStartIndex + 1 < lines.length) {
        const nextLine = lines[jsxStartIndex + 1];
        if (nextLine.trim() !== "" && !nextLine.startsWith("import")) {
          const leadingSpaces = nextLine.match(/^\s*/)?.[0].length ?? 0;
          expect(leadingSpaces).toBeLessThanOrEqual(4);
        }
      }
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
