import { describe, expect, test } from "vitest";
import { getComponentDocsMarkdown } from "@/lib/component-docs-markdown";

describe("component docs Markdown", () => {
  test("returns readable Markdown with expanded API tables", async () => {
    const markdown = await getComponentDocsMarkdown("activity-grid");

    expect(markdown).toContain("# Activity Grid");
    expect(markdown).toContain(
      "> A generic SVG grid with responsive geometry and virtual-anchor cell interaction.",
    );
    expect(markdown).toContain("| Prop | Type | Description |");
    expect(markdown).toContain("| columns |");
    expect(markdown).not.toContain("<AutoTypeTable");
  });

  test("does not read a document for an unknown slug", async () => {
    await expect(
      getComponentDocsMarkdown("not-a-component"),
    ).resolves.toBeNull();
  });
});
