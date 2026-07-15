import { NextResponse } from "next/server";
import { bookmarksData } from "@/data/bookmarks";
import { getAllFavicons } from "@/lib/favicons";

// Bulk favicon endpoint — returns all bookmarks' favicons as a JSON map
// { domain: dataUrl | null }. No ?domain= param — the set of domains
// is fixed to bookmarksData and never user-supplied.
export async function GET() {
  const cacheBuster = bookmarksData.map((b) => b.url).join(",");
  const faviconMap = await getAllFavicons(cacheBuster);

  return NextResponse.json(faviconMap, {
    headers: {
      // Browser caches for 30 days; matches server-side monthly cache
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
