// Discrete simulation of a production line as a graph: machines craft at
// their recipe rates, splitters and mergers pass items through one at a time
// in turn, and belts carry spaced items between them. Anything that cannot move
// waits. Pure and deterministic; the drawing only reads the state.

import { CONVEYOR } from "./game";

export type ItemKind = "ore" | "ingot" | "screw";

export interface Stack {
  item: ItemKind;
  count: number;
}

export interface Recipe {
  /** Display name, as in the game. */
  name: string;
  input: Stack | null;
  /** `null` for a sink that consumes items, like the depot uploader. */
  output: Stack | null;
  /** Craft time at 100% clock speed. */
  seconds: number;
}

// From the game's CommunityResources/Docs.
export const RECIPES = {
  /** Miner Mk.1 on a normal node: 60 ore/min. */
  ironOre: {
    name: "Iron Ore",
    input: null,
    output: { item: "ore", count: 1 },
    seconds: 1,
  },
  ironIngot: {
    name: "Iron Ingot",
    input: { item: "ore", count: 1 },
    output: { item: "ingot", count: 1 },
    seconds: 2,
  },
  /** Recipe_Alternate_Screw: 12.5 ingots → 50 screws/min. */
  castScrews: {
    name: "Alternate: Cast Screws",
    input: { item: "ingot", count: 5 },
    output: { item: "screw", count: 20 },
    seconds: 24,
  },
  /** Dimensional Depot uploader with the 240/min upload upgrade. */
  upload: {
    name: "Upload",
    input: { item: "screw", count: 1 },
    output: null,
    seconds: 0.25,
  },
} as const satisfies Record<string, Recipe>;

export type BeltTier = "mk1" | "mk3";

/** The game's belts: items 1.2 m apart; Mk.1 60/min, Mk.3 270/min. */
export const BELTS: Record<BeltTier, { speed: number; spacing: number }> = {
  mk1: { speed: CONVEYOR.speed.mk1, spacing: CONVEYOR.itemSpacing },
  mk3: { speed: CONVEYOR.speed.mk3, spacing: CONVEYOR.itemSpacing },
};

/** Clock speed limits of an overclockable machine. */
export const CLOCK_MIN = 0.01;
export const CLOCK_MAX = 2.5;

export type NodeSpec =
  | {
      kind: "machine";
      recipe: Recipe;
      /** Seconds of power before the first craft, like an extractor's spin-up. */
      startup?: number;
    }
  | { kind: "splitter" }
  | { kind: "merger" };

export interface BeltSpec {
  from: number;
  to: number;
  length: number;
  item: ItemKind;
  tier: BeltTier;
}

export type NodeStatus = "off" | "working" | "starved" | "blocked";

export interface Node {
  kind: NodeSpec["kind"];
  recipe: Recipe | null;
  clock: number;
  /** Items waiting to be crafted. */
  input: number;
  /** Items waiting to leave; a splitter or merger holds at most one. */
  output: number;
  inputCap: number;
  outputCap: number;
  crafting: boolean;
  /** Progress of the current craft, 0 to 1. */
  progress: number;
  /** Powered seconds left before the machine can craft at all. */
  warmup: number;
  status: NodeStatus;
  /** Belts in and out, by index. */
  incoming: number[];
  outgoing: number[];
  /** Round-robin cursors over incoming and outgoing belts. */
  nextIn: number;
  nextOut: number;
}

export interface Belt extends BeltSpec {
  speed: number;
  spacing: number;
  /** Item positions in metres from the belt start, head (largest) first. */
  items: number[];
}

export interface Line {
  nodes: Node[];
  belts: Belt[];
  powered: boolean;
  /** Simulated seconds since the line was created. */
  time: number;
  /** Seconds the line has been powered. */
  uptime: number;
  /** Times a sink consumed an item, within the rate window. */
  arrivals: number[];
}

/** Window for the delivered-rate readout. */
export const RATE_WINDOW = 60;
const MAX_STEP = 0.05;

function createNode(spec: NodeSpec): Node {
  const recipe = spec.kind === "machine" ? spec.recipe : null;
  // Two crafts of input and output keep backups visible within a minute. The
  // game buffers whole stacks, which hides the same stall for much longer.
  const inCount = recipe?.input?.count ?? 0;
  const outCount = recipe?.output?.count ?? 0;
  return {
    kind: spec.kind,
    recipe,
    clock: 1,
    input: 0,
    output: 0,
    inputCap: recipe ? Math.max(2, 2 * inCount) : 0,
    outputCap: recipe ? 2 * outCount : 1,
    crafting: false,
    progress: 0,
    warmup: spec.kind === "machine" ? (spec.startup ?? 0) : 0,
    status: "off",
    incoming: [],
    outgoing: [],
    nextIn: 0,
    nextOut: 0,
  };
}

export function createLine(
  nodeSpecs: readonly NodeSpec[],
  beltSpecs: readonly BeltSpec[],
): Line {
  const nodes = nodeSpecs.map(createNode);
  const belts = beltSpecs.map((spec, i): Belt => {
    const from = nodes[spec.from];
    const to = nodes[spec.to];
    if (!from || !to) throw new Error(`Belt ${i} joins a missing node.`);
    const made = from.recipe?.output?.item;
    if (from.kind === "machine" && made !== spec.item) {
      throw new Error(`Belt ${i}: ${from.recipe?.name} makes no ${spec.item}.`);
    }
    const wanted = to.recipe?.input?.item;
    if (to.kind === "machine" && wanted !== spec.item) {
      throw new Error(
        `Belt ${i}: ${to.recipe?.name} cannot take ${spec.item}.`,
      );
    }
    from.outgoing.push(i);
    to.incoming.push(i);
    return { ...spec, ...BELTS[spec.tier], items: [] };
  });
  return { nodes, belts, powered: false, time: 0, uptime: 0, arrivals: [] };
}

