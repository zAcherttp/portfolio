// Placing the factory the way it is built in the game: the platform, the
// miner, the smelters and the splitter and merger that serve them, the
// constructors and theirs, the belts, the uploader and its belt, and last the
// power. Machines materialize from the ground up behind a glowing seam, as
// the game's build effect does; belts and wires are laid along their length,
// as they are dragged out. Pure timing; the scene turns seams into uniforms.

/** How the factory appears. */
export type RevealMode =
  /** Already built. */
  | "built"
  /** Placed in build order once it is armed. */
  | "place";

import { BUILDINGS, type FactoryLayout, powerOf } from "./layout";

/** A Mk1 pole's height to its wires, metres. */
const POLE_HEIGHT = 7;

/** A seam below everything: nothing built. */
export const HIDDEN = -1e6;
/** A seam above everything: all of it built. */
export const DONE = 1e6;

/** The build steps, in the order they are placed. */
export const PHASES = [
  "platform",
  "miner",
  "smelters",
  "smelterLogistics",
  "constructors",
  "constructorLogistics",
  "belts",
  "depot",
  "depotBelt",
  "power",
] as const;
export type Phase = (typeof PHASES)[number];

/** What the scene knows of each piece, for timing it. */
export interface RevealPlan {
  /** Where each building stands, how tall it is, and its step. */
  buildings: { base: number; top: number; phase: Phase }[];
  /** Each belt's length (metres) and its step. */
  belts: { length: number; phase: Phase }[];
  /** The pole's foot and the height of its wires. */
  pole: { base: number; top: number };
  /** Each wire's length, in the order they are run. */
  wires: number[];
}

/**
 * Seams at one moment: heights (world metres) for what rises, distances along
 * (metres) for what is laid.
 */
export interface Seams {
  platform: number;
  buildings: number[];
  belts: number[];
  pole: number;
  wires: number[];
  items: number;
  /** Nothing is moving any more. */
  done: boolean;
}

/** Glow band carried past each end, so the seam clears it fully. */
const BAND = 0.6;
/** Rising pieces take this long; tall ones longer. */
const RISE_TIME = 0.9;
const RISE_PER_METRE = 0.03;
/** Laying: metres a second, and the least time a short run takes. */
const LAY_SPEED = 28;
/**
 * The uploader's belt is one long run across the platform: at the short
 * belts' pace it drags on, so it is laid faster.
 */
const LONG_LAY_SPEED = 70;
const LAY_LEAST = 0.3;
/** Pieces of one step follow each other by this much. */
const STAGGER: Record<Phase, number> = {
  platform: 0,
  miner: 0,
  smelters: 0.12,
  smelterLogistics: 0.08,
  constructors: 0.08,
  constructorLogistics: 0.025,
  belts: 0.015,
  depot: 0,
  depotBelt: 0,
  power: 0.05,
};
/** The next step starts once the last is this far along: steps overlap. */
const OVERLAP = 0.1;
/** At least this long after a step's last piece starts, the next begins. */
const STEP_GAP = 0.06;
const PLATFORM_TIME = 0.7;
/**
 * Before it builds, the platform glitches in like a hologram finding its
 * signal: on and off in uneven zaps, seconds from the start, each pair an
 * [on, off] instant. Shown, it is only faintly tinted by the seam's glow.
 */
const GLITCH: readonly (readonly [number, number])[] = [
  [0.0, 0.035],
  [0.08, 0.11],
  [0.17, 0.21],
];
const GLITCH_TIME = 0.26;

interface Slot {
  start: number;
  time: number;
}

/**
 * Each piece's step in the build, as it is done in the game: a splitter or
 * merger serves the smelters when a belt joins it to one, else the
 * constructors; the belt into the uploader goes in after the uploader.
 */
