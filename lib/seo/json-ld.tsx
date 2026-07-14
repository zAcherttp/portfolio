import { siteConfig } from "./site";

export type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue =
  | JsonLdPrimitive
  | JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

export function absoluteUrl(path: string) {
  return new URL(path, siteConfig.url).toString();
}

export function serializeJsonLd(data: JsonLdValue) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function createPersonJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${absoluteUrl("/")}#person`,
    name: siteConfig.name,
    jobTitle: siteConfig.role,
    url: absoluteUrl("/"),
    sameAs: [siteConfig.githubUrl, siteConfig.linkedInUrl],
  } satisfies JsonLdValue;
}

export function createWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: siteConfig.name,
    description: siteConfig.description,
    url: absoluteUrl("/"),
    author: { "@id": `${absoluteUrl("/")}#person` },
    inLanguage: siteConfig.language,
  } satisfies JsonLdValue;
}

export function createPageJsonLd({
  title,
  description,
  path,
  type = "WebPage",
}: {
  title: string;
  description: string;
  path: string;
  type?: "WebPage" | "ProfilePage" | "CollectionPage" | "TechArticle";
}) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    description,
    url: absoluteUrl(path),
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    author: { "@id": `${absoluteUrl("/")}#person` },
    inLanguage: siteConfig.language,
  } satisfies JsonLdValue;
}

export function SeoJsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized and escapes HTML opening brackets.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      type="application/ld+json"
    />
  );
}
