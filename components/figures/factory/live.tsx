"use client";

import { Maximize2, Minimize2, Power } from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  Component,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { contentPoints, layoutFactory, lineSpec } from "./layout";
import { DEFAULT_LOOK, type FactoryLook } from "./look";
import { usePrefersReducedMotion } from "./reduced-motion";
import type { RevealMode } from "./reveal";
import type { DeckState, DrawnFrame } from "./scene";
import type { Palette } from "./shaders";
import {
  createLine,
  deliveredRate,
  type Line,
  type NodeStatus,
  stepLine,
} from "./sim";
import { TunePanel } from "./tune";
import { framePoints } from "./view";

const FactoryScene = dynamic(() => import("./scene"), { ssr: false });

const LAYOUT = layoutFactory();
const FRAME = framePoints(contentPoints(LAYOUT));
const UPLOADER = LAYOUT.buildings.findIndex((b) => b.kind === "depot");
/** Reduced motion shows the line after it has settled. */
const SETTLED_SECONDS = 900;

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
    deep: token("deep"),
    glow: token("glow"),
    forge: token("forge"),
    smoke: token("smoke"),
    power: token("power"),
    forgeCore: token("forge-core"),
    sparkHot: token("spark-hot"),
    sparkCool: token("spark-cool"),
    build: token("build"),
  };
}

/** Keeps a failing drawing from taking the page down with it. */
class DrawingBoundary extends Component<
  { onError: (reason: string) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : "render");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
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

/** The deck, sitting in its slot. */
const CLOSED_DECK: Omit<DeckState, "element"> = {
  open: false,
  slot: null,
  hold: false,
  factor: null,
};

export interface FactoryLiveProps {
  /** Fill the viewport and allow zoom and pan, instead of sitting in the page. */
  full?: boolean;
  /** Show live ink controls. */
  tune?: boolean;
  /**
   * How the factory appears: built in the game's order once it is well in
   * view, or already standing. Reduced motion shows it standing.
   */
  reveal?: RevealMode;
}

