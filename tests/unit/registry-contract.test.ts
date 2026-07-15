import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { componentRegistry } from "@/data/components";
import {
  createComponentRegistry,
  parseRegistryManifest,
} from "@/lib/component-registry";
import registryManifest from "@/registry.json";

function bareSlug(qualifiedOrBare: string) {
  return qualifiedOrBare.slice(qualifiedOrBare.lastIndexOf("/") + 1);
}

function getValidationMessages(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((issue) => issue.message);
    }
    throw error;
  }

  throw new Error("Expected registry validation to fail.");
}

const parsedRegistryManifest = parseRegistryManifest(registryManifest);

const exampleManifest = {
  name: "example",
  items: [
    {
      name: "example",
      type: "registry:component",
      title: "Example Component",
      description: "Canonical registry metadata.",
      categories: ["data-display", "composition"],
      dependencies: ["example-package"],
      registryDependencies: ["owner/repository/dependency"],
      files: [
        {
          path: "components/example.tsx",
          type: "registry:component",
        },
        {
          path: "lib/example.ts",
          type: "registry:lib",
        },
      ],
      meta: { status: "stable" },
    },
  ],
};

const exampleResolverConfig = {
  registries: {
    "@example": "https://example.com/r/{name}.json",
  },
};

const exampleDocsMetadata = {
  example: {
    primaryCategory: "composition",
    additionalSourceFiles: ["components/example-preview.tsx"],
    usage: {
      format: "jsx" as const,
      selector: "Example",
      source: "components/example-preview.tsx",
    },
  },
};

describe("registry metadata contract", () => {
  it("derives every distributable field from registry.json", () => {
    expect(componentRegistry.map((entry) => entry.slug)).toEqual(
      parsedRegistryManifest.items.map((item) => item.name),
    );

    for (const item of parsedRegistryManifest.items) {
      const entry = componentRegistry.find(
        (component) => component.slug === item.name,
      );

      expect(entry).toBeDefined();
      expect(entry).toMatchObject({
        slug: item.name,
        name: item.title,
        description: item.description,
        categories: item.categories,
        status: item.meta.status,
        dependencies: item.dependencies,
        registryDependencies: item.registryDependencies.map(bareSlug),
      });

      for (const file of item.files.filter((candidate) =>
        candidate.path.startsWith("components/"),
      )) {
        expect(entry?.files).toContain(file.path);
      }
    }
  });

  it("keeps every documented source file resolvable", () => {
    for (const entry of componentRegistry) {
      for (const file of entry.files) {
        expect(existsSync(resolve(__dirname, "../..", file)), file).toBe(true);
      }
    }
  });

  it("merges only documentation presentation metadata", () => {
    expect(
      createComponentRegistry(
        exampleManifest,
        exampleDocsMetadata,
        exampleResolverConfig,
      ),
    ).toEqual([
      {
        slug: "example",
        name: "Example Component",
        category: "Composition",
        categories: ["data-display", "composition"],
        description: "Canonical registry metadata.",
        status: "stable",
        files: ["components/example.tsx", "components/example-preview.tsx"],
        dependencies: ["example-package"],
        registryDependencies: ["dependency"],
        usage: exampleDocsMetadata.example.usage,
      },
    ]);
  });

  it("rejects registry and documentation slug drift", () => {
    expect(() =>
      createComponentRegistry(
        exampleManifest,
        {
          other: exampleDocsMetadata.example,
        },
        exampleResolverConfig,
      ),
    ).toThrow(
      'Registry item "example" is missing documentation metadata in data/components.ts.',
    );

    expect(() =>
      createComponentRegistry(
        exampleManifest,
        {
          ...exampleDocsMetadata,
          orphan: exampleDocsMetadata.example,
        },
        exampleResolverConfig,
      ),
    ).toThrow('Documentation metadata "orphan" is missing from registry.json.');
  });

  it("rejects a presentation category outside canonical registry categories", () => {
    expect(() =>
      createComponentRegistry(
        exampleManifest,
        {
          example: {
            ...exampleDocsMetadata.example,
            primaryCategory: "utility",
          },
        },
        exampleResolverConfig,
      ),
    ).toThrow(
      'Documentation category "utility" is not declared by registry item "example".',
    );
  });

  it("requires the registry namespace in components.json", () => {
    expect(() =>
      createComponentRegistry(exampleManifest, exampleDocsMetadata, {
        registries: {},
      }),
    ).toThrow('Registry namespace "@example" is missing from components.json.');
  });

  it("rejects unstable or missing same-registry dependency targets", () => {
    const consumer = {
      ...exampleManifest.items[0],
      name: "consumer",
      title: "Consumer",
      files: [
        {
          path: "components/consumer.tsx",
          type: "registry:component",
        },
      ],
    };

    expect(
      getValidationMessages(() =>
        parseRegistryManifest({
          ...exampleManifest,
          items: [
            exampleManifest.items[0],
            {
              ...consumer,
              registryDependencies: ["owner/repository/example"],
            },
          ],
        }),
      ),
    ).toContain(
      'Same-registry dependency "owner/repository/example" must use "@example/example".',
    );

    expect(
      getValidationMessages(() =>
        parseRegistryManifest({
          ...exampleManifest,
          items: [
            exampleManifest.items[0],
            {
              ...consumer,
              registryDependencies: ["@example/missing"],
            },
          ],
        }),
      ),
    ).toContain(
      'Same-registry dependency "@example/missing" does not match an item in registry.json.',
    );
  });
});
