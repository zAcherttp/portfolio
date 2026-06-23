import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";

// Cached server function (Layer 2)
async function getCachedFavicon(domain: string) {
  "use cache";
  cacheLife("monthly");

  const res = await fetch(
    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
  );
  if (!res.ok) {
    throw new Error("Failed to fetch favicon image");
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const contentType = res.headers.get("content-type") || "image/png";

  return { base64, contentType };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json(
      { error: "Missing domain parameter" },
      { status: 400 },
    );
  }

  try {
    const { base64, contentType } = await getCachedFavicon(domain);
    const buffer = Buffer.from(base64, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        // Browser Caching (Layer 1): Cache locally in browser monthly as immutable
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error proxying favicon request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
