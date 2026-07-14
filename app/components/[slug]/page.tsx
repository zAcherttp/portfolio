import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentDocsShell } from "@/components/docs/component-docs-shell";
import { ComponentPreview } from "@/components/docs/component-preview";
import { componentDocs } from "@/lib/component-docs-source";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return componentDocs.getPages().map((page) => ({
    slug: page.data.entry.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = componentDocs.getPage([slug]);
  return page
    ? {
        title: `${page.data.title} | Components`,
        description: page.data.description,
      }
    : {};
}

export default async function ComponentPage({ params }: Props) {
  const { slug } = await params;
  const page = componentDocs.getPage([slug]);
  if (!page) notFound();
  const { entry } = page.data;
  const { default: Content } = await page.data.loadDocument();
  return (
    <ComponentDocsShell
      entry={entry}
      preview={<ComponentPreview slug={entry.slug} />}
    >
      <Content />
    </ComponentDocsShell>
  );
}
