import { cacheLife } from "next/cache";
import { bookmarksData } from "@/data/bookmarks";
import { fetchBoundedBytes } from "@/lib/bounded-fetch";
import { getDomainName } from "@/utils/url";

export type FaviconMap = Record<string, string | null>;

const FAVICON_MAX_BYTES = 64 * 1024;
const FAVICON_TIMEOUT_MS = 5_000;
const FAVICON_FETCH_CONCURRENCY = 4;

// Fetches all bookmarks' favicons in bounded batches, cached server-side monthly.
// Individual failures degrade to null; a total failure is left uncached for retry.
export async function getAllFavicons(
  _cacheBuster: string,
): Promise<FaviconMap> {
  "use cache";
  cacheLife("monthly");

  const domains = [...new Set(bookmarksData.map((b) => getDomainName(b.url)))];

  const entries: [string, string | null][] = [];
  const failures: string[] = [];

  for (
    let index = 0;
    index < domains.length;
    index += FAVICON_FETCH_CONCURRENCY
  ) {
    const batch = domains.slice(index, index + FAVICON_FETCH_CONCURRENCY);
    const batchEntries = await Promise.all(
      batch.map(async (domain): Promise<[string, string | null]> => {
        try {
          const { bytes, contentType } = await fetchBoundedBytes(
            `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            {
              maxBytes: FAVICON_MAX_BYTES,
              timeoutMs: FAVICON_TIMEOUT_MS,
            },
          );
          const base64 = Buffer.from(bytes).toString("base64");

          return [domain, `data:${contentType};base64,${base64}`];
        } catch (error) {
          failures.push(`${domain}: ${String(error)}`);
          return [domain, null];
        }
      }),
    );

    entries.push(...batchEntries);
  }

  if (failures.length > 0) {
    console.warn(
      `[favicons] ${failures.length} upstream requests failed`,
      failures,
    );
  }

  if (!entries.some(([, favicon]) => favicon !== null)) {
    throw new Error("All favicon upstream requests failed");
  }

  return Object.fromEntries(entries);
}
