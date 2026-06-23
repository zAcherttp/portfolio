import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";
import type { Activity } from "../../../components/kibo-ui/contribution-graph";

type APIActivity = {
  date: string;
  contributionCount: number;
  contributionLevel: string;
  color: string;
};

const mapLevel = (levelStr: string): number => {
  switch (levelStr) {
    case "NONE":
      return 0;
    case "FIRST_QUARTILE":
      return 1;
    case "SECOND_QUARTILE":
      return 2;
    case "THIRD_QUARTILE":
      return 3;
    case "FOURTH_QUARTILE":
      return 4;
    default:
      return 0;
  }
};

// Cached server function (Layer 2)
async function getCachedContributions(username: string, baseUrl: string) {
  "use cache";
  cacheLife("daily");

  const url = `${baseUrl}/${username}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch contributions: ${res.statusText}`);
  }

  const data = (await res.json()) as { contributions: APIActivity[][] };
  const weeks = data.contributions;
  const contributions: Activity[] = weeks.flat().map((item) => ({
    date: item.date,
    count: item.contributionCount,
    level: mapLevel(item.contributionLevel),
  }));

  return contributions;
}

export async function GET() {
  const username = process.env.GITHUB_USERNAME;
  const baseUrl = process.env.GITHUB_CONTRIBUTIONS_API_URL;

  if (!username || !baseUrl) {
    return NextResponse.json(
      { error: "GitHub configuration missing in server environment" },
      { status: 500 },
    );
  }

  try {
    const data = await getCachedContributions(username, baseUrl);
    return NextResponse.json(data, {
      headers: {
        // Client browser caching of the API response for 1 hour to reduce server load
        "Cache-Control": "public, max-age=3600, stale-while-revalidate",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch contribution graph";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
