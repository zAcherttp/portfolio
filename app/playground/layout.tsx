import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageJsonLd, SeoJsonLd } from "@/lib/seo/json-ld";
import { createSeoMetadata } from "@/lib/seo/metadata";
import { staticSeo } from "@/lib/seo/routes";

export const metadata: Metadata = createSeoMetadata(staticSeo.playground);

export default function PlaygroundLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <SeoJsonLd
        data={createPageJsonLd({
          ...staticSeo.playground,
          title: staticSeo.playground.title,
        })}
      />
      {children}
    </>
  );
}
