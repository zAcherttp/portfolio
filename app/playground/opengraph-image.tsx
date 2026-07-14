import { profile } from "@/data/profile";
import { staticSeo } from "@/lib/seo/routes";
import { createSocialCard } from "@/lib/seo/social-card";

export const alt = `Interactive shader playground by ${profile.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createSocialCard({
    ...staticSeo.playground,
    accent: "#ea580c",
  });
}
