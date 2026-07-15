import fs from "node:fs/promises";
import path from "node:path";
import {
  createFileSystemGeneratorCache,
  createGenerator,
} from "fumadocs-typescript";
import { codeToHast } from "shiki";

const CODE_THEMES = {
  light: "github-light",
  dark: "vesper",
} as const;

const AUTO_TYPE_TABLE_PATTERN =
  /<AutoTypeTable\s+path="([^"]+)"\s+name="([^"]+)"\s*\/>/g;

async function getMdxFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = path.resolve(dir, entry.name);
      return entry.isDirectory() ? getMdxFiles(res) : res;
    }),
  );
  return files.flat().filter((file) => file.endsWith(".mdx"));
}

async function highlightPropType(typeStr: string) {
  return codeToHast(typeStr, {
    lang: "typescript",
    themes: CODE_THEMES,
    defaultColor: false,
    transformers: [
      {
        line(node) {
          node.properties["data-line"] = "";
        },
      },
    ],
  });
}

const typeTableCache = createFileSystemGeneratorCache(
  ".next/fumadocs-typescript",
);

async function main() {
  console.log("Starting type table precomputation...");

  const contentDir = path.join(process.cwd(), "content", "components");
  const mdxFiles = await getMdxFiles(contentDir);
  console.log(`Found ${mdxFiles.length} MDX files to process.`);

  const generator = createGenerator({
    cache: typeTableCache,
    tsconfigPath: "tsconfig.json",
  });

  interface PrecomputedEntry {
    name: string;
    required: boolean;
    description?: string;
    highlightedType: unknown;
  }

  interface PrecomputedDoc {
    id: string;
    name: string;
    entries: PrecomputedEntry[];
  }

  const registry: Record<string, PrecomputedDoc[]> = {};

  for (const filePath of mdxFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const matches = Array.from(content.matchAll(AUTO_TYPE_TABLE_PATTERN));

    for (const match of matches) {
      const [, sourcePath, name] = match;
      const key = `${sourcePath}:${name}`;
      console.log(`Generating type table for key: ${key}`);

      try {
        const docs = await generator.generateTypeTable({
          path: sourcePath,
          name,
        });

        const highlightedDocs = await Promise.all(
          docs.map(async (doc) => ({
            id: doc.id,
            name: doc.name,
            entries: await Promise.all(
              doc.entries.map(async (entry) => ({
                name: entry.name,
                required: entry.required,
                description: entry.description,
                highlightedType: await highlightPropType(entry.type),
              })),
            ),
          })),
        );

        registry[key] = highlightedDocs;
      } catch (err) {
        console.error(`Error generating type table for ${key}:`, err);
        process.exit(1);
      }
    }
  }

  const outputDir = path.join(process.cwd(), "data");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "type-tables-registry.json");

  await fs.writeFile(
    outputPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
  console.log(`Successfully wrote precomputed type tables to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Precomputation failed:", err);
  process.exit(1);
});
