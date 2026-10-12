"use client";

import type { FactoryLook } from "./look";

interface Control {
  key: keyof FactoryLook;
  label: string;
  min: number;
  max: number;
  step: number;
}

const CONTROLS: readonly Control[] = [
  { key: "supersample", label: "Supersample", min: 1, max: 3, step: 1 },
  { key: "lineWidth", label: "Line width", min: 1, max: 3, step: 0.25 },
  { key: "crease", label: "Creases", min: 0, max: 1, step: 0.05 },
  { key: "detail", label: "Detail outlines", min: 0, max: 1, step: 0.05 },
  { key: "fadeScale", label: "Full detail at px/m", min: 5, max: 150, step: 5 },
];

const SPEEDS = [0.5, 1, 2, 4, 8] as const;

/** Live controls for the ink, for settling defaults by eye on /dev/factory. */
export function TunePanel({
  look,
  onChange,
  speed,
  onSpeed,
}: {
  look: FactoryLook;
  onChange: (look: FactoryLook) => void;
  /** Line time per real second. */
  speed: number;
  onSpeed: (speed: number) => void;
}) {
  return (
    <fieldset className="fixed top-14 right-4 z-20 w-64 space-y-2 rounded-lg border border-border bg-background/90 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
      <legend className="sr-only">Ink settings</legend>
      <fieldset>
        <legend className="mb-1">Line speed</legend>
        <div className="grid grid-cols-5 gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => onSpeed(s)}
              className="rounded border border-border py-0.5 tabular-nums aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {s}×
            </button>
          ))}
        </div>
      </fieldset>
      {CONTROLS.map((c) => (
        <label
          key={c.key}
          className="grid grid-cols-[1fr_auto] items-center gap-x-2"
        >
          <span>{c.label}</span>
          <output className="tabular-nums text-foreground">
            {look[c.key]}
          </output>
          <input
            className="col-span-2 w-full accent-foreground"
            type="range"
            min={c.min}
            max={c.max}
            step={c.step}
            value={look[c.key]}
            onChange={(e) =>
              onChange({ ...look, [c.key]: Number(e.currentTarget.value) })
            }
          />
        </label>
      ))}
      <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px] leading-4 text-foreground">
        {JSON.stringify(look, null, 1)}
      </pre>
    </fieldset>
  );
}