export function setClock(line: Line, node: number, clock: number) {
  const target = line.nodes[node];
  if (target?.kind !== "machine") return;
  target.clock = Math.min(CLOCK_MAX, Math.max(CLOCK_MIN, clock));
}

function canStart(n: Node) {
  const recipe = n.recipe;
  if (!recipe || n.crafting) return false;
  if (recipe.input && n.input < recipe.input.count) return false;
  return !recipe.output || n.output + recipe.output.count <= n.outputCap;
}

function start(n: Node) {
  const input = n.recipe?.input;
  if (input) n.input -= input.count;
  n.crafting = true;
}

function craft(line: Line, n: Node, dt: number) {
  const recipe = n.recipe;
  if (!recipe) return;
  if (n.warmup > 0) {
    n.warmup = Math.max(0, n.warmup - dt);
    return;
  }
  if (!n.crafting && canStart(n)) {
    start(n);
    n.progress = 0;
  }
  if (!n.crafting) return;
  n.progress += (dt * n.clock) / recipe.seconds;
  while (n.crafting && n.progress >= 1) {
    if (recipe.output) n.output += recipe.output.count;
    else line.arrivals.push(line.time);
    n.crafting = false;
    const leftover = n.progress - 1;
    n.progress = 0;
    if (canStart(n)) {
      start(n);
      n.progress = leftover;
    }
  }
}

function accepts(n: Node) {
  return n.kind === "machine" ? n.input < n.inputCap : n.output < 1;
}

function statusOf(n: Node): NodeStatus {
  if (n.kind !== "machine") return n.output > 0 ? "blocked" : "working";
  const recipe = n.recipe;
  if (!recipe || n.crafting || n.warmup > 0) return "working";
  if (recipe.input && n.input < recipe.input.count) return "starved";
  return "blocked";
}

function tailClear(belt: Belt) {
  const tail = belt.items[belt.items.length - 1];
  return tail === undefined || tail >= belt.spacing;
}

function substep(line: Line, dt: number) {
  const { nodes, belts } = line;
  line.time += dt;
  if (!line.powered) {
    for (const n of nodes) n.status = "off";
    return;
  }
  line.uptime += dt;

  // 1. Belt heads hand over when the next node has room, in turn for mergers.
  for (const n of nodes) {
    const count = n.incoming.length;
    for (let k = 0; k < count && accepts(n); k++) {
      const i = (n.nextIn + k) % count;
      const belt = belts[n.incoming[i]];
      if (belt.items.length === 0 || belt.items[0] < belt.length - 1e-9) {
        continue;
      }
      belt.items.shift();
      if (n.kind === "machine") n.input += 1;
      else n.output += 1;
      n.nextIn = (i + 1) % count;
    }
  }

  // 2. Machines craft.
  for (const n of nodes) craft(line, n, dt);

  // 3. Items leave onto outgoing belts once the tail has cleared, in turn for
  // splitters.
  for (const n of nodes) {
    const count = n.outgoing.length;
    for (let k = 0; k < count && n.output > 0; k++) {
      const i = (n.nextOut + k) % count;
      const belt = belts[n.outgoing[i]];
      if (!tailClear(belt)) continue;
      belt.items.push(0);
      n.output -= 1;
      n.nextOut = (i + 1) % count;
    }
  }

  // 4. Belts advance; each item stops a spacing behind the one ahead.
  for (const belt of belts) {
    let limit = belt.length;
    for (let i = 0; i < belt.items.length; i++) {
      const next = Math.min(belt.items[i] + belt.speed * dt, limit);
      belt.items[i] = Math.max(belt.items[i], next);
      limit = belt.items[i] - belt.spacing;
    }
  }

  for (const n of nodes) n.status = statusOf(n);

  const cutoff = line.time - RATE_WINDOW;
  while (line.arrivals.length > 0 && line.arrivals[0] < cutoff) {
    line.arrivals.shift();
  }
}

/** Advances the line by `dt` seconds in small fixed-size substeps. */
export function stepLine(line: Line, dt: number) {
  let remaining = Math.max(0, dt);
  while (remaining > 1e-9) {
    const h = Math.min(MAX_STEP, remaining);
    substep(line, h);
    remaining -= h;
  }
}

/** Items per minute consumed by sinks, over the rate window. */
export function deliveredRate(line: Line) {
  const window = Math.min(RATE_WINDOW, line.uptime);
  if (window < 1) return 0;
  return (line.arrivals.length / window) * 60;
}

/** Seconds a flash takes to rise, and to fall to a third. */
const FLASH_RISE = 0.06;
const FLASH_FALL = 0.25;

/**
 * How bright a light that flashes with each upload is now, 0–1: every
 * arrival rises quickly, then dies away; overlapping flashes add up.
 */
export function flashLevel(line: Line) {
  let level = 0;
  for (let i = line.arrivals.length - 1; i >= 0; i--) {
    const age = line.time - line.arrivals[i];
    if (age < 0) continue;
    if (age > FLASH_FALL * 6) break;
    const rise = Math.min(1, age / FLASH_RISE);
    level += rise * rise * (3 - 2 * rise) * Math.exp(-age / FLASH_FALL);
  }
  return Math.min(1, level);
}

/** Items per minute a recipe makes (or a sink takes) at a clock speed. */
export function recipeRate(recipe: Recipe, clock = 1) {
  const stack = recipe.output ?? recipe.input;
  return ((stack?.count ?? 0) * 60 * clock) / recipe.seconds;
}