export function revealPlanOf(
  layout: FactoryLayout,
  wires: number[],
): RevealPlan {
  const { buildings, belts } = layout;
  const touchesSmelter = (i: number) =>
    belts.some(
      (b) =>
        (b.from === i && buildings[b.to]?.kind === "smelter") ||
        (b.to === i && buildings[b.from]?.kind === "smelter"),
    );
  const phaseOf = (i: number): Phase => {
    switch (buildings[i].kind) {
      case "miner":
        return "miner";
      case "smelter":
        return "smelters";
      case "constructor":
        return "constructors";
      case "depot":
        return "depot";
      default:
        return touchesSmelter(i) ? "smelterLogistics" : "constructorLogistics";
    }
  };
  const pole = powerOf(layout).poles[0];
  return {
    buildings: buildings.map((b, i) => ({
      base: b.position[1],
      top: b.position[1] + BUILDINGS[b.kind].height,
      phase: phaseOf(i),
    })),
    belts: belts.map((b) => ({
      length: b.points.reduce(
        (sum, p, k) =>
          k === 0
            ? 0
            : sum + Math.hypot(...p.map((v, d) => v - b.points[k - 1][d])),
        0,
      ),
      phase: buildings[b.to]?.kind === "depot" ? "depotBelt" : "belts",
    })),
    pole: {
      base: pole?.[1] ?? 0,
      top: (pole?.[1] ?? 0) + POLE_HEIGHT,
    },
    wires,
  };
}

/** When each piece is placed, seconds from the start. */
export interface Schedule {
  /** The platform's glitch, then its build. */
  glitch: Slot;
  platform: Slot;
  buildings: Slot[];
  belts: Slot[];
  pole: Slot;
  wires: Slot[];
  end: number;
}

export function scheduleOf(plan: RevealPlan): Schedule {
  const buildings: Slot[] = plan.buildings.map(() => ({ start: 0, time: 0 }));
  const belts: Slot[] = plan.belts.map(() => ({ start: 0, time: 0 }));
  const glitch = { start: 0, time: GLITCH_TIME };
  const platform = { start: GLITCH_TIME, time: PLATFORM_TIME };
  let pole: Slot = { start: 0, time: 0 };
  const wires: Slot[] = plan.wires.map(() => ({ start: 0, time: 0 }));
  // Each step begins once the one before is mostly placed.
  let cursor = platform.start + platform.time * OVERLAP;
  let end = platform.start + platform.time;
  const place = (slots: Slot[], times: number[], phase: Phase) => {
    if (slots.length === 0) return;
    let last = cursor;
    let begun = cursor;
    slots.forEach((slot, k) => {
      slot.start = cursor + k * STAGGER[phase];
      slot.time = times[k];
      last = Math.max(last, slot.start + slot.time);
      begun = slot.start;
    });
    end = Math.max(end, last);
    // The next step starts early, but never before this one's last piece.
    cursor = Math.max(cursor + (last - cursor) * OVERLAP, begun + STEP_GAP);
  };
  for (const phase of PHASES) {
    if (phase === "platform") continue;
    if (phase === "power") {
      pole = { start: cursor, time: RISE_TIME };
      end = Math.max(end, pole.start + pole.time);
      cursor += pole.time * OVERLAP;
      place(
        wires,
        plan.wires.map((length) => Math.max(LAY_LEAST, length / LAY_SPEED)),
        phase,
      );
      continue;
    }
    const rising = plan.buildings
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.phase === phase);
    place(
      rising.map(({ i }) => buildings[i]),
      rising.map(({ b }) => RISE_TIME + (b.top - b.base) * RISE_PER_METRE),
      phase,
    );
    const laid = plan.belts
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.phase === phase);
    place(
      laid.map(({ i }) => belts[i]),
      laid.map(({ b }) =>
        Math.max(
          LAY_LEAST,
          b.length / (phase === "depotBelt" ? LONG_LAY_SPEED : LAY_SPEED),
        ),
      ),
      phase,
    );
  }
  return { glitch, platform, buildings, belts, pole, wires, end };
}

