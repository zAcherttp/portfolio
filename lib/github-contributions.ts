import type { Activity } from "@/components/kibo-ui/contribution-graph";

export function resolveContributionUsernames(
  defaults: readonly string[],
  environment: { GITHUB_USERNAMES?: string; GITHUB_USERNAME?: string },
): string[] {
  const configured =
    environment.GITHUB_USERNAMES !== undefined
      ? environment.GITHUB_USERNAMES.split(",")
      : [
          environment.GITHUB_USERNAME?.trim() || defaults[0] || "",
          ...defaults.slice(1),
        ];
  const usernames = [
    ...new Set(configured.map((name) => name.trim().toLowerCase())),
  ];

  if (
    usernames.length === 0 ||
    usernames.length > 10 ||
    usernames.some(
      (name) => !name || !/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(name),
    )
  ) {
    throw new Error("Configure valid GitHub contribution usernames.");
  }

  return usernames;
}

export function combineContributions(
  calendars: readonly (readonly Activity[])[],
): Activity[] {
  const counts = new Map<string, number>();
  for (const calendar of calendars) {
    for (const { date, count } of calendar) {
      counts.set(date, (counts.get(date) ?? 0) + count);
    }
  }

  const maximum = Math.max(0, ...counts.values());
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({
      date,
      count,
      // Recalculate intensity from the combined counts; levels cannot be added.
      level: count === 0 ? 0 : Math.ceil((count / maximum) * 4),
    }));
}
