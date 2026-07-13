import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/registry/floating-tooltip", () => ({
  VirtualTooltip: ({ children }: { children: ReactNode }) => (
    <div role="tooltip">{children}</div>
  ),
}));

import {
  type Activity,
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount,
} from "@/components/kibo-ui/contribution-graph";

const data: Activity[] = [
  { date: "2026-01-07", count: 3, level: 2 },
  { date: "2026-01-05", count: 1, level: 1 },
];

function Calendar() {
  return (
    <ContributionGraphCalendar>
      {({ activity, dayIndex, weekIndex }) => (
        <ContributionGraphBlock
          activity={activity}
          dayIndex={dayIndex}
          data-testid={`block-${weekIndex}-${dayIndex}`}
          weekIndex={weekIndex}
        />
      )}
    </ContributionGraphCalendar>
  );
}

describe("ContributionGraph", () => {
  it("renders nothing for empty data", () => {
    const { container } = render(
      <ContributionGraph data={[]}>
        <Calendar />
      </ContributionGraph>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("sorts dates, fills holes, and pads to the configured week start", () => {
    render(
      <ContributionGraph
        blockMargin={2}
        blockSize={8}
        data={data}
        weekStart={0}
      >
        <Calendar />
      </ContributionGraph>,
    );

    const blocks = screen.getAllByTestId(/^block-/);
    expect(blocks).toHaveLength(4);
    expect(blocks.map((block) => block.getAttribute("data-date"))).toEqual([
      "",
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
    expect(blocks[0]).toHaveClass("opacity-0");
    expect(blocks[2]).toHaveAttribute("data-count", "0");
    expect(blocks[2]).toHaveAttribute("data-level", "0");
  });

  it("calculates totals and supports custom labels and render callbacks", () => {
    render(
      <ContributionGraph
        data={data}
        labels={{
          legend: { less: "Quiet", more: "Busy" },
          totalCount: "{{count}} events in {{year}}",
        }}
      >
        <ContributionGraphFooter>
          <ContributionGraphTotalCount />
          <ContributionGraphTotalCount>
            {({ totalCount, year }) => `${year}:${totalCount}`}
          </ContributionGraphTotalCount>
          <ContributionGraphLegend>
            {({ level }) => <span data-testid="legend-level">{level}</span>}
          </ContributionGraphLegend>
        </ContributionGraphFooter>
      </ContributionGraph>,
    );

    expect(screen.getByText("4 events in 2026")).toBeInTheDocument();
    expect(screen.getByText("2026:4")).toBeInTheDocument();
    expect(screen.getByText("Quiet")).toBeInTheDocument();
    expect(screen.getByText("Busy")).toBeInTheDocument();
    expect(screen.getAllByTestId("legend-level")).toHaveLength(5);
  });

  it("allows an explicit total and clamps the legend to at least one level", () => {
    render(
      <ContributionGraph data={data} maxLevel={0} totalCount={99}>
        <ContributionGraphTotalCount />
        <ContributionGraphLegend />
      </ContributionGraph>,
    );

    expect(screen.getByText("99 activities in 2026")).toBeInTheDocument();
    expect(screen.getAllByTitle(/contributions$/)).toHaveLength(2);
  });

  it("rejects activity levels outside the configured range", () => {
    expect(() =>
      render(
        <ContributionGraph data={[{ date: "2026-01-05", count: 8, level: 5 }]}>
          <Calendar />
        </ContributionGraph>,
      ),
    ).toThrow(RangeError);
  });
});
