import { cacheLife } from "next/cache";
import { savesData } from "@/data/saves";
import { getDomainName } from "@/utils/url";

export type FaviconMap = Record<string, string | null>;

// Fetches all saves' favicons in one shot, cached server-side monthly.
// Uses Promise.allSettled so a single failure never blocks the rest.
export async function getAllFavicons(): Promise<FaviconMap> {
  "use cache";
  cacheLife("monthly");

  const domains = [...new Set(savesData.map((b) => getDomainName(b.url)))];

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const res = await fetch(
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      );
      if (!res.ok) return [domain, null] as const;

      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const contentType = res.headers.get("content-type") ?? "image/png";

      return [domain, `data:${contentType};base64,${base64}`] as const;
    }),
  );

  return Object.fromEntries(
    (
      results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<
        readonly [string, string | null]
      >[]
    ).map((r) => r.value),
  );
}
