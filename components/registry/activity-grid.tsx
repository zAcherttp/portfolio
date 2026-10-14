"use client";

import {
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import type { VirtualAnchor } from "./floating-tooltip";

export type ActiveGridCell<T> = {
  item: T;
  columnIndex: number;
  rowIndex: number;
  anchor: VirtualAnchor;
};

export type ActivityGridOwnProps<T> = {
  /** Column-major data rendered into the SVG grid. */
  columns: Array<Array<T | undefined>>;
  /** Width and height of each square cell in SVG units. */
  cellSize: number;
  /** Space between adjacent cells in SVG units. */
  gap: number;
  /** Vertical space reserved above the cells for custom labels. */
  labelHeight?: number;
  /** Minimum scrollable content width in CSS pixels. */
  minContentWidth?: number;
  /** Accessible name for the SVG, without a browser-native hover tooltip. */
  title?: string;
  /** Returns a stable React key for a grid position. */
  getKey: (
    item: T | undefined,
    columnIndex: number,
    rowIndex: number,
  ) => string;
  /** Renders the SVG content for one grid position. */
  renderCell: (props: {
    item: T | undefined;
    columnIndex: number;
    rowIndex: number;
  }) => ReactNode;
  /** Renders optional labels inside the grid SVG. */
  renderLabels?: () => ReactNode;
  /** Determines whether a position can become the active cell. */
  isInteractive?: (item: T | undefined) => item is T;
  /** Reports active-cell changes with a viewport-aware virtual anchor. */
  onActiveCellChange?: (cell: ActiveGridCell<T> | null) => void;
  /** Additional classes for the scroll container. */
  className?: string;
};

export type ActivityGridProps<T> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | keyof ActivityGridOwnProps<T>
> &
  ActivityGridOwnProps<T>;

export function ActivityGrid<T>({
  columns,
  cellSize,
  gap,
  labelHeight = 0,
  minContentWidth,
  title = "Activity grid",
  getKey,
  renderCell,
  renderLabels,
  isInteractive = (item): item is T => item !== undefined,
  onActiveCellChange,
  className,
  ...props
}: ActivityGridProps<T>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const activeKeyRef = useRef("");
  const activeItemRef = useRef<T | undefined>(undefined);
  const rowCount = Math.max(0, ...columns.map((column) => column.length));
  const stride = cellSize + gap;
  const width = columns.length * stride - gap;
  const height = labelHeight + rowCount * stride - gap;
  const resolvedMinContentWidth = Math.max(width, minContentWidth ?? width);

  const clearActiveCell = useCallback(() => {
    if (!activeKeyRef.current) return;
    activeKeyRef.current = "";
    activeItemRef.current = undefined;
    onActiveCellChange?.(null);
  }, [onActiveCellChange]);

  useEffect(() => {
    const viewport = window.visualViewport;
    // A fresh pointer sample is needed after the grid's screen geometry changes.
    window.addEventListener("scroll", clearActiveCell, true);
    window.addEventListener("resize", clearActiveCell);
    viewport?.addEventListener("scroll", clearActiveCell);
    viewport?.addEventListener("resize", clearActiveCell);
    return () => {
      window.removeEventListener("scroll", clearActiveCell, true);
      window.removeEventListener("resize", clearActiveCell);
      viewport?.removeEventListener("scroll", clearActiveCell);
      viewport?.removeEventListener("resize", clearActiveCell);
    };
  }, [clearActiveCell]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || height <= 0) return;

    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const svgY = ((event.clientY - rect.top) / rect.height) * height;
    const columnIndex = Math.floor(svgX / stride);
    const rowIndex = Math.floor((svgY - labelHeight) / stride);
    const item = columns[columnIndex]?.[rowIndex];

    if (
      columnIndex < 0 ||
      columnIndex >= columns.length ||
      rowIndex < 0 ||
      rowIndex >= rowCount ||
      !isInteractive(item)
    ) {
      clearActiveCell();
      return;
    }

    const key = `${columnIndex}-${rowIndex}`;
    if (key === activeKeyRef.current && item === activeItemRef.current) return;
    activeKeyRef.current = key;
    activeItemRef.current = item;

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;

    onActiveCellChange?.({
      item,
      columnIndex,
      rowIndex,
      anchor: {
        // Client rects already use layout-viewport CSS pixels. Pinch-pan offsets
        // belong to tooltip collision bounds, not this document-space anchor.
        left: window.scrollX + rect.left + columnIndex * stride * scaleX,
        top:
          window.scrollY +
          rect.top +
          (labelHeight + rowIndex * stride) * scaleY,
        width: cellSize * scaleX,
        height: cellSize * scaleY,
      },
    });
  };

  if (columns.length === 0 || rowCount === 0) return null;

  return (
    <div
      className={cn("w-full min-w-0 max-w-full overflow-x-auto", className)}
      {...props}
      onPointerMove={handlePointerMove}
      onPointerLeave={clearActiveCell}
    >
      <div
        className="relative w-full"
        style={{ minWidth: resolvedMinContentWidth }}
      >
        <svg
          ref={svgRef}
          role="img"
          aria-label={title}
          className="block h-auto w-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
        >
          {renderLabels?.()}
          {columns.map((column, columnIndex) =>
            column.map((item, rowIndex) => (
              <g key={getKey(item, columnIndex, rowIndex)}>
                {renderCell({ item, columnIndex, rowIndex })}
              </g>
            )),
          )}
        </svg>
      </div>
    </div>
  );
}
