import { describe, expect, test } from "vitest";
import { componentRegistry } from "@/data/components";
import { componentDocs } from "@/lib/component-docs-source";

describe("component docs source", () => {
  test("derives one stable documentation page from every registry entry", () => {
    const pages = componentDocs.getPages();

    expect(pages.map((page) => page.data.entry.slug)).toEqual(
      componentRegistry.map((entry) => entry.slug),
    );

    for (const entry of componentRegistry) {
      const page = componentDocs.getPage([entry.slug]);

      expect(page).toBeDefined();
      expect(page?.url).toBe(`/components/${entry.slug}`);
      expect(page?.data.title).toBe(entry.name);
      expect(page?.data.description).toBe(entry.description);
    }
  });

  test("does not resolve unknown component slugs", () => {
    expect(componentDocs.getPage(["not-a-component"])).toBeUndefined();
  });
});
