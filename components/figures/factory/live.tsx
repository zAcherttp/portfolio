"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FOOTER_IGNITE_EVENT } from "@/lib/footer-ignite";
import { cn } from "@/lib/utils";
import { layoutFactory, lineSpec } from "./layout";
import { DEFAULT_LOOK, type FactoryLook } from "./look";
import type { Palette } from "./shaders";
import {
  createLine,
  deliveredRate,
  type Line,
  type NodeStatus,
  stepLine,
} from "./sim";
import { TunePanel } from "./tune";
import { frameBox } from "./view";

const FactoryScene = dynamic(() => import("./scene"), { ssr: false });

const LAYOUT = layoutFactory();
const FRAME = frameBox(LAYOUT.min, LAYOUT.max);
const UPLOADER = LAYOUT.buildings.findIndex((b) => b.kind === "depot");
/** Reduced motion shows the line after it has settled. */
const SETTLED_SECONDS = 300;

const STATUS_LABEL: Record<NodeStatus, string> = {
  off: "off",
  working: "working",
  starved: "waiting for input",
  blocked: "output full",
};

/** Readout groups in line order, with the nodes in each. */
const GROUPS = (() => {
  const groups: { label: string; nodes: number[] }[] = [];
  LAYOUT.buildings.forEach((b, i) => {
    if (!b.group) return;
    const group = groups.find((g) => g.label === b.group);
    if (group) group.nodes.push(i);
    else groups.push({ label: b.group, nodes: [i] });
  });
  return groups;
})();

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const token = (name: string) =>
    css.getPropertyValue(`--anatomy-${name}`).trim();
  return {
    top: token("top"),
    shades: [
      token("shade-0"),
      token("shade-1"),
      token("shade-2"),
      token("shade-3"),
    ],
    litTop: token("lit-top"),
    litShade: token("lit-shade"),
    hi: token("hi"),
    mid: token("mid"),
    lo: token("lo"),
    lit: token("lit"),
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

interface Snapshot {
  rate: number;
  statuses: NodeStatus[];
}

/** Uploads take a quarter second, so count the uploader busy for a moment after each. */
const UPLOAD_LINGER = 3;

const snapshotOf = (line: Line): Snapshot => {
  const last = line.arrivals.at(-1);
  const uploading =
    line.powered && last !== undefined && line.time - last < UPLOAD_LINGER;
  return {
    rate: deliveredRate(line),
    statuses: line.nodes.map((n, i) =>
      i === UPLOADER && uploading ? "working" : n.status,
    ),
  };
};

export interface FactoryLiveProps {
  /** Fill the viewport and allow zoom and pan, instead of sitting in the page. */
  full?: boolean;
  /** Show live ink controls. */
  tune?: boolean;
}

export function FactoryLive({ full = false, tune = false }: FactoryLiveProps) {
  const [look, setLook] = useState<FactoryLook>(DEFAULT_LOOK);
  const rootRef = useRef<HTMLDivElement>(null);
  const line = useMemo(() => {
    const { nodes, belts } = lineSpec(LAYOUT);
    return createLine(nodes, belts);
  }, []);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [powered, setPowered] = useState(false);
  const [version, setVersion] = useState(0);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotOf(line));
  const reduced = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();
  const running = powered && visible && !reduced;

  // Load the scene shortly before it scrolls in; pause it while offscreen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Theme tokens live in CSS; read them again whenever the theme changes.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    void resolvedTheme;
    setPalette(readPalette(el));
  }, [resolvedTheme]);

  // The footer flame doubles as the power switch.
  useEffect(() => {
    const ignite = () => setPowered(true);
    window.addEventListener(FOOTER_IGNITE_EVENT, ignite);
    return () => window.removeEventListener(FOOTER_IGNITE_EVENT, ignite);
  }, []);

  useEffect(() => {
    line.powered = powered;
    if (powered && reduced && line.uptime < SETTLED_SECONDS) {
      stepLine(line, SETTLED_SECONDS);
    }
    setSnapshot(snapshotOf(line));
    setVersion((v) => v + 1);
  }, [line, powered, reduced]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSnapshot(snapshotOf(line)), 250);
    return () => window.clearInterval(id);
  }, [line, running]);

  return (
    <div ref={rootRef} className="factory">
      <div
        className={cn(
          "relative",
          full
            ? "h-[calc(100dvh-5rem)] w-full"
            : "left-1/2 w-[min(calc(100vw-2rem),82rem)] -translate-x-1/2 sm:w-[min(calc(100vw-14rem),82rem)]",
        )}
        style={
          full ? undefined : { aspectRatio: `${FRAME.width} / ${FRAME.height}` }
        }
      >
        {near && palette ? (
          <FactoryScene
            line={line}
            layout={LAYOUT}
            palette={palette}
            running={running}
            version={version}
            explore={full}
            look={look}
          />
        ) : null}
      </div>
      {tune ? <TunePanel look={look} onChange={setLook} /> : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-x-4 gap-y-1">
          {GROUPS.map((group) => (
            <li key={group.label} className="flex items-center gap-1.5">
              <span className="flex gap-0.5" aria-hidden>
                {group.nodes.map((n) => {
                  const status = snapshot.statuses[n] ?? "off";
                  return (
                    <span
                      key={n}
                      className={cn(
                        "size-1.5 rounded-full bg-[var(--anatomy-lo)]",
                        status === "working" && "bg-[var(--anatomy-green)]",
                        status === "blocked" && "bg-[var(--anatomy-red)]",
                      )}
                    />
                  );
                })}
              </span>
              <span className="text-foreground">{group.label}</span>
              <span className="sr-only">
                :{" "}
                {group.nodes
                  .map((n) => STATUS_LABEL[snapshot.statuses[n] ?? "off"])
                  .join(", ")}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-3">
          <output className="tabular-nums text-foreground">
            {snapshot.rate.toFixed(0)} screws/min
          </output>
          <Button
            variant="outline"
            size="xs"
            aria-pressed={powered}
            onClick={() => setPowered((p) => !p)}
          >
            {powered ? "Power off" : "Power on"}
          </Button>
        </div>
      </div>
    </div>
  );
}
