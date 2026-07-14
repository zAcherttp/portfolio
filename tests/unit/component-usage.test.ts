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
});
