import {
  loader,
  type MetaData,
  type StaticSource,
  type VirtualFile,
} from "fumadocs-core/source";
import type { MDXProps } from "mdx/types";
import type { ComponentType } from "react";
import { componentRegistry, type RegisteredComponent } from "@/data/components";

type ComponentDocumentModule = {
  default: ComponentType<MDXProps>;
};

type ComponentDocumentLoader = () => Promise<ComponentDocumentModule>;

const componentDocumentLoaders = {
  "floating-tooltip": () => import("@/content/components/floating-tooltip.mdx"),
  "activity-grid": () => import("@/content/components/activity-grid.mdx"),
  "contribution-graph": () =>
    import("@/content/components/contribution-graph.mdx"),
  "dither-footer": () => import("@/content/components/dither-footer.mdx"),
  "theme-hotkey": () => import("@/content/components/theme-hotkey.mdx"),
  kbd: () => import("@/content/components/kbd.mdx"),
} satisfies Record<RegisteredComponent["slug"], ComponentDocumentLoader>;

type ComponentDocsPageData = {
  title: string;
  description: string;
  entry: RegisteredComponent;
  loadDocument: ComponentDocumentLoader;
};

type ComponentDocsSourceConfig = {
  pageData: ComponentDocsPageData;
  metaData: MetaData;
};

function createComponentDocsPage(
  entry: RegisteredComponent,
): VirtualFile<ComponentDocsSourceConfig> {
  return {
    type: "page",
    path: `${entry.slug}.mdx`,
    slugs: [entry.slug],
    data: {
      title: entry.name,
      description: entry.description,
      entry,
      loadDocument: componentDocumentLoaders[entry.slug],
    },
  };
}

const componentDocsSource = {
  files: componentRegistry.map(createComponentDocsPage),
} satisfies StaticSource<ComponentDocsSourceConfig>;

export const componentDocs = loader({
  baseUrl: "/components",
  source: componentDocsSource,
});

export function getComponentDocsNeighbours(slug: string) {
  const pages = componentDocs.getPages();
  const index = pages.findIndex((page) => page.data.entry.slug === slug);

  if (index === -1) return { previous: null, next: null };

  return {
    previous: pages[index - 1]?.data.entry ?? null,
    next: pages[index + 1]?.data.entry ?? null,
  };
}
