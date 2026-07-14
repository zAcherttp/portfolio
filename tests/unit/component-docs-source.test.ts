import { describe, expect, test } from "vitest";
import { componentRegistry } from "@/data/components";
import {
  componentDocs,
  getComponentDocsNeighbours,
} from "@/lib/component-docs-source";

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

  test("derives adjacent components without wrapping at the boundaries", () => {
    expect(getComponentDocsNeighbours("floating-tooltip")).toEqual({
      previous: null,
      next: componentRegistry[1],
    });
    expect(getComponentDocsNeighbours("activity-grid")).toEqual({
      previous: componentRegistry[0],
      next: componentRegistry[2],
    });
    expect(getComponentDocsNeighbours("kbd")).toEqual({
      previous: componentRegistry.at(-2),
      next: null,
    });
    expect(getComponentDocsNeighbours("not-a-component")).toEqual({
      previous: null,
      next: null,
    });
  });
});
