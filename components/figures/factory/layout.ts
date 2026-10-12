// Where the factory's buildings stand. World units are metres, y up, matching
// the exported game meshes; the slab is a grid of 8 × 8 × 1 m foundations.
// Port offsets come from the game's Build_* blueprints: machines take items in
// on one local z side and put them out on the other, 1 m above their floor;
// splitters and mergers connect at their origin, which sits at belt height.

import {
  type BeltSpec,
  type BeltTier,
  type ItemKind,
  type NodeSpec,
  RECIPES,
  type Recipe,
} from "./sim";

export type Vec3 = readonly [number, number, number];

export type ModelName =
  | "miner-mk1"
  | "smelter"
  | "constructor"
  | "depot"
  | "splitter"
  | "merger"
  | "belt"
  | "belt-mk3"
  | "foundation"
  | "node-iron"
  | ItemKind;

export type BuildingKind =
  | "miner"
  | "smelter"
  | "constructor"
  | "depot"
  | "splitter"
  | "merger";

interface BuildingSpec {
  model: ModelName;
  /** Ports in the building's local frame. */
  ports: Record<string, Vec3>;
  /** Local footprint, [minX, minZ, maxX, maxZ]. */
  footprint: readonly [number, number, number, number];
  height: number;
  /** Splitters and mergers sit with their origin at belt height. */
  attachment?: boolean;
  recipe?: Recipe;
}

export const BUILDINGS: Record<BuildingKind, BuildingSpec> = {
  miner: {
    model: "miner-mk1",
    ports: { out: [0, 1, 8] },
    footprint: [-3.3, -4.8, 3.3, 9.5],
    height: 18.4,
    recipe: RECIPES.ironOre,
  },
  smelter: {
    model: "smelter",
    ports: { in: [0, 1, -3], out: [0, 1, 2] },
    footprint: [-2.5, -5, 2.5, 4],
    height: 8.6,
    recipe: RECIPES.ironIngot,
  },
  constructor: {
    model: "constructor",
    ports: { in: [0, 1, -3], out: [0, 1, 3] },
    footprint: [-3.8, -5, 3.8, 4.7],
    height: 7.3,
    recipe: RECIPES.castScrews,
  },
  depot: {
    model: "depot",
    ports: { in: [0, 1, 3.9] },
    footprint: [-2.5, -4.7, 2.5, 5.2],
    height: 6,
    recipe: RECIPES.upload,
  },
  splitter: {
    model: "splitter",
    ports: {
      in: [-1, 0, 0],
      "+x": [1, 0, 0],
      "+z": [0, 0, 1],
      "-z": [0, 0, -1],
    },
    footprint: [-2.1, -2.1, 2.1, 2.1],
    height: 2,
    attachment: true,
  },
  merger: {
    model: "merger",
    ports: {
      "-x": [-1, 0, 0],
      "+z": [0, 0, 1],
      "-z": [0, 0, -1],
      out: [1, 0, 0],
    },
    footprint: [-2.1, -2.1, 2.1, 2.1],
    height: 2,
    attachment: true,
  },
};

export const FOUNDATION = 8;
/** Top of the foundation slab. */
export const FLOOR = 1;
export const PORT_HEIGHT = 1;
/** Radius of a belt bend in the game's straight build mode, metres. */
export const BELT_BEND = 2;
/** Belt meshes are 2 m long. */
export const BELT_SEGMENT = 2;
/** Height of each belt tier's running surface above its spline. */
export const BELT_SURFACE: Record<BeltTier, number> = { mk1: 0.1, mk3: 0.28 };

export interface Placement {
  /** Stable key. */
  id: string;
  /** Readout group, e.g. "Constructors"; empty for splitters and mergers. */
  group: string;
  kind: BuildingKind;
  /** Floor position [x, z]. */
  at: readonly [number, number];
  /** Rotation about y; a turn of θ points local +z at (sin θ, cos θ). */
  yaw: number;
  /**
   * Stands on its resource node, like a miner: level with the slab, so belts
   * leave it flat, but with no foundation under it.
   */
  onNode?: boolean;
}

export interface BeltRoute {
  from: readonly [id: string, port: string];
  to: readonly [id: string, port: string];
  /** Corners between the two ports, [x, z] at belt height. */
  via?: readonly (readonly [number, number])[];
  tier: BeltTier;
  item: ItemKind;
  /** Crosses open ground, so lays no foundation under itself. */
  floating?: boolean;
}

