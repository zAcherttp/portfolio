"use client";

import { useState } from "react";
import {
  type ActiveGridCell,
  ActivityGrid,
} from "@/components/registry/activity-grid";

type Cell = { id: string; level: number };

function createColumns(count: number): Cell[][] {
  return Array.from({ length: count }, (_, column) =>
    Array.from({ length: 7 }, (_, row) => ({
      id: `${column}-${row}`,
      level: (column * 3 + row) % 5,
    })),
  );
}

function GridExample({
  columns,
  minContentWidth,
}: {
  columns: Cell[][];
  minContentWidth?: number;
}) {
  const [active, setActive] = useState<ActiveGridCell<Cell> | null>(null);
  return (
    <div className="w-full space-y-3">
      <ActivityGrid
        cellSize={8}
        columns={columns}
        gap={2}
        getKey={(item, column, row) => item?.id ?? `${column}-${row}`}
        minContentWidth={minContentWidth}
        onActiveCellChange={setActive}
        renderCell={({ item, columnIndex, rowIndex }) => (
          <rect
            className={
              item?.level === 0
                ? "fill-muted/40"
                : item?.level === 1
                  ? "fill-muted-foreground/20"
                  : item?.level === 2
                    ? "fill-muted-foreground/40"
                    : item?.level === 3
                      ? "fill-muted-foreground/60"
                      : "fill-muted-foreground/80"
            }
            height={8}
            rx={2}
            width={8}
            x={columnIndex * 10}
            y={rowIndex * 10}
          />
        )}
      />
      <output className="block font-mono text-[10px] text-muted-foreground">
        {active
          ? `${active.item.id} · level ${active.item.level}`
          : "No active cell"}
      </output>
    </div>
  );
}

export function ActivityGridDefaultFixture() {
  return <GridExample columns={createColumns(12)} />;
}

export function ActivityGridWideFixture() {
  return <GridExample columns={createColumns(32)} minContentWidth={1280} />;
}

export function ActivityGridEmptyFixture() {
  return (
    <div className="w-full" data-testid="empty-grid">
      <ActivityGrid
        cellSize={8}
        columns={[]}
        gap={2}
        getKey={(_, column, row) => `${column}-${row}`}
        renderCell={() => null}
      />
      <p className="text-center font-mono text-[10px] text-muted-foreground">
        Empty input renders no grid
      </p>
    </div>
  );
}
