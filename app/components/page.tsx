import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import ComponentRegistryList from "@/components/ComponentRegistryList";
import { componentDocs } from "@/lib/component-docs-source";
import { createPageJsonLd, SeoJsonLd } from "@/lib/seo/json-ld";
import { createSeoMetadata } from "@/lib/seo/metadata";
import { staticSeo } from "@/lib/seo/routes";

export const metadata: Metadata = createSeoMetadata(staticSeo.components);

export default function ComponentsPage() {
  const documentedComponents = componentDocs
    .getPages()
    .map((page) => page.data.entry);

  return (
    <>
      <SeoJsonLd
        data={createPageJsonLd({
          ...staticSeo.components,
          title: staticSeo.components.title,
          type: "CollectionPage",
        })}
      />
      <main className="min-h-screen text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-8 sm:py-12">
          <BackButton className="mb-10" href="/">
            Profile
          </BackButton>

          <header className="mb-12">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-xl font-bold">Components</h1>
              {process.env.NODE_ENV === "development" && (
                <Link
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  href="/dev/components"
                >
                  <FlaskConical className="size-3.5" />
                  Fixtures
                </Link>
              )}
            </div>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-6 text-muted-foreground">
              A growing registry of interface details, interactions, and visual
              experiments. These are local APIs for now; installable registry
              packages will come after their interfaces settle.
            </p>
          </header>
          <ComponentRegistryList entries={documentedComponents} />
        </div>
      </main>
    </>
  );
}
