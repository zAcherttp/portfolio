import { notFound } from "next/navigation";
import { getComponentDocsMarkdown } from "@/lib/component-docs-markdown";
import { componentDocs } from "@/lib/component-docs-source";

export function generateStaticParams() {
  return componentDocs.getPages().map((page) => ({
    slug: page.data.entry.slug,
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const markdown = await getComponentDocsMarkdown(slug);
  if (!markdown) notFound();

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
