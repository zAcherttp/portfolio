import {
  createFileSystemGeneratorCache,
  createGenerator,
} from "fumadocs-typescript";

const typeTableCache = createFileSystemGeneratorCache(
  ".next/fumadocs-typescript",
);

type GenerateTypeTableArgs = Parameters<
  ReturnType<typeof createGenerator>["generateTypeTable"]
>;

export function generateTypeTable(...args: GenerateTypeTableArgs) {
  // A generator retains its ts-morph Project. Keeping it request-scoped lets
  // old TypeScript ASTs be collected after edits and hot reloads.
  const generator = createGenerator({
    cache: typeTableCache,
    tsconfigPath: "tsconfig.json",
  });

  return generator.generateTypeTable(...args);
}