export interface PlacedBuilding extends Placement {
  position: Vec3;
}

export interface BeltPath {
  points: Vec3[];
  length: number;
  tier: BeltTier;
  item: ItemKind;
  from: number;
  to: number;
}

export interface FactoryLayout {
  buildings: PlacedBuilding[];
  belts: BeltPath[];
  /** Foundation tile centres [x, z]. */
  tiles: (readonly [number, number])[];
  min: Vec3;
  max: Vec3;
}

const QUARTER = Math.PI / 2;
/** The constructor array runs along z, one machine every 12 m. */
const ARRAY_Z = [28, 40, 52, 64, 76] as const;
const SPLIT_X = 34;
const MAKE_X = 43;
const MERGE_X = 52;
/** The screws loop round the front of the array and back to the uploader. */
const LOOP_Z = 84;
const DEPOT_X = 22;

/**
 * The screw factory: one miner feeds two smelters through a splitter, their
 * ingots merge onto one belt that a column of splitters shares among five
 * Cast Screws constructors, and a column of mergers carries the screws on to
 * the Dimensional Depot uploader. Smelters, constructors and the uploader all
 * line up along z.
 */
export const SCREW_FACTORY: { placements: Placement[]; routes: BeltRoute[] } = {
  placements: [
    {
      id: "miner",
      group: "Miner",
      kind: "miner",
      at: [1, 41],
      yaw: QUARTER,
      onNode: true,
    },
    {
      // Turned to face the miner's belt, it feeds smelter B and passes the rest back.
      id: "ore-split",
      group: "",
      kind: "splitter",
      at: [20, 21],
      yaw: QUARTER,
    },
    {
      id: "smelter-a",
      group: "Smelters",
      kind: "smelter",
      at: [27, 13],
      yaw: QUARTER,
    },
    {
      id: "smelter-b",
      group: "Smelters",
      kind: "smelter",
      at: [27, 21],
      yaw: QUARTER,
    },
    // Turned a quarter back, the merger passes +z into the splitter column.
    {
      id: "ingot-merge",
      group: "",
      kind: "merger",
      at: [SPLIT_X, 21],
      yaw: -QUARTER,
    },
    ...ARRAY_Z.flatMap((z, i): Placement[] => [
      // Turned a quarter back, a splitter passes +z and feeds +x from -z.
      {
        id: `split-${i}`,
        group: "",
        kind: "splitter",
        at: [SPLIT_X, z],
        yaw: -QUARTER,
      },
      {
        id: `maker-${i}`,
        group: "Constructors",
        kind: "constructor",
        at: [MAKE_X, z],
        yaw: QUARTER,
      },
      // Turned the same way, a merger passes +z and takes its +z input from -x.
      {
        id: `merge-${i}`,
        group: "",
        kind: "merger",
        at: [MERGE_X, z],
        yaw: -QUARTER,
      },
    ]),
    {
      id: "depot",
      group: "Uploader",
      kind: "depot",
      at: [DEPOT_X, 55],
      yaw: 0,
    },
  ],
  routes: [
    {
      from: ["miner", "out"],
      to: ["ore-split", "in"],
      via: [[20, 41]],
      tier: "mk1",
      item: "ore",
      floating: true,
    },
    {
      from: ["ore-split", "+x"],
      to: ["smelter-a", "in"],
      via: [[20, 13]],
      tier: "mk1",
      item: "ore",
    },
    {
      from: ["ore-split", "+z"],
      to: ["smelter-b", "in"],
      tier: "mk1",
      item: "ore",
    },
    {
      from: ["smelter-a", "out"],
      to: ["ingot-merge", "-x"],
      via: [[SPLIT_X, 13]],
      tier: "mk1",
      item: "ingot",
    },
    {
      from: ["smelter-b", "out"],
      to: ["ingot-merge", "+z"],
      tier: "mk1",
      item: "ingot",
    },
    {
      from: ["ingot-merge", "out"],
      to: ["split-0", "in"],
      tier: "mk1",
      item: "ingot",
    },
    ...ARRAY_Z.flatMap((_, i): BeltRoute[] => [
      ...(i > 0
        ? ([
            {
              from: [`split-${i - 1}`, "+x"],
              to: [`split-${i}`, "in"],
              tier: "mk1",
              item: "ingot",
            },
            {
              from: [`merge-${i - 1}`, "out"],
              to: [`merge-${i}`, "-x"],
              tier: "mk3",
              item: "screw",
            },
          ] as const)
        : []),
      {
        from: [`split-${i}`, "-z"],
        to: [`maker-${i}`, "in"],
        tier: "mk1",
        item: "ingot",
      },
      {
        from: [`maker-${i}`, "out"],
        to: [`merge-${i}`, "+z"],
        tier: "mk3",
        item: "screw",
      },
    ]),
    {
      from: [`merge-${ARRAY_Z.length - 1}`, "out"],
      to: ["depot", "in"],
      via: [
        [MERGE_X, LOOP_Z],
        [DEPOT_X, LOOP_Z],
      ],
      tier: "mk3",
      item: "screw",
    },
  ],
};

