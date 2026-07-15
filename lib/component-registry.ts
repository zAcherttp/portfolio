import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const componentPathSchema = nonEmptyStringSchema.refine(
  (value) => value.startsWith("components/") && !value.includes(".."),
  "Expected a path inside components/.",
);

export const registryStatusSchema = z.enum(["stable", "exploring"]);

const registryFileSchema = z
  .object({
    path: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    target: nonEmptyStringSchema.optional(),
  })
  .passthrough();

const registryItemSchema = z
  .object({
    name: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    categories: z.array(nonEmptyStringSchema).min(1),
    dependencies: z.array(nonEmptyStringSchema).default([]),
    registryDependencies: z.array(nonEmptyStringSchema).default([]),
    files: z.array(registryFileSchema).min(1),
    meta: z
      .object({
        status: registryStatusSchema,
      })
      .passthrough(),
  })
  .passthrough();

const registryManifestSchema = z
  .object({
    name: nonEmptyStringSchema,
    items: z.array(registryItemSchema).min(1),
  })
  .passthrough()
  .superRefine(({ name, items }, context) => {
    const names = new Set<string>();

    items.forEach((item, index) => {
      if (names.has(item.name)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate registry item: ${item.name}`,
          path: ["items", index, "name"],
        });
      }
      names.add(item.name);
    });

    const namespace = `@${name}`;

    items.forEach((item, itemIndex) => {
      item.registryDependencies.forEach((dependency, dependencyIndex) => {
        const dependencyPath = [
          "items",
          itemIndex,
          "registryDependencies",
          dependencyIndex,
        ];

        if (dependency.startsWith(`${namespace}/`)) {
          const target = dependency.slice(namespace.length + 1);

          if (!names.has(target)) {
            context.addIssue({
              code: "custom",
              message: `Same-registry dependency "${dependency}" does not match an item in registry.json.`,
              path: dependencyPath,
            });
          }
          return;
        }

        const target = dependency.slice(dependency.lastIndexOf("/") + 1);

        if (names.has(target)) {
          context.addIssue({
            code: "custom",
            message: `Same-registry dependency "${dependency}" must use "${namespace}/${target}".`,
            path: dependencyPath,
          });
        }
      });
    });
  });

const registryResolverConfigSchema = z
  .object({
    registries: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const componentUsageSchema = z.object({
  format: z.literal("jsx"),
  selector: nonEmptyStringSchema,
  source: componentPathSchema,
});

const componentDocsMetadataSchema = z
  .object({
    primaryCategory: nonEmptyStringSchema.optional(),
    additionalSourceFiles: z.array(componentPathSchema).default([]),
    usage: componentUsageSchema,
  })
  .strict();

const registryEntrySchema = z.object({
  slug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  category: nonEmptyStringSchema,
  categories: z.array(nonEmptyStringSchema).min(1),
  description: nonEmptyStringSchema,
  status: registryStatusSchema,
  files: z.array(componentPathSchema).min(1),
  dependencies: z.array(nonEmptyStringSchema),
  registryDependencies: z.array(nonEmptyStringSchema),
  usage: componentUsageSchema,
});

type ValidatedRegistryEntry = z.infer<typeof registryEntrySchema>;

export type RegistryStatus = z.infer<typeof registryStatusSchema>;
export type ComponentDocsMetadata = {
  readonly primaryCategory?: string;
  readonly additionalSourceFiles?: readonly string[];
  readonly usage: {
    readonly format: "jsx";
    readonly selector: string;
    readonly source: string;
  };
};
export type RegistryEntry<Slug extends string = string> = Omit<
  ValidatedRegistryEntry,
  "slug"
> & {
  slug: Slug;
};

export function parseRegistryManifest(input: unknown) {
  return registryManifestSchema.parse(input);
}

function formatCategory(category: string) {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeRegistryDependency(dependency: string) {
  return dependency.slice(dependency.lastIndexOf("/") + 1);
}

export function createComponentRegistry<
  const Docs extends Record<string, ComponentDocsMetadata>,
>(
  manifestInput: unknown,
  docsInput: Docs,
  resolverConfigInput: unknown,
): readonly RegistryEntry<Extract<keyof Docs, string>>[] {
  type Slug = Extract<keyof Docs, string>;

  const manifest = parseRegistryManifest(manifestInput);
  const resolverConfig =
    registryResolverConfigSchema.parse(resolverConfigInput);
  const namespace = `@${manifest.name}`;

  if (!Object.hasOwn(resolverConfig.registries, namespace)) {
    throw new Error(
      `Registry namespace "${namespace}" is missing from components.json.`,
    );
  }

  const docs = z
    .record(z.string(), componentDocsMetadataSchema)
    .parse(docsInput);
  const expectedSlugs = new Set(Object.keys(docs));
  const registrySlugs = new Set<string>();
  const isExpectedSlug = (value: string): value is Slug =>
    expectedSlugs.has(value);

  const entries = manifest.items.map((item): RegistryEntry<Slug> => {
    if (!isExpectedSlug(item.name)) {
      throw new Error(
        `Registry item "${item.name}" is missing documentation metadata in data/components.ts.`,
      );
    }

    registrySlugs.add(item.name);
    const metadata = docs[item.name];
    const primaryCategory = metadata.primaryCategory ?? item.categories[0];

    if (!item.categories.includes(primaryCategory)) {
      throw new Error(
        `Documentation category "${primaryCategory}" is not declared by registry item "${item.name}".`,
      );
    }

    const files = [
      ...new Set([
        ...item.files
          .map((file) => file.path)
          .filter((path) => path.startsWith("components/")),
        ...metadata.additionalSourceFiles,
      ]),
    ];

    const entry = {
      slug: item.name,
      name: item.title,
      category: formatCategory(primaryCategory),
      categories: item.categories,
      description: item.description,
      status: item.meta.status,
      files,
      dependencies: item.dependencies,
      registryDependencies: item.registryDependencies.map(
        normalizeRegistryDependency,
      ),
      usage: metadata.usage,
    };

    const validatedEntry = registryEntrySchema.parse(entry);
    return { ...validatedEntry, slug: item.name };
  });

  for (const slug of expectedSlugs) {
    if (!registrySlugs.has(slug)) {
      throw new Error(
        `Documentation metadata "${slug}" is missing from registry.json.`,
      );
    }
  }

  return entries;
}
