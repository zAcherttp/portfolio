import { cacheLife } from "next/cache";
import { bookmarksData } from "@/data/bookmarks";
import { fetchBoundedBytes } from "@/lib/bounded-fetch";
import { getDomainName } from "@/utils/url";

export type FaviconMap = Record<string, string | null>;

const FAVICON_MAX_BYTES = 64 * 1024;
const FAVICON_TIMEOUT_MS = 5_000;

// Fetches all bookmarks' favicons in one shot, cached server-side monthly.
// Uses Promise.allSettled so a single failure never blocks the rest.
export async function getAllFavicons(
  _cacheBuster: string,
): Promise<FaviconMap> {
  "use cache";
  cacheLife("monthly");

  const domains = [...new Set(bookmarksData.map((b) => getDomainName(b.url)))];

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const { bytes, contentType } = await fetchBoundedBytes(
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        {
          maxBytes: FAVICON_MAX_BYTES,
          timeoutMs: FAVICON_TIMEOUT_MS,
        },
      );
      const base64 = Buffer.from(bytes).toString("base64");

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
