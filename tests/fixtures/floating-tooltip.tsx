"use client";

import { useState } from "react";
import {
  Tooltip,
  type VirtualAnchor,
  VirtualTooltip,
} from "@/components/registry/floating-tooltip";

const buttonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs text-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export function TooltipDefaultFixture() {
  return (
    <Tooltip content="Default tooltip" highlight>
      <button className={buttonClassName} type="button">
        Hover or focus
      </button>
    </Tooltip>
  );
}

const placements = [
  "top-left",
  "top",
  "top-right",
  "left",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export function TooltipPlacementsFixture() {
  return (
    <div className="grid w-full max-w-lg grid-cols-3 gap-5">
      {placements.map((placement, index) => (
        <div
          className={
            index === 3
              ? "col-start-1"
              : index === 4
                ? "col-start-3"
                : undefined
          }
          key={placement}
        >
          <Tooltip content={placement} placement={placement}>
            <button className={`${buttonClassName} w-full`} type="button">
              {placement}
            </button>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

export function TooltipCollisionFixture() {
  return (
    <div className="grid min-h-72 w-full grid-cols-2 content-between justify-between gap-y-40">
      <Tooltip content="Requested top-left" placement="top-left" highlight>
        <button
          className={`${buttonClassName} justify-self-start`}
          type="button"
        >
          Top left edge
        </button>
      </Tooltip>
      <Tooltip content="Requested top-right" placement="top-right" highlight>
        <button className={`${buttonClassName} justify-self-end`} type="button">
          Top right edge
        </button>
      </Tooltip>
      <Tooltip
        content="Requested bottom-left"
        placement="bottom-left"
        highlight
      >
        <button
          className={`${buttonClassName} justify-self-start`}
          type="button"
        >
          Bottom left edge
        </button>
      </Tooltip>
      <Tooltip
        content="Requested bottom-right"
        placement="bottom-right"
        highlight
      >
        <button className={`${buttonClassName} justify-self-end`} type="button">
          Bottom right edge
        </button>
      </Tooltip>
    </div>
  );
}

const virtualTargets = [
  { label: "Large target", columns: 5, rows: 4 },
  { label: "Wide target", columns: 4, rows: 2 },
  { label: "Tall target", columns: 2, rows: 4 },
  { label: "Small target", columns: 2, rows: 2 },
] as const;

export function TooltipVirtualTargetsFixture() {
  const [active, setActive] = useState<{
    anchor: VirtualAnchor;
    label: string;
  } | null>(null);

  const activate = (element: HTMLElement, label: string) => {
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
      className="grid aspect-[13/8] w-full max-w-lg grid-cols-7 grid-rows-6 gap-1.5"
      onPointerLeave={() => setActive(null)}
    >
      {virtualTargets.map((target) => (
        <button
          aria-label={target.label}
          className="min-h-0 min-w-0 rounded-sm bg-muted-foreground/20 focus-visible:outline-none"
          key={target.label}
          onBlur={() => setActive(null)}
          onFocus={(event) => activate(event.currentTarget, target.label)}
          onPointerEnter={(event) =>
            activate(event.currentTarget, target.label)
          }
          style={{
            gridColumn: `span ${target.columns}`,
            gridRow: `span ${target.rows}`,
          }}
          type="button"
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

export function TooltipContentResizeFixture() {
  const [expanded, setExpanded] = useState(false);
  return (
    <Tooltip
      content={
        expanded
          ? "A longer tooltip that exercises interruptible content resizing"
          : "Short content"
      }
      highlight
    >
      <button
        className={buttonClassName}
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        Toggle content size
      </button>
    </Tooltip>
  );
}

export function TooltipScrollFixture() {
  return (
    <div className="h-72 w-full max-w-lg overflow-y-auto border-y border-border">
      <div className="flex h-[42rem] items-center justify-center">
        <Tooltip content="Scroll invalidates this anchor" highlight>
          <button className={buttonClassName} type="button">
            Hover, then scroll
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export function TooltipControlledFixture() {
  const [open, setOpen] = useState(false);
  const [stable, setStable] = useState(true);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Tooltip
        content={stable ? "Controlled and stable" : "Paused"}
        highlight
        isStable={stable}
        onOpenChange={setOpen}
        open={open}
      >
        <button className={buttonClassName} type="button">
          Controlled trigger
        </button>
      </Tooltip>
      <button
        className={buttonClassName}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? "Close" : "Open"}
      </button>
      <button
        className={buttonClassName}
        onClick={() => setStable((value) => !value)}
        type="button"
      >
        {stable ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
