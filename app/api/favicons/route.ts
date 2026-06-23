import { NextResponse } from "next/server";
import { getAllFavicons } from "@/lib/favicons";

// Bulk favicon endpoint — returns all bookmark favicons as a JSON map
// { domain: dataUrl | null }. No ?domain= param — the set of domains
// is fixed to bookmarksData and never user-supplied.
export async function GET() {
  const faviconMap = await getAllFavicons();

  return NextResponse.json(faviconMap, {
    headers: {
      // Browser caches for 30 days; matches server-side monthly cache
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
