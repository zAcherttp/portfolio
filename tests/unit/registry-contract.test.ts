import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { componentRegistry } from "@/data/components";

type RegistryJsonItem = {
  name: string;
  title: string;
  description: string;
  categories: string[];
  dependencies?: string[];
  registryDependencies?: string[];
  files: { path: string; type: string }[];
  meta?: { status?: string };
};

type RegistryJson = {
  items: RegistryJsonItem[];
};

const registryJson: RegistryJson = JSON.parse(
  readFileSync(resolve(__dirname, "../../registry.json"), "utf-8"),
);

/**
 * Registry dependencies in registry.json use qualified names like
 * "zAcherttp/portfolio/activity-grid" while data/components.ts uses
 * bare slugs like "activity-grid". This extracts the bare slug.
 */
function bareSlug(qualifiedOrBare: string): string {
  const lastSlash = qualifiedOrBare.lastIndexOf("/");
  return lastSlash === -1
    ? qualifiedOrBare
    : qualifiedOrBare.slice(lastSlash + 1);
}

describe("registry metadata contract", () => {
  it("has the same set of component slugs", () => {
    const dataSlugs = componentRegistry.map((entry) => entry.slug).sort();
    const registrySlugs = registryJson.items.map((item) => item.name).sort();

    expect(registrySlugs).toEqual(dataSlugs);
  });

  for (const entry of componentRegistry) {
    describe(entry.slug, () => {
      const registryItem = registryJson.items.find(
        (item) => item.name === entry.slug,
      );
      if (!registryItem) {
        throw new Error(`${entry.slug} is missing from registry.json.`);
      }

      it("has a matching title", () => {
        expect(registryItem.title).toBe(entry.name);
      });

      it("has a matching description", () => {
        expect(registryItem.description).toBe(entry.description);
      });

      it("has a matching status", () => {
        expect(registryItem.meta?.status).toBe(entry.status);
      });

      it("shows every installable component file in the docs Source tab", () => {
        // registry.json component files must appear in data/components.ts
        // so the docs Source tab shows all installable source.
        // data/components.ts may include extra files (app wrappers, usage
        // examples) that are not part of the install manifest.
        const dataFiles = new Set(entry.files);
        const installableComponentFiles = registryItem.files
          .filter((f) => f.type === "registry:component")
          .map((f) => f.path);

        for (const file of installableComponentFiles) {
          expect(dataFiles).toContain(file);
        }
      });

      it("includes every listed npm dependency", () => {
        const registryDeps = registryItem.dependencies ?? [];

        for (const dep of entry.dependencies) {
          expect(registryDeps).toContain(dep);
        }
      });

      it("includes every listed registry dependency (bare slug comparison)", () => {
        const registryRegDeps = (registryItem.registryDependencies ?? []).map(
          bareSlug,
        );

        for (const dep of entry.registryDependencies) {
          expect(registryRegDeps).toContain(dep);
        }
      });
    });
  }
});
