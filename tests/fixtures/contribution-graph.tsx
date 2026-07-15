"use client";

import { formatISO, subDays } from "date-fns";
import type { Activity } from "@/components/kibo-ui/contribution-graph";
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from "@/components/kibo-ui/contribution-graph";

function createActivityData(sparse = false): Activity[] {
  const end = new Date("2026-07-13T00:00:00Z");
  return Array.from({ length: 371 }, (_, index) => {
    const age = 370 - index;
    const level = sparse
      ? age % 23 === 0
        ? (((age % 4) + 1) as 1 | 2 | 3 | 4)
        : 0
      : (index * 7 + Math.floor(index / 9)) % 5;
    return {
      date: formatISO(subDays(end, age), { representation: "date" }),
      count: level * 2,
      level,
    };
  });
}

function GraphExample({ sparse = false }: { sparse?: boolean }) {
  const data = createActivityData(sparse);
  return (
    <div className="w-full overflow-hidden">
      <ContributionGraph
        blockMargin={2}
        blockSize={8}
        data={data}
        fontSize={10}
        labels={{ totalCount: "{{count}} deterministic contributions" }}
        weekStart={1}
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
        <ContributionGraphFooter className="mt-1.5 text-xs text-muted-foreground">
          <ContributionGraphTotalCount />
          <ContributionGraphLegend />
        </ContributionGraphFooter>
      </ContributionGraph>
    </div>
  );
}

export function ContributionGraphDefaultFixture() {
  return <GraphExample />;
}

export function ContributionGraphSparseFixture() {
  return <GraphExample sparse />;
}

export function ContributionGraphNoLabelsFixture() {
  const data = createActivityData();
  return (
    <div className="w-full overflow-hidden">
      <ContributionGraph
        blockMargin={2}
        blockSize={8}
        data={data}
        fontSize={10}
        weekStart={1}
      >
        <ContributionGraphCalendar hideMonthLabels>
          {({ activity, dayIndex, weekIndex }) => (
            <ContributionGraphBlock
              activity={activity}
              dayIndex={dayIndex}
              weekIndex={weekIndex}
            />
          )}
        </ContributionGraphCalendar>
      </ContributionGraph>
    </div>
  );
}
