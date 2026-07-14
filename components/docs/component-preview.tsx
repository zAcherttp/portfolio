"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ComponentType, useState } from "react";
import GitHubContributions from "@/components/profile/GitHubContributions";
import {
  Tooltip,
  type VirtualAnchor,
  VirtualTooltip,
} from "@/components/registry/floating-tooltip";
import { Kbd } from "@/components/ui/kbd";
import type { ComponentSlug } from "@/data/components";
import { Keyboard60Preview } from "./keyboard-60-preview";

const tooltipData = [
  {
    label: "42 requests",
    column: 1,
    row: 1,
    columns: 5,
    rows: 5,
  },
  {
    label: "18 ms latency",
    column: 1,
    row: 6,
    columns: 3,
    rows: 3,
  },
  {
    label: "99.9% uptime",
    column: 4,
    row: 6,
    columns: 2,
    rows: 3,
  },
  {
    label: "7 deploys",
    column: 6,
    row: 1,
    columns: 5,
    rows: 3,
  },
  {
    label: "1.2k events",
    column: 11,
    row: 1,
    columns: 3,
    rows: 3,
  },
  {
    label: "86 sessions",
    column: 6,
    row: 4,
    columns: 3,
    rows: 5,
  },
  {
    label: "24 jobs",
    column: 9,
    row: 4,
    columns: 5,
    rows: 3,
  },
  {
    label: "312 reads",
    column: 9,
    row: 7,
    columns: 3,
    rows: 2,
  },
  {
    label: "0 errors",
    column: 12,
    row: 7,
    columns: 2,
    rows: 2,
  },
] as const;

function FloatingTooltipPreview() {
  const [active, setActive] = useState<{
    anchor: VirtualAnchor;
    label: string;
  } | null>(null);

  const selectBlock = (element: HTMLElement, label: string) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    setActive({
      label,
      anchor: {
        left: (viewport?.pageLeft ?? window.scrollX) + rect.left,
        top: (viewport?.pageTop ?? window.scrollY) + rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  return (
    <div
      className="mx-auto grid aspect-[13/8] w-full max-w-lg grid-cols-13 grid-rows-8 gap-1.5"
      onPointerLeave={() => setActive(null)}
    >
      {tooltipData.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.label}
          className="min-h-0 min-w-0 rounded-sm bg-muted-foreground/20 focus-visible:outline-none"
          style={{
            gridColumn: `${item.column} / span ${item.columns}`,
            gridRow: `${item.row} / span ${item.rows}`,
          }}
          onFocus={(event) => selectBlock(event.currentTarget, item.label)}
          onBlur={() => setActive(null)}
          onPointerEnter={(event) =>
            selectBlock(event.currentTarget, item.label)
          }
        />
      ))}
      <VirtualTooltip
        anchor={active?.anchor ?? null}
        highlightColor="color-mix(in oklab, var(--foreground) 40%, transparent)"
        highlightRadius={4}
        highlightThickness={2}
        showAnchor
      >
        {active?.label}
      </VirtualTooltip>
    </div>
  );
}

function GitHubPreview() {
  return (
    <div className="flex min-h-40 w-full min-w-0 items-center">
      <GitHubContributions />
    </div>
  );
}

function ThemeHotkeyPreview() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const Icon = dark ? Sun : Moon;
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Tooltip content="Toggle theme">
        <button
          type="button"
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="inline-flex h-9 items-center justify-center gap-2 border border-border px-2.5 hover:bg-surface-hover"
          aria-label="Toggle theme"
        >
          <Icon className="size-4" />
          <Kbd>D</Kbd>
        </button>
      </Tooltip>
    </div>
  );
}

function DitherPreview() {
  return (
    <div className="relative min-h-40 overflow-hidden bg-background">
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] bg-size-[5px_5px] text-foreground [mask-image:linear-gradient(to_top,black,transparent)]" />
    </div>
  );
}

const previewRegistry = {
  "floating-tooltip": FloatingTooltipPreview,
  "activity-grid": GitHubPreview,
  "contribution-graph": GitHubPreview,
  "dither-footer": DitherPreview,
  "theme-hotkey": ThemeHotkeyPreview,
  kbd: Keyboard60Preview,
} satisfies Record<ComponentSlug, ComponentType>;

export function ComponentPreview({ slug }: { slug: ComponentSlug }) {
  const Preview = previewRegistry[slug];
  return <Preview />;
}
