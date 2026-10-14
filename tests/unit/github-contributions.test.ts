import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/github-contributions/route";
import { profile } from "@/data/profile";
import {
  combineContributions,
  resolveContributionUsernames,
} from "@/lib/github-contributions";

describe("combined GitHub activity", () => {
  it("adds counts by date, sorts dates, and recalculates bounded intensity", () => {
    const personal = [
      { date: "2026-10-01", count: 3, level: 4 },
      { date: "2026-09-29", count: 0, level: 0 },
    ];
    const work = [
      { date: "2026-09-30", count: 2, level: 4 },
      { date: "2026-10-01", count: 5, level: 4 },
    ];
    expect(combineContributions([personal, work])).toEqual([
      { date: "2026-09-29", count: 0, level: 0 },
      { date: "2026-09-30", count: 2, level: 1 },
      { date: "2026-10-01", count: 8, level: 4 },
    ]);
    expect(personal[0].count).toBe(3);
    expect(work[1].count).toBe(5);
  });

  it("handles calendars without activity", () => {
    expect(combineContributions([])).toEqual([]);
    expect(
      combineContributions([[{ date: "2026-10-01", count: 0, level: 0 }]]),
    ).toEqual([{ date: "2026-10-01", count: 0, level: 0 }]);
  });

  it("defaults to both accounts and keeps work activity with the legacy setting", () => {
    expect(
      resolveContributionUsernames(profile.githubContributionUsernames, {}),
    ).toEqual(["zacherttp", "phat-learneris"]);
    expect(
      resolveContributionUsernames(profile.githubContributionUsernames, {
        GITHUB_USERNAME: "  ",
      }),
    ).toEqual(["zacherttp", "phat-learneris"]);
    expect(
      resolveContributionUsernames(profile.githubContributionUsernames, {
        GITHUB_USERNAME: "zAcherttp",
      }),
    ).toEqual(["zacherttp", "phat-learneris"]);
  });

  it("supports an explicit account list and deduplicates case-insensitively", () => {
    expect(
      resolveContributionUsernames(profile.githubContributionUsernames, {
        GITHUB_USERNAMES: " zAcherttp, Phat-Learneris, ZACHERTTP ",
        GITHUB_USERNAME: "ignored",
      }),
    ).toEqual(["zacherttp", "phat-learneris"]);
  });

  it.each([
    "",
    "valid,",
    "../invalid",
    "bad--name",
    "-bad",
    "bad-",
    "a".repeat(40),
  ])("rejects invalid configured accounts: %s", (GITHUB_USERNAMES) => {
    expect(() =>
      resolveContributionUsernames(profile.githubContributionUsernames, {
        GITHUB_USERNAMES,
      }),
    ).toThrow();
  });
});

describe("GitHub contributions endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_USERNAME", "zAcherttp");
    vi.stubEnv("GITHUB_USERNAMES", undefined);
    vi.stubEnv(
      "GITHUB_CONTRIBUTIONS_API_URL",
      "https://contributions.example/v4",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function mockCalendars(
    workResponse: Response = Response.json({
      contributions: [{ date: "2026-10-01", count: 5, level: 4 }],
    }),
  ) {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("phat-learneris")
        ? workResponse
        : Response.json({
            contributions: [{ date: "2026-10-01", count: 3, level: 4 }],
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("returns the combined array using both configured accounts", async () => {
    const fetchMock = mockCalendars();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("public");
    await expect(response.json()).resolves.toEqual([
      { date: "2026-10-01", count: 8, level: 4 },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      "https://contributions.example/v4/phat-learneris?y=last",
      "https://contributions.example/v4/zacherttp?y=last",
    ]);
  });

  it("fetches a duplicate account only once", async () => {
    vi.stubEnv("GITHUB_USERNAMES", "zAcherttp,ZACHERTTP");
    const fetchMock = mockCalendars();
    const response = await GET();
    await expect(response.json()).resolves.toEqual([
      { date: "2026-10-01", count: 3, level: 4 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not serve a partial total when the work provider fails", async () => {
    mockCalendars(new Response("unavailable", { status: 503 }));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "upstream_unavailable" },
    });
  });

  it("rejects malformed and duplicate daily data", async () => {
    for (const contributions of [
      [{ date: "invalid", count: 5, level: 4 }],
      [{ date: "2026-10-01", count: -1, level: 4 }],
      Array(2).fill({ date: "2026-10-01", count: 5, level: 4 }),
      [],
    ]) {
      mockCalendars(Response.json({ contributions }));
      expect((await GET()).status).toBe(502);
    }
  });

  it("rejects invalid configuration before making a request", async () => {
    vi.stubEnv("GITHUB_USERNAMES", "../invalid");
    const fetchMock = mockCalendars();
    expect((await GET()).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
