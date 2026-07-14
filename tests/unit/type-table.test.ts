import { describe, expect, it } from "vitest";
import { generateTypeTable } from "@/lib/type-table";

const documentedTypes = [
  {
    name: "ActivityGridOwnProps",
    path: "components/registry/activity-grid.tsx",
    props: [
      "columns",
      "cellSize",
      "gap",
      "labelHeight",
      "minContentWidth",
      "title",
      "getKey",
      "renderCell",
      "renderLabels",
      "isInteractive",
      "onActiveCellChange",
      "className",
    ],
  },
  {
    name: "ContributionGraphOwnProps",
    path: "components/kibo-ui/contribution-graph/index.tsx",
    props: [
      "data",
      "blockMargin",
      "blockRadius",
      "blockSize",
      "fontSize",
      "labels",
      "maxLevel",
      "style",
      "totalCount",
      "weekStart",
      "children",
      "className",
    ],
  },
  {
    name: "DitherFooterProps",
    path: "components/DitherFooter.tsx",
    props: ["active", "className", "testId"],
  },
  {
    name: "GlobalHotkeysProps",
    path: "components/GlobalHotkeys.tsx",
    props: ["shortcut", "throttleMs", "ignoreInputs"],
  },
  {
    name: "KbdOwnProps",
    path: "components/ui/kbd.tsx",
    props: ["pressed", "reactive", "keyName", "className", "children"],
  },
] as const;

describe("component API type tables", () => {
  for (const documentedType of documentedTypes) {
    it(`documents only ${documentedType.name} component props`, async () => {
      const docs = await generateTypeTable({
        path: documentedType.path,
        name: documentedType.name,
      });
      const names = docs.flatMap((doc) =>
        doc.entries.map((entry) => entry.name),
      );

      expect(names).toEqual(documentedType.props);
      expect(names).not.toContain("defaultChecked");
    });
  }
});
