import { describe, expect, it } from "vitest";
import { profile } from "@/data/profile";
import {
  createPageJsonLd,
  createPersonJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { createSeoMetadata, getAbsoluteTitle } from "@/lib/seo/metadata";
import { staticSeo } from "@/lib/seo/routes";
import { siteConfig } from "@/lib/seo/site";

describe("SEO metadata", () => {
  it("keeps the public identity contract explicit", () => {
    expect(profile).toMatchObject({
      name: "Tuấn Phát",
      role: "Frontend Developer",
    });
  });

  it("creates branded root metadata and complete social fields", () => {
    const metadata = createSeoMetadata(staticSeo.home);

    expect(metadata.title).toEqual({
      default: siteConfig.defaultTitle,
      template: `%s | ${siteConfig.name}`,
    });
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({
      title: siteConfig.defaultTitle,
      description: staticSeo.home.description,
      siteName: siteConfig.name,
      url: "/",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: siteConfig.defaultTitle,
      description: staticSeo.home.description,
    });
  });

  it("brands route titles and keeps noindex routes out of search", () => {
    const metadata = createSeoMetadata({
      ...staticSeo.projects,
      noIndex: true,
    });

    expect(metadata.title).toBe("Projects");
    expect(getAbsoluteTitle("Projects")).toBe(`Projects | ${profile.name}`);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({
      title: `Projects | ${profile.name}`,
      url: "/projects",
    });
  });

  it("keeps every static canonical path unique", () => {
    const paths = Object.values(staticSeo).map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("SEO structured data", () => {
  it("builds person and page entities with absolute URLs", () => {
    expect(createPersonJsonLd()).toMatchObject({
      "@type": "Person",
      name: profile.name,
      jobTitle: profile.role,
    });
    expect(
      createPageJsonLd({
        ...staticSeo.projects,
        title: staticSeo.projects.title,
        type: "CollectionPage",
      }),
    ).toMatchObject({
      "@type": "CollectionPage",
      name: "Projects",
      url: expect.stringMatching(/\/projects$/),
    });
  });

  it("escapes HTML opening brackets before rendering JSON-LD", () => {
    expect(serializeJsonLd({ name: "</script><script>" })).toContain(
      "\\u003c/script>\\u003cscript>",
    );
  });
});
