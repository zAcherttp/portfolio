import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentDocsShell } from "@/components/docs/component-docs-shell";
import { ComponentPreview } from "@/components/docs/component-preview";
import { componentRegistry } from "@/data/components";

const docs = {
  "floating-tooltip": () => import("@/content/components/floating-tooltip.mdx"),
  "activity-grid": () => import("@/content/components/activity-grid.mdx"),
  "contribution-graph": () =>
    import("@/content/components/contribution-graph.mdx"),
  "dither-footer": () => import("@/content/components/dither-footer.mdx"),
  "theme-hotkey": () => import("@/content/components/theme-hotkey.mdx"),
  kbd: () => import("@/content/components/kbd.mdx"),
} as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return componentRegistry.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = componentRegistry.find((item) => item.slug === slug);
  return entry
    ? { title: `${entry.name} | Components`, description: entry.description }
    : {};
}

export default async function ComponentPage({ params }: Props) {
  const { slug } = await params;
  const entry = componentRegistry.find((item) => item.slug === slug);
  const loadDoc = docs[slug as keyof typeof docs];
  if (!entry || !loadDoc) notFound();
  const { default: Content } = await loadDoc();
  return (
    <ComponentDocsShell
      entry={entry}
      preview={<ComponentPreview slug={slug} />}
    >
      <Content />
    </ComponentDocsShell>
  );
}
