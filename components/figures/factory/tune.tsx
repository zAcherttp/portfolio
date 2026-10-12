"use client";

import type { FactoryLook } from "./look";

interface Control {
  key: keyof FactoryLook;
  label: string;
  min: number;
  max: number;
  step: number;
}

/** Settled groups of controls; they start collapsed. */
const GROUPS: readonly { name: string; controls: readonly Control[] }[] = [
  {
    name: "Ink",
    controls: [
      { key: "supersample", label: "Supersample", min: 1, max: 3, step: 1 },
      { key: "lineWidth", label: "Line width", min: 1, max: 3, step: 0.25 },
      { key: "crease", label: "Creases", min: 0, max: 1, step: 0.05 },
      { key: "detail", label: "Detail outlines", min: 0, max: 1, step: 0.05 },
      {
        key: "fadeScale",
        label: "Full detail at px/m",
        min: 5,
        max: 150,
        step: 5,
      },
    ],
  },
  {
    name: "Ports",
    controls: [
      { key: "portDark", label: "Dark depth", min: 0, max: 1, step: 0.05 },
      {
        key: "portEdge",
        label: "Edge softness",
        min: 0.05,
        max: 1,
        step: 0.05,
      },
      {
        key: "portSoft",
        label: "Side feather m",
        min: 0,
        max: 0.5,
        step: 0.02,
      },
      {
        key: "portRadius",
        label: "Corner radius m",
        min: 0,
        max: 0.6,
        step: 0.02,
      },
      { key: "portTone", label: "Tone", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    name: "Halftone",
    controls: [
      { key: "halftoneCell", label: "Spacing px", min: 2, max: 24, step: 1 },
      {
        key: "halftoneCover",
        label: "Coverage",
        min: 0.05,
        max: 0.78,
        step: 0.01,
      },
    ],
  },
];

const SPEEDS = [0.5, 1, 2, 4, 8] as const;

/** Live controls for the ink, for settling defaults by eye on /dev/factory. */
export function TunePanel({
  look,
  onChange,
  speed,
  onSpeed,
  wireframe,
  onWireframe,
}: {
  look: FactoryLook;
  onChange: (look: FactoryLook) => void;
  /** Line time per real second. */
  speed: number;
  onSpeed: (speed: number) => void;
  wireframe: boolean;
  onWireframe: (wireframe: boolean) => void;
}) {
  return (
    <fieldset className="fixed top-14 right-4 z-20 max-h-[calc(100dvh-5rem)] w-64 min-w-0 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/90 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
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
      {GROUPS.map((group) => (
        <details key={group.name} className="group border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-foreground">
            {group.name}
          </summary>
          <div className="mt-2 space-y-2">
            {group.controls.map((c) => (
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
                    onChange({
                      ...look,
                      [c.key]: Number(e.currentTarget.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </details>
      ))}
      <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px] leading-4 text-foreground">
        {JSON.stringify(look, null, 1)}
      </pre>
      <label className="flex items-center gap-2 border-t border-border pt-2">
        <input
          type="checkbox"
          className="accent-foreground"
          checked={wireframe}
          onChange={(e) => onWireframe(e.currentTarget.checked)}
        />
        <span>Wireframe</span>
      </label>
    </fieldset>
  );
}
