import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { ComponentDocsShell } from "@/components/docs/component-docs-shell";
import { ComponentPreview } from "@/components/docs/component-preview";
import {
  componentDocs,
  getComponentDocsNeighbours,
} from "@/lib/component-docs-source";
import { captureComponentUsage } from "@/lib/component-usage";
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

async function renderComponentPage(slug: string) {
  "use cache";
  cacheLife("max");

  const page = componentDocs.getPage([slug]);
  if (!page) notFound();
  const { entry } = page.data;
  const { default: Content } = await page.data.loadDocument();
  const usage = await captureComponentUsage(entry.usage);
  const { previous, next } = getComponentDocsNeighbours(slug);
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
        next={next}
        preview={<ComponentPreview slug={entry.slug} />}
        previous={previous}
        usage={usage}
      >
        <Content />
      </ComponentDocsShell>
    </>
  );
}

export default async function ComponentPage({ params }: Props) {
  "use cache";
  cacheLife("max");
  const { slug } = await params;
  return renderComponentPage(slug);
}
