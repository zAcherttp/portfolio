import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityGrid } from "@/components/registry/activity-grid";

type Cell = { id: string; active?: boolean };

const columns: Cell[][] = [
  [{ id: "0-0" }, { id: "0-1" }],
  [{ id: "1-0" }, { id: "1-1" }],
];

function renderGrid(
  onActiveCellChange = vi.fn(),
  cells: Array<Array<Cell | undefined>> = columns,
) {
  return render(
    <ActivityGrid
      cellSize={10}
      columns={cells}
      gap={2}
      labelHeight={4}
      getKey={(item, column, row) => item?.id ?? `${column}-${row}`}
      isInteractive={(item): item is Cell => Boolean(item?.active ?? item)}
      onActiveCellChange={onActiveCellChange}
      renderCell={({ item, columnIndex, rowIndex }) => (
        <rect
          data-testid={`cell-${columnIndex}-${rowIndex}`}
          height={10}
          width={10}
          x={columnIndex * 12}
          y={4 + rowIndex * 12}
        >
          <title>{item?.id ?? "missing"}</title>
        </rect>
      )}
      renderLabels={() => <text data-testid="labels">Days</text>}
      title="Test activity"
    />,
  );
}

describe("ActivityGrid", () => {
  it("renders nothing for empty columns or rows", () => {
    const { container, rerender } = render(
      <ActivityGrid
        cellSize={10}
        columns={[]}
        gap={2}
        getKey={(_, column, row) => `${column}-${row}`}
        renderCell={() => null}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <ActivityGrid
        cellSize={10}
        columns={[[]]}
        gap={2}
        getKey={(_, column, row) => `${column}-${row}`}
        renderCell={() => null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders its calculated geometry, title, labels, and cells", () => {
    renderGrid();

    const svg = screen.getByTitle("Test activity").closest("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 22 26");
    expect(screen.getByTestId("labels")).toHaveTextContent("Days");
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(4);
  });

  it("reports a scaled virtual anchor and deduplicates the active cell", () => {
    const onChange = vi.fn();
    const { container } = renderGrid(onChange);
    const region = container.firstElementChild as HTMLDivElement;
    const svg = container.querySelector("svg") as SVGSVGElement;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 310,
      height: 260,
      left: 100,
      right: 320,
      top: 50,
      width: 220,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(region, { clientX: 230, clientY: 220 });
    expect(onChange).toHaveBeenCalledWith({
      item: columns[1][1],
      columnIndex: 1,
      rowIndex: 1,
      anchor: { left: 220, top: 210, width: 100, height: 100 },
    });

    fireEvent.pointerMove(region, { clientX: 230, clientY: 220 });
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(region);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clears when moving from an active cell to a non-interactive cell", () => {
    const onChange = vi.fn();
    const sparse = [[{ id: "active", active: true }, undefined]];
    const { container } = renderGrid(onChange, sparse);
    const region = container.firstElementChild as HTMLDivElement;
    const svg = container.querySelector("svg") as SVGSVGElement;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      bottom: 30,
      height: 26,
      left: 0,
      right: 10,
      top: 4,
      width: 10,
      x: 0,
      y: 4,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(region, { clientX: 5, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(region, { clientX: 5, clientY: 22 });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
