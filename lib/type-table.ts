import {
  createFileSystemGeneratorCache,
  createGenerator,
} from "fumadocs-typescript";

export const typeTableGenerator = createGenerator({
  cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
  tsconfigPath: "tsconfig.json",
});
