"use client";

import { useQuery } from "@tanstack/react-query";
import { formatISO, subDays } from "date-fns";
import { useEffect, useState } from "react";
import type { Activity } from "@/components/kibo-ui/contribution-graph";
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from "@/components/kibo-ui/contribution-graph";

const generateFallbackData = (
  baseDate = new Date("2026-06-23"),
): Activity[] => {
  const data: Activity[] = [];

  for (let index = 370; index >= 0; index--) {
    data.push({
      date: formatISO(subDays(baseDate, index), { representation: "date" }),
      count: 0,
      level: 0,
    });
  }

  return data;
};

export type GitHubContributionsProps = {
  endpoint?: string;
};

export default function GitHubContributions({
  endpoint = "/api/github-contributions",
}: GitHubContributionsProps) {
  const [mounted, setMounted] = useState(false);
  const [fallbackData, setFallbackData] = useState<Activity[]>(() =>
    generateFallbackData(),
  );

  useEffect(() => {
    setMounted(true);
    setFallbackData(generateFallbackData(new Date()));
  }, []);

  const { data, isLoading } = useQuery<Activity[]>({
    queryKey: ["github-contributions", endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Failed to fetch contributions");
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <ContributionGraph
        data={data ?? fallbackData}
        blockSize={8}
        blockMargin={2}
        fontSize={10}
        weekStart={1}
        labels={{ totalCount: "{{count}} contributions in the last year" }}
      >
        <ContributionGraphCalendar>
          {({ activity, dayIndex, weekIndex }) => (
            <ContributionGraphBlock
              activity={activity}
              dayIndex={dayIndex}
              weekIndex={weekIndex}
            />
          )}
        </ContributionGraphCalendar>
        <ContributionGraphFooter className="mt-1.5 text-[10px] text-muted-foreground">
          {!mounted || isLoading ? (
            <span className="animate-pulse text-muted-foreground">
              Loading contributions...
            </span>
          ) : (
            <>
              <ContributionGraphTotalCount />
              <ContributionGraphLegend />
            </>
          )}
        </ContributionGraphFooter>
      </ContributionGraph>
    </div>
  );
}