function rotate([x, y, z]: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, y, -x * s + z * c];
}

function baseHeight(p: Placement) {
  return BUILDINGS[p.kind].attachment ? FLOOR + PORT_HEIGHT : FLOOR;
}

export function portOf(b: PlacedBuilding, port: string): Vec3 {
  const local = BUILDINGS[b.kind].ports[port];
  if (!local) throw new Error(`${b.id} has no port ${port}.`);
  const [x, y, z] = rotate(local, b.yaw);
  return [b.position[0] + x, b.position[1] + y, b.position[2] + z];
}

/**
 * Replaces each corner of a level polyline with a circular arc of `radius`,
 * as the game bends a belt between two straight runs.
 */
export function roundCorners(
  points: readonly Vec3[],
  radius = BELT_BEND,
): Vec3[] {
  const out: Vec3[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, , az] = points[i - 1];
    const [px, py, pz] = points[i];
    const [bx, , bz] = points[i + 1];
    const l1 = Math.hypot(px - ax, pz - az);
    const l2 = Math.hypot(bx - px, bz - pz);
    const ux = (px - ax) / l1;
    const uz = (pz - az) / l1;
    const vx = (bx - px) / l2;
    const vz = (bz - pz) / l2;
    const turn = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
    const cut = radius * Math.tan(Math.abs(turn) / 2);
    if (Math.abs(turn) < 1e-6 || cut > Math.min(l1, l2) + 1e-9) {
      out.push(points[i]);
      continue;
    }
    // Arc from the tangent point on the way in to the one on the way out.
    const sx = px - ux * cut;
    const sz = pz - uz * cut;
    const side = Math.sign(turn);
    const cx = sx - uz * radius * side;
    const cz = sz + ux * radius * side;
    const start = Math.atan2(sz - cz, sx - cx);
    const steps = Math.max(2, Math.ceil(Math.abs(turn) / (Math.PI / 24)));
    for (let k = 0; k <= steps; k++) {
      const a = start + (turn * k) / steps;
      out.push([cx + Math.cos(a) * radius, py, cz + Math.sin(a) * radius]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function polylineLength(points: readonly Vec3[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    length += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return length;
}

export function layoutFactory(spec = SCREW_FACTORY): FactoryLayout {
  const buildings = spec.placements.map(
    (p): PlacedBuilding => ({
      ...p,
      position: [p.at[0], baseHeight(p), p.at[1]],
    }),
  );
  const index = new Map(buildings.map((b, i) => [b.id, i]));
  const find = (id: string) => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`No building ${id}.`);
    return i;
  };

  const routes = spec.routes;
  const belts = routes.map((route): BeltPath => {
    const from = find(route.from[0]);
    const to = find(route.to[0]);
    const start = portOf(buildings[from], route.from[1]);
    const end = portOf(buildings[to], route.to[1]);
    const corners = (route.via ?? []).map(([x, z]): Vec3 => [x, end[1], z]);
    const points = roundCorners([start, ...corners, end]);
    return {
      points,
      length: polylineLength(points),
      tier: route.tier,
      item: route.item,
      from,
      to,
    };
  });

  // Foundations under every slab building, filled out to a rectangle.
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const min: [number, number, number] = [Infinity, 0, Infinity];
  const max: [number, number, number] = [-Infinity, FLOOR, -Infinity];
  for (const b of buildings) {
    const building = BUILDINGS[b.kind];
    const [fx0, fz0, fx1, fz1] = building.footprint;
    for (const [lx, lz] of [
      [fx0, fz0],
      [fx1, fz0],
      [fx0, fz1],
      [fx1, fz1],
    ] as const) {
      const [cx, , cz] = rotate([lx, 0, lz], b.yaw);
      const x = b.position[0] + cx;
      const z = b.position[2] + cz;
      min[0] = Math.min(min[0], x);
      max[0] = Math.max(max[0], x);
      min[2] = Math.min(min[2], z);
      max[2] = Math.max(max[2], z);
      if (!b.onNode) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
    }
    max[1] = Math.max(max[1], b.position[1] + building.height);
  }
  // Belt runs on the slab need floor under them too, edge to edge.
  belts.forEach((belt, i) => {
    if (routes[i].floating) return;
    for (const [x, , z] of belt.points) {
      x0 = Math.min(x0, x - 1);
      x1 = Math.max(x1, x + 1);
      z0 = Math.min(z0, z - 1);
      z1 = Math.max(z1, z + 1);
    }
  });
  // Buildings on a resource node stand in a hole in the slab.
  const holes = buildings
    .filter((b) => b.onNode)
    .map((b) => {
      const [fx0, fz0, fx1, fz1] = BUILDINGS[b.kind].footprint;
      const corners = [
        rotate([fx0, 0, fz0], b.yaw),
        rotate([fx1, 0, fz1], b.yaw),
      ];
      return {
        x0: b.position[0] + Math.min(corners[0][0], corners[1][0]),
        x1: b.position[0] + Math.max(corners[0][0], corners[1][0]),
        z0: b.position[2] + Math.min(corners[0][2], corners[1][2]),
        z1: b.position[2] + Math.max(corners[0][2], corners[1][2]),
      };
    });
  const tiles: (readonly [number, number])[] = [];
  const first = (v: number) => Math.floor(v / FOUNDATION) * FOUNDATION;
  for (let x = first(x0); x < x1; x += FOUNDATION) {
    for (let z = first(z0); z < z1; z += FOUNDATION) {
      const covered = holes.some(
        (h) =>
          h.x0 < x + FOUNDATION &&
          h.x1 > x &&
          h.z0 < z + FOUNDATION &&
          h.z1 > z,
      );
      if (covered) continue;
      tiles.push([x + FOUNDATION / 2, z + FOUNDATION / 2]);
      min[0] = Math.min(min[0], x);
      max[0] = Math.max(max[0], x + FOUNDATION);
      min[2] = Math.min(min[2], z);
      max[2] = Math.max(max[2], z + FOUNDATION);
    }
  }

  return { buildings, belts, tiles, min, max };
}

/** The simulation graph for a layout: one node per building, one belt per path. */
export function lineSpec(layout: FactoryLayout): {
  nodes: NodeSpec[];
  belts: BeltSpec[];
} {
  return {
    nodes: layout.buildings.map((b): NodeSpec => {
      const recipe = BUILDINGS[b.kind].recipe;
      if (recipe) return { kind: "machine", recipe };
      return { kind: b.kind === "splitter" ? "splitter" : "merger" };
    }),
    belts: layout.belts.map((b) => ({
      from: b.from,
      to: b.to,
      length: b.length,
      item: b.item,
      tier: b.tier,
    })),
  };
}

export interface BeltPoint {
  position: Vec3;
  /** Heading about y of the run at this point. */
  yaw: number;
  /** Slope of the run, radians. */
  pitch: number;
}

/** Point `t` metres along a belt, on its running surface. */
export function pointOnBelt(belt: BeltPath, t: number): BeltPoint {
  const { points } = belt;
  const lift = BELT_SURFACE[belt.tier];
  let remaining = Math.min(Math.max(t, 0), belt.length);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const run = Math.hypot(dx, dy, dz);
    if (remaining <= run || i === points.length - 1) {
      const k = run > 0 ? Math.min(1, remaining / run) : 0;
      return {
        position: [a[0] + dx * k, a[1] + dy * k + lift, a[2] + dz * k],
        yaw: Math.atan2(dx, dz),
        pitch: Math.atan2(dy, Math.hypot(dx, dz)),
      };
    }
    remaining -= run;
  }
  const p = points[0];
  return { position: [p[0], p[1] + lift, p[2]], yaw: 0, pitch: 0 };
}
