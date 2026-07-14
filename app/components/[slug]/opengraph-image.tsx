import { notFound } from "next/navigation";
import { componentRegistry } from "@/data/components";
import { profile } from "@/data/profile";
import { createSocialCard } from "@/lib/seo/social-card";

export const alt = `Component documentation by ${profile.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = componentRegistry.find((component) => component.slug === slug);
  if (!entry) notFound();

  return createSocialCard({
    title: entry.name,
    eyebrow: `${entry.category} component`,
    description: entry.description,
    accent: "#7c3aed",
  });
}
