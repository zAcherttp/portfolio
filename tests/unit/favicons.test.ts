import { afterEach, describe, expect, it, vi } from "vitest";
import { bookmarksData } from "@/data/bookmarks";
import { getAllFavicons } from "@/lib/favicons";
import { getDomainName } from "@/utils/url";

const domains = [
  ...new Set(bookmarksData.map((bookmark) => getDomainName(bookmark.url))),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("favicon aggregation", () => {
  it("keeps failed domains in the result and limits upstream concurrency", async () => {
    const failedDomain = domains[0];
    let activeRequests = 0;
    let maxActiveRequests = 0;

    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const domain = url.searchParams.get("domain");

        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeRequests -= 1;

        if (domain === failedDomain) {
          return new Response(null, { status: 404 });
        }

        return new Response("icon", {
          headers: { "content-type": "image/png" },
        });
      }),
    );

    const result = await getAllFavicons("partial-failure");

    expect(Object.keys(result)).toHaveLength(domains.length);
    expect(result[failedDomain]).toBeNull();
    expect(maxActiveRequests).toBeLessThanOrEqual(4);
  });

  it("rejects a total upstream failure instead of returning an empty object", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    await expect(getAllFavicons("total-failure")).rejects.toThrow(
      "All favicon upstream requests failed",
    );
  });
});
