import type { Metadata } from "next";
import { siteConfig } from "./site";

export type SeoMetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  keywords?: readonly string[];
  noIndex?: boolean;
};

export function getAbsoluteTitle(title?: string) {
  return title ? `${title} | ${siteConfig.name}` : siteConfig.defaultTitle;
}

export function createSeoMetadata({
  title,
  description = siteConfig.description,
  path = "/",
  type = "website",
  keywords,
  noIndex = false,
}: SeoMetadataInput = {}): Metadata {
  const absoluteTitle = getAbsoluteTitle(title);

  return {
    title: title
      ? title
      : {
          default: siteConfig.defaultTitle,
          template: `%s | ${siteConfig.name}`,
        },
    description,
    alternates: { canonical: path },
    authors: [{ name: siteConfig.name, url: siteConfig.githubUrl }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    keywords: keywords ? [...keywords] : undefined,
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type,
      locale: siteConfig.locale,
      url: path,
      siteName: siteConfig.name,
      title: absoluteTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: absoluteTitle,
      description,
    },
  };
}
