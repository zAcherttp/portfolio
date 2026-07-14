import { describe, expect, it } from "vitest";
import { typeTableGenerator } from "@/lib/type-table";

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
] as const;

describe("component API type tables", () => {
  for (const documentedType of documentedTypes) {
    it(`documents only ${documentedType.name} component props`, async () => {
      const docs = await typeTableGenerator.generateTypeTable({
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