export function FactoryLive({
  full = false,
  tune = false,
  reveal = "built",
}: FactoryLiveProps) {
  const [look, setLook] = useState<FactoryLook>(DEFAULT_LOOK);
  const [speed, setSpeed] = useState(1);
  const [wireframe, setWireframe] = useState(false);
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
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  /** Bumped to remount the drawing after the GPU gives it back. */
  const [attempt, setAttempt] = useState(0);
  const fail = useCallback(() => setFailed(true), []);
  const context = useCallback((state: "lost" | "restored") => {
    setPaused(state === "lost");
    if (state === "restored") setAttempt((a) => a + 1);
  }, []);
  useEffect(() => {
    if (!supportsWebGL2()) setFailed(true);
  }, []);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotOf(line));
  const reduced = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();
  const running = powered && visible && !reduced;
  // The build starts once the drawing is well in view, and only once.
  const frameRef = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || reveal !== "place") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reveal]);
  // The deck the factory sits on: the enlarge button (or a double-click)
  // grows it out of its slot to fill the screen.
  const deckRef = useRef<HTMLDivElement>(null);
  const [deck, setDeck] = useState<Omit<DeckState, "element">>(CLOSED_DECK);
  const [closeDeck, setCloseDeck] = useState(0);
  const openRef = useRef(false);
  openRef.current = deck.open;
  // The hand-off between slot and deck: the canvas changes size, and for a
  // frame the browser would stretch its old picture. So the picture is
  // copied into `still` first and shown in its place while the canvas,
  // hidden, redraws at its new size; then the canvas comes back.
  const still = useRef<HTMLCanvasElement>(null);
  const [stillShown, setStillShown] = useState(false);
  const [canvasHidden, setCanvasHidden] = useState(false);
  /** The open deck has started to close: its layer fades out. */
  const [deckLeaving, setDeckLeaving] = useState(false);
  const leaving = useRef(false);
  const handoff = useRef<"opening" | "shown" | "closing" | null>(null);
  const slotFactor = useRef(1);
  const slotBuffer = useRef({ width: 0, height: 0 });
  const copy = useCallback(
    (
      from: HTMLCanvasElement,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
    ) => {
      const to = still.current;
      const ctx = to?.getContext("2d");
      if (!to || !ctx) return;
      to.width = Math.round(sw);
      to.height = Math.round(sh);
      ctx.drawImage(from, sx, sy, sw, sh, 0, 0, to.width, to.height);
      setStillShown(true);
    },
    [],
  );
  const drawn = useCallback(
    (frame: DrawnFrame) => {
      const { canvas, width, height, deck: at } = frame;
      if (at === "slot" && handoff.current !== "closing") {
        slotFactor.current = frame.factor;
        slotBuffer.current = { width, height };
      }
      if (handoff.current === "opening" && at === "slot") {
        // The slot's last frame stands in while the deck opens, hidden.
        copy(canvas, 0, 0, width, height);
        const r = frameRef.current?.getBoundingClientRect();
        if (!r) return;
        handoff.current = "shown";
        setCanvasHidden(true);
        setDeck({
          open: true,
          slot: { left: r.left, top: r.top, width: r.width, height: r.height },
          hold: true,
          factor: slotFactor.current,
        });
      } else if (handoff.current === "shown" && at === "opening") {
        // The deck has drawn the slot's view: show it, then let it grow.
        handoff.current = null;
        setCanvasHidden(false);
        setStillShown(false);
        setDeck((d) => ({ ...d, hold: false }));
      } else if (at === "closing" && !leaving.current) {
        leaving.current = true;
        setDeckLeaving(true);
      } else if (at === "closed" && handoff.current !== "closing") {
        // Shrunk back over the slot: copy that part of the screen to stand in
        // while the canvas returns to the slot, hidden.
        const slot = deckSlot.current;
        if (!slot) return;
        // The deck spans the viewport without its scrollbar: scale by the
        // canvas's own size, not the window's.
        const sx = width / canvas.clientWidth;
        const sy = height / canvas.clientHeight;
        copy(
          canvas,
          slot.left * sx,
          slot.top * sy,
          slot.width * sx,
          slot.height * sy,
        );
        handoff.current = "closing";
        leaving.current = false;
        setDeckLeaving(false);
        setCanvasHidden(true);
        setDeck(CLOSED_DECK);
      } else if (
        handoff.current === "closing" &&
        at === "slot" &&
        // Only once it has really shrunk back: drawn at the slot's size.
        width === slotBuffer.current.width &&
        height === slotBuffer.current.height
      ) {
        handoff.current = null;
        setCanvasHidden(false);
        setStillShown(false);
      }
    },
    [copy],
  );
  const deckSlot = useRef(deck.slot);
  deckSlot.current = deck.slot;
  const openDeck = useCallback(() => {
    if (openRef.current || handoff.current) return;
    handoff.current = "opening";
    // Draw a fresh frame to copy.
    setVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || full) return;
    const double = () => {
      if (!openRef.current) openDeck();
    };
    el.addEventListener("dblclick", double);
    return () => el.removeEventListener("dblclick", double);
  }, [full, openDeck]);

  // The slot sits wherever the page's text leaves it, often between pixels;
  // a canvas there is resampled by the browser and every line goes soft. So
  // the drawing is nudged onto whole device pixels, at a whole-pixel size.
  const [snap, setSnap] = useState<CSSProperties | undefined>(undefined);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || full) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const whole = (v: number) => Math.round(v * dpr) / dpr;
      const next = {
        left: whole(r.left) - r.left,
        top: whole(r.top) - r.top,
        width: Math.floor(r.width * dpr) / dpr,
        height: Math.floor(r.height * dpr) / dpr,
      };
      setSnap((was) =>
        was &&
        Math.abs(Number(was.left) - next.left) < 1e-3 &&
        Math.abs(Number(was.top) - next.top) < 1e-3 &&
        was.width === next.width &&
        was.height === next.height
          ? was
          : next,
      );
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(queue);
    observer.observe(el);
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [full]);

  const placing = useMemo(
    () => ({
      mode: reduced ? ("built" as const) : reveal,
      armed: reveal === "place" ? seen : true,
    }),
    [reduced, reveal, seen],
  );

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
  // The theme's class lands on <html> after React's state for it has moved
  // on, so read once it has: when <html>'s class or theme attributes change.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    void resolvedTheme;
    const read = () => {
      const next = readPalette(el);
      setPalette((was) =>
        was && JSON.stringify(was) === JSON.stringify(next) ? was : next,
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, [resolvedTheme]);

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
    const id = window.setInterval(() => {
      // Without a drawing, nothing else moves the line forward.
      if (failed) stepLine(line, 0.25 * speed);
      setSnapshot(snapshotOf(line));
    }, 250);
    return () => window.clearInterval(id);
  }, [line, running, failed, speed]);

  // Over the picture, shown on hover or focus (and always where there is no
  // hover): power and enlarge (collapse, on the open deck) at the top right,
  // the line's state below. It moves onto the deck with the picture.
  // The slot keeps its layer while the deck is open, faded out and inert, so
  // it fades back in on return; the deck's fades in once the deck shows and
  // out as soon as it starts to close.
  const controls = (onDeck: boolean) => (
    <div
      inert={!onDeck && deck.open}
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-150 ease-out",
        onDeck ? "p-4 starting:opacity-0" : "p-3",
        (onDeck && deckLeaving) || (!onDeck && deck.open)
          ? "opacity-0"
          : full || failed
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
      )}
    >
      <div className="pointer-events-auto flex gap-1.5 self-end">
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={powered ? "Power off" : "Power on"}
          title={powered ? "Power off" : "Power on"}
          aria-pressed={powered}
          onClick={() => setPowered((p) => !p)}
        >
          <Power aria-hidden />
        </Button>
        {full || failed ? null : onDeck ? (
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Collapse"
            title="Collapse"
            onClick={() => setCloseDeck((n) => n + 1)}
          >
            <Minimize2 aria-hidden />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Enlarge"
            title="Enlarge"
            onClick={openDeck}
          >
            <Maximize2 aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 self-stretch rounded-md bg-background/80 px-2 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm">
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
        <output className="tabular-nums text-foreground">
          {snapshot.rate.toFixed(0)} screws/min
        </output>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="factory">
      <div
        ref={frameRef}
        className={cn("group relative w-full", full && "h-[calc(100dvh-5rem)]")}
        style={
          full ? undefined : { aspectRatio: `${FRAME.width} / ${FRAME.height}` }
        }
      >
        {near && palette && !failed ? (
          <div
            ref={deckRef}
            className={cn(
              deck.open
                ? "fixed inset-0 z-[100] bg-background"
                : "absolute inset-0",
              canvasHidden && "invisible",
            )}
            // Open, it starts clipped to the slot it grows out of; the drawing
            // widens the clip from there as it eases out.
            style={
              !deck.open
                ? snap
                : deck.slot
                  ? {
                      clipPath: `inset(${deck.slot.top}px ${
                        document.documentElement.clientWidth -
                        deck.slot.left -
                        deck.slot.width
                      }px ${
                        document.documentElement.clientHeight -
                        deck.slot.top -
                        deck.slot.height
                      }px ${deck.slot.left}px)`,
                    }
                  : undefined
            }
          >
            <DrawingBoundary key={attempt} onError={fail}>
              <FactoryScene
                line={line}
                layout={LAYOUT}
                palette={palette}
                running={running && !paused}
                version={version}
                explore={full}
                reveal={placing}
                reducedMotion={reduced}
                deck={full ? undefined : { ...deck, element: deckRef.current }}
                closeDeck={closeDeck}
                onDrawn={drawn}
                look={look}
                speed={speed}
                wireframe={wireframe}
                onError={fail}
                onContext={context}
              />
            </DrawingBoundary>
            {deck.open && !canvasHidden ? controls(true) : null}
          </div>
        ) : null}
        {/* The picture, held still while the canvas moves between slot and deck. */}
        <canvas
          ref={still}
          aria-hidden
          style={snap}
          className={cn(
            "pointer-events-none absolute inset-0 size-full",
            !stillShown && "hidden",
          )}
        />
        {failed ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            This browser can&apos;t draw the factory, but the line still runs:
            power it on from its switch.
          </p>
        ) : null}
        {controls(false)}
      </div>
      {tune ? (
        <TunePanel
          look={look}
          onChange={setLook}
          speed={speed}
          onSpeed={setSpeed}
          wireframe={wireframe}
          onWireframe={setWireframe}
        />
      ) : null}
    </div>
  );
}
