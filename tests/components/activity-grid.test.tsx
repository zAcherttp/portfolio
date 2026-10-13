import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ActiveGridCell,
  ActivityGrid,
} from "@/components/registry/activity-grid";

type Cell = { id: string; active?: boolean };

const columns: Cell[][] = [
  [{ id: "0-0" }, { id: "0-1" }],
  [{ id: "1-0" }, { id: "1-1" }],
];

function gridElement(
  onActiveCellChange: (cell: ActiveGridCell<Cell> | null) => void,
  cells: Array<Array<Cell | undefined>>,
) {
  return (
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
    />
  );
}

function renderGrid(
  onActiveCellChange = vi.fn(),
  cells: Array<Array<Cell | undefined>> = columns,
) {
  return render(gridElement(onActiveCellChange, cells));
}

describe("ActivityGrid", () => {
  afterEach(() => vi.unstubAllGlobals());

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

    const svg = screen.getByRole("img", { name: "Test activity" });
    // A root SVG title creates a second, browser-owned hover tooltip.
    expect(svg.querySelector(":scope > title")).toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 22 26");
    expect(svg?.parentElement).toHaveStyle({ minWidth: "22px" });
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

  it("keeps document anchors aligned when the visual viewport is panned", () => {
    vi.stubGlobal(
      "visualViewport",
      Object.assign(new EventTarget(), {
        pageLeft: 90,
        pageTop: 240,
        offsetLeft: 60,
        offsetTop: 40,
        scale: 2,
      }),
    );
    vi.stubGlobal("scrollX", 30);
    vi.stubGlobal("scrollY", 200);
    const onChange = vi.fn();
    const { container } = renderGrid(onChange);
    const svg = container.querySelector("svg") as SVGSVGElement;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 50, 220, 260),
    );

    fireEvent.pointerMove(container.firstElementChild as Element, {
      clientX: 230,
      clientY: 220,
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: columns[1][1],
        anchor: { left: 250, top: 410, width: 100, height: 100 },
      }),
    );
  });

  it.each(["scroll", "resize"])(
    "lets the same cell become active again after %s",
    (type) => {
      const onChange = vi.fn();
      const { container } = renderGrid(onChange);
      const region = container.firstElementChild as Element;
      const svg = container.querySelector("svg") as SVGSVGElement;
      vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 22, 26),
      );
      fireEvent.pointerMove(region, { clientX: 5, clientY: 9 });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ item: columns[0][0] }),
      );

      fireEvent(window, new Event(type));
      expect(onChange).toHaveBeenLastCalledWith(null);
      fireEvent.pointerMove(region, { clientX: 5, clientY: 9 });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ item: columns[0][0] }),
      );
    },
  );

  it("reports fresh data when a hovered position is updated", () => {
    const onChange = vi.fn();
    const { container, rerender } = renderGrid(onChange);
    const svg = container.querySelector("svg") as SVGSVGElement;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 22, 26),
    );
    fireEvent.pointerMove(container.firstElementChild as Element, {
      clientX: 5,
      clientY: 9,
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ item: columns[0][0] }),
    );

    const refreshed = { id: "updated-day" };
    rerender(gridElement(onChange, [[refreshed, columns[0][1]], columns[1]]));
    fireEvent.pointerMove(container.firstElementChild as Element, {
      clientX: 5,
      clientY: 9,
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ item: refreshed }),
    );
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
