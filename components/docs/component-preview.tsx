"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { DitherFooter } from "@/components/DitherFooter";
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

type PreviewFrameMode = "canvas" | "compact" | "wide";

function PreviewFrame({
  children,
  mode,
}: {
  children: ReactNode;
  mode: PreviewFrameMode;
}) {
  const layoutClassName =
    mode === "compact"
      ? "w-fit p-6"
      : mode === "canvas"
        ? "w-full overflow-hidden"
        : "w-full px-4 py-6 sm:px-6";

  return (
    <div
      className={`rounded-2xl bg-background ${layoutClassName}`}
      data-preview-frame={mode}
    >
      {children}
    </div>
  );
}

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
    <PreviewFrame mode="wide">
      <div className="flex min-h-40 w-full min-w-0 items-center">
        <GitHubContributions />
      </div>
    </PreviewFrame>
  );
}

function ThemeHotkeyPreview() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const dark = mounted && resolvedTheme === "dark";
  const Icon = dark ? Sun : Moon;

  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-40 items-center justify-center">
      <PreviewFrame mode="compact">
        <Tooltip content="Toggle theme">
          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="docs-pressable -m-6 inline-flex items-center justify-center gap-2 rounded-2xl p-6 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle theme"
          >
            <Icon className="size-4" />
            <Kbd>D</Kbd>
          </button>
        </Tooltip>
      </PreviewFrame>
    </div>
  );
}

function DitherPreview() {
  return (
    <PreviewFrame mode="canvas">
      <DitherFooter className="h-44 w-full" testId="dither-showcase" />
    </PreviewFrame>
  );
}

function KbdPreview() {
  return (
    <PreviewFrame mode="wide">
      <Keyboard60Preview />
    </PreviewFrame>
  );
}

const previewRegistry = {
  "floating-tooltip": FloatingTooltipPreview,
  "activity-grid": GitHubPreview,
  "contribution-graph": GitHubPreview,
  "dither-footer": DitherPreview,
  "theme-hotkey": ThemeHotkeyPreview,
  kbd: KbdPreview,
} satisfies Record<ComponentSlug, ComponentType>;

export function ComponentPreview({ slug }: { slug: ComponentSlug }) {
  const Preview = previewRegistry[slug];
  return <Preview />;
}
