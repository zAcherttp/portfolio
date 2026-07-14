import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageJsonLd, SeoJsonLd } from "@/lib/seo/json-ld";
import { createSeoMetadata } from "@/lib/seo/metadata";
import { staticSeo } from "@/lib/seo/routes";

export const metadata: Metadata = createSeoMetadata(staticSeo.bookmarks);

export default function BookmarksLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={createPageJsonLd({
          ...staticSeo.bookmarks,
          title: staticSeo.bookmarks.title,
          type: "CollectionPage",
        })}
      />
      {children}
    </>
  );
}
