"use client";

import {
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
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

export type ActivityGridProps<T> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  columns: Array<Array<T | undefined>>;
  cellSize: number;
  gap: number;
  labelHeight?: number;
  minContentWidth?: number;
  title?: string;
  getKey: (
    item: T | undefined,
    columnIndex: number,
    rowIndex: number,
  ) => string;
  renderCell: (props: {
    item: T | undefined;
    columnIndex: number;
    rowIndex: number;
  }) => ReactNode;
  renderLabels?: () => ReactNode;
  isInteractive?: (item: T | undefined) => item is T;
  onActiveCellChange?: (cell: ActiveGridCell<T> | null) => void;
};

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
  const rowCount = Math.max(0, ...columns.map((column) => column.length));
  const stride = cellSize + gap;
  const width = columns.length * stride - gap;
  const height = labelHeight + rowCount * stride - gap;
  const resolvedMinContentWidth = Math.max(width, minContentWidth ?? width);

  const clearActiveCell = () => {
    if (!activeKeyRef.current) return;
    activeKeyRef.current = "";
    onActiveCellChange?.(null);
  };

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
    if (key === activeKeyRef.current) return;
    activeKeyRef.current = key;

    const viewport = window.visualViewport;
    const pageLeft = viewport?.pageLeft ?? window.scrollX;
    const pageTop = viewport?.pageTop ?? window.scrollY;
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;

    onActiveCellChange?.({
      item,
      columnIndex,
      rowIndex,
      anchor: {
        left: pageLeft + rect.left + columnIndex * stride * scaleX,
        top: pageTop + rect.top + (labelHeight + rowIndex * stride) * scaleY,
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
          className="block h-auto w-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
        >
          <title>{title}</title>
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
