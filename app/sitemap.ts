import type { MetadataRoute } from "next";
import { componentRegistry } from "@/data/components";
import { absoluteUrl } from "@/lib/seo/json-ld";
import { staticSeo } from "@/lib/seo/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = Object.values(staticSeo).map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.path === "/" ? "monthly" : "weekly",
    priority: page.path === "/" ? 1 : 0.7,
  })) satisfies MetadataRoute.Sitemap;

  const componentRoutes = componentRegistry.map((component) => ({
    url: absoluteUrl(`/components/${component.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...componentRoutes];
}
