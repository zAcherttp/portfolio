import { profile } from "@/data/profile";

function toUrl(value: string | undefined) {
  if (!value) return null;
  const normalized = value.startsWith("http") ? value : `https://${value}`;

  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

export function resolveSiteUrl() {
  return (
    toUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    toUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    toUrl(process.env.VERCEL_URL) ??
    new URL("http://localhost:3000")
  );
}

export const siteConfig = {
  ...profile,
  locale: "en_US",
  language: "en",
  url: resolveSiteUrl(),
} as const;
