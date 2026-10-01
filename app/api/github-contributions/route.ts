import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Activity } from "../../../components/kibo-ui/contribution-graph";
import { profile } from "../../../data/profile";
import { fetchBoundedJson } from "../../../lib/bounded-fetch";
import {
  combineContributions,
  resolveContributionUsernames,
} from "../../../lib/github-contributions";

const apiActivitySchema = z.object({
  date: z.iso.date(),
  count: z.number().int().nonnegative().max(100_000),
  level: z.number().int().min(0).max(4),
});

const githubContributionsSchema = z.object({
  contributions: z
    .array(apiActivitySchema)
    .min(1)
    .max(400)
    .refine(
      (days) => new Set(days.map((day) => day.date)).size === days.length,
      "Contribution dates must be unique within each account.",
    ),
});

const CONTRIBUTIONS_MAX_BYTES = 512 * 1024;
const CONTRIBUTIONS_TIMEOUT_MS = 5_000;
const DEFAULT_BASE_URL = "https://github-contributions-api.jogruber.de";

// Cached server function (Layer 2)
async function getCachedContributions(username: string, baseUrl: string) {
  "use cache";
  cacheLife("daily");

  const cleanBase = baseUrl.endsWith("/v4")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/v4`;
  const url = `${cleanBase}/${username}?y=last`;

  const data = await fetchBoundedJson(url, githubContributionsSchema, {
    maxBytes: CONTRIBUTIONS_MAX_BYTES,
    timeoutMs: CONTRIBUTIONS_TIMEOUT_MS,
  });

  return data.contributions as Activity[];
}

export async function GET() {
  const baseUrl = process.env.GITHUB_CONTRIBUTIONS_API_URL || DEFAULT_BASE_URL;
  let usernames: string[];

  try {
    usernames = resolveContributionUsernames(
      profile.githubContributionUsernames,
      {
        GITHUB_USERNAMES: process.env.GITHUB_USERNAMES,
        GITHUB_USERNAME: process.env.GITHUB_USERNAME,
      },
    );
  } catch {
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
    const calendars = await Promise.all(
      usernames.map((username) => getCachedContributions(username, baseUrl)),
    );
    const data = combineContributions(calendars);
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