/** A CSS cubic-bezier as a function of progress, solved for x by Newton steps. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= (at(x1, x2, t) - x) / d;
      t = Math.min(1, Math.max(0, t));
    }
    return at(y1, y2, t);
  };
}

/** The site's motion tokens: --motion-ease-out and --motion-ease-in-out. */
export const easeOut = bezier(0.23, 1, 0.32, 1);
const easeInOut = bezier(0.77, 0, 0.175, 1);
/** Belts are laid at an even pace, as they are dragged out. */
export const linear = (t: number) => t;

/** From `from` to `to` over a slot, eased; hidden before, done after. */
function sweep(
  elapsed: number,
  slot: Slot,
  from: number,
  to: number,
  ease = easeOut,
) {
  if (elapsed < slot.start) return HIDDEN;
  if (elapsed >= slot.start + slot.time) return DONE;
  return from + (to - from) * ease((elapsed - slot.start) / slot.time);
}

/**
 * How far over the platform's top the seam sits while it glitches on: far
 * enough that its glow band only just tints the deck, not lights it.
 */
const GLITCH_GLOW = 0.45;

/** Whether the glitching platform shows at this moment. */
function glitching(elapsed: number, slot: Slot) {
  if (elapsed < slot.start || elapsed >= slot.start + slot.time) return false;
  const t = elapsed - slot.start;
  return GLITCH.some(([on, off]) => t >= on && t < off);
}

/**
 * The seams `elapsed` seconds into the build, or before it starts when
 * `elapsed` is null.
 */
export function seamsAt(
  mode: RevealMode,
  elapsed: number | null,
  plan: RevealPlan,
  schedule: Schedule,
): Seams {
  const all = (seam: number, done: boolean): Seams => ({
    platform: seam,
    buildings: plan.buildings.map(() => seam),
    belts: plan.belts.map(() => seam),
    pole: seam,
    wires: plan.wires.map(() => seam),
    items: seam,
    done,
  });
  if (mode === "built") return all(DONE, true);
  if (elapsed === null) return all(HIDDEN, false);
  const ground = Math.min(...plan.buildings.map((b) => b.base), plan.pole.base);
  const done = elapsed >= schedule.end;
  return {
    platform: glitching(elapsed, schedule.glitch)
      ? ground + GLITCH_GLOW
      : sweep(elapsed, schedule.platform, ground - 1.5, ground + 0.5),
    buildings: plan.buildings.map((b, i) =>
      sweep(elapsed, schedule.buildings[i], b.base - 0.2, b.top + BAND),
    ),
    belts: plan.belts.map((b, i) =>
      sweep(elapsed, schedule.belts[i], 0, b.length + BAND, linear),
    ),
    pole: sweep(
      elapsed,
      schedule.pole,
      plan.pole.base - 0.2,
      plan.pole.top + BAND,
    ),
    wires: plan.wires.map((length, i) =>
      sweep(elapsed, schedule.wires[i], 0, length + BAND, easeInOut),
    ),
    items: done ? DONE : HIDDEN,
    done,
  };
}

/** How much of a building stands, 0–1, for holding its light while placed. */
export function builtShare(seam: number, base: number, top: number) {
  return Math.min(1, Math.max(0, (seam - base) / Math.max(top - base, 0.01)));
}

/**
 * Most seconds of the build one frame moves on: a frame held up (shaders
 * compiling, a busy page) slows the build instead of skipping some of it.
 */
export const REVEAL_STEP = 1 / 30;

/**
 * The build's clock after a frame of `delta` seconds: unstarted (null)
 * until armed, 0 on the first frame after, then frame by frame.
 */
export function revealClock(
  time: number | null,
  armed: boolean,
  delta: number,
): number | null {
  if (!armed) return time;
  return time === null ? 0 : time + Math.min(delta, REVEAL_STEP);
}
