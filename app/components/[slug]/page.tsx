import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentDocsShell } from "@/components/docs/component-docs-shell";
import { ComponentPreview } from "@/components/docs/component-preview";
import { componentDocs } from "@/lib/component-docs-source";
import { createPageJsonLd, SeoJsonLd } from "@/lib/seo/json-ld";
import { createSeoMetadata } from "@/lib/seo/metadata";

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
    ? createSeoMetadata({
        title: `${page.data.title} | Components`,
        description: page.data.description,
        path: `/components/${page.data.entry.slug}`,
      })
    : {};
}

export default async function ComponentPage({ params }: Props) {
  const { slug } = await params;
  const page = componentDocs.getPage([slug]);
  if (!page) notFound();
  const { entry } = page.data;
  const { default: Content } = await page.data.loadDocument();
  return (
    <>
      <SeoJsonLd
        data={createPageJsonLd({
          title: `${page.data.title} | Components`,
          description: page.data.description,
          path: `/components/${entry.slug}`,
          type: "TechArticle",
        })}
      />
      <ComponentDocsShell
        entry={entry}
        preview={<ComponentPreview slug={entry.slug} />}
      >
        <Content />
      </ComponentDocsShell>
    </>
  );
}
