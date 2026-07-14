import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Activity } from "../../../components/kibo-ui/contribution-graph";
import { fetchBoundedJson } from "../../../lib/bounded-fetch";

const contributionLevelSchema = z.enum([
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
]);
const apiActivitySchema = z.object({
  date: z.iso.date(),
  contributionCount: z.number().int().nonnegative().max(100_000),
  contributionLevel: contributionLevelSchema,
});
const githubContributionsSchema = z.object({
  contributions: z.array(z.array(apiActivitySchema).max(7)).max(60),
});

type APIActivity = z.infer<typeof apiActivitySchema>;

const CONTRIBUTIONS_MAX_BYTES = 512 * 1024;
const CONTRIBUTIONS_TIMEOUT_MS = 5_000;

const mapLevel = (levelStr: APIActivity["contributionLevel"]): number => {
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
  const data = await fetchBoundedJson(url, githubContributionsSchema, {
    maxBytes: CONTRIBUTIONS_MAX_BYTES,
    timeoutMs: CONTRIBUTIONS_TIMEOUT_MS,
  });
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
      {
        error: {
          code: "api_configuration_unavailable",
          message: "Contribution data is temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
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
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "upstream_unavailable",
          message: "Contribution data is temporarily unavailable.",
        },
      },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
