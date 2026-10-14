// Where the factory's buildings stand. World units are metres, y up, matching
// the exported game meshes; the slab is a grid of 8 × 8 × 1 m foundations.
// Port offsets come from the game's Build_* blueprints: machines take items in
// on one local z side and put them out on the other, 1 m above their floor;
// splitters and mergers connect at their origin, which sits at belt height.

import { MINER_STARTUP_SECONDS } from "./game";
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
  | "power-pole"
  | ItemKind;

export type BuildingKind =
  | "miner"
  | "smelter"
  | "constructor"
  | "depot"
  | "splitter"
  | "merger";

/**
 * The opening round a port, measured from the game's mesh by the model build
 * (scripts/factory/openings.mjs). Distances run out from the port along its
 * axis: the flat back wall, then the rim; `center` is how far the opening
 * sits to the port's right; `floor` and `top` are heights above the port;
 * its corners are rounded by `radiusTop` and `radiusBottom`.
 */
export interface Opening {
  wall: number;
  rim: number;
  center: number;
  halfWidth: number;
  floor: number;
  top: number;
  radiusTop: number;
  radiusBottom: number;
}

/**
 * When a light is on: while its building works, flashing with each upload,
 * or whenever the line has power.
 */
export type LightOn = "work" | "upload" | "power";

/**
 * A light a building gives off, in its own frame: a glowing sphere, the face
 * of one of its openings, or a glowing panel. `reach` is as far as its
 * shadows are kept, metres; the light itself falls off with distance as light
 * does. `on` says when it is lit, while the building works unless given;
 * `strength` dims a glow beside the others.
 */
export type LightSpec = (
  | {
      kind: "sphere";
      at: Vec3;
      radius: number;
      reach: number;
      /**
       * Like a lighthouse's lamp, the housing lets it out only between these
       * elevations, degrees above level.
       */
      band?: readonly [number, number];
    }
  | { kind: "opening"; port: string; reach: number }
  | {
      kind: "panel";
      /** The panel's middle, its outward facing (level) and half size. */
      at: Vec3;
      normal: Vec3;
      halfWidth: number;
      halfHeight: number;
      reach: number;
      strength?: number;
    }
) & { on?: LightOn; colour?: LightColour };

interface BuildingSpec {
  model: ModelName;
  /** Ports in the building's local frame. */
  ports: Record<string, Vec3>;
  /** Local footprint, [minX, minZ, maxX, maxZ]. */
  footprint: readonly [number, number, number, number];
  height: number;
  /** Splitters and mergers sit with their origin at belt height. */
  attachment?: boolean;
  /**
   * How far items carry on past a port, hidden in the building's walls, so
   * they slide out of it rather than appear at the opening. Metres.
   */
  inset?: number;
  recipe?: Recipe;
  /** Seconds of power before its first craft. */
  startup?: number;
  /** Lights it gives off. */
  lights?: readonly LightSpec[];
  /** The palette colour its lights and glowing body take; the glow's by default. */
  lightColour?: LightColour;
  /** Every accent wakes in its light's colour, not only the glowing body. */
  glowAccents?: boolean;
  /** When the body its light comes from glows; while it works by default. */
  emitterOn?: LightOn;
  /** Where its chimney smokes from while it produces, in its own frame. */
  smoke?: Vec3;
  /** Where power lines plug in, in its own frame. */
  power?: Vec3;
  /**
   * Its glowing body heats toward a core, an oval in its own frame: centre,
   * long axis, and half length and half width, metres.
   */
  core?: { at: Vec3; axis: Vec3; length: number; width: number };
}

/** Palette colours a light can take. */
export type LightColour = "glow" | "forge" | "power";

export const BUILDINGS: Record<BuildingKind, BuildingSpec> = {
  miner: {
    model: "miner-mk1",
    ports: { out: [0, 1, 8] },
    footprint: [-3.3, -4.8, 3.3, 9.5],
    height: 18.4,
    recipe: RECIPES.ironOre,
    startup: MINER_STARTUP_SECONDS,
    // Build_MinerMk1's PowerInput, high on the tower.
    power: [1.2616, 17.9981, 0.1579],
  },
  smelter: {
    model: "smelter",
    ports: { in: [0, 1, -3], out: [0, 1, 2] },
    footprint: [-2.5, -5, 2.5, 4],
    height: 8.6,
    recipe: RECIPES.ironIngot,
    // The forge's mouth on top of the tower glows while it smelts, paling to
    // a hot core in its middle, as in the game.
    lightColour: "forge",
    // The mouth is 1.7 m along the tower by 0.56 m across.
    core: { at: [0, 7.9, 1.57], axis: [0, 0, 1], length: 0.85, width: 0.28 },
    lights: [
      // The forge's heat glows up out of the mouth onto its walls and rim.
      {
        kind: "sphere",
        at: [0, 8.05, 1.57],
        radius: 0.35,
        reach: 3,
        band: [0, 90],
      },
      // The power strip down the tower's front glows softly onto what is near.
      {
        kind: "panel",
        at: [0, 5.98, 3.5],
        normal: [0, 0, 1],
        halfWidth: 0.06,
        halfHeight: 0.94,
        reach: 3,
        on: "power",
        colour: "power",
      },
    ],
    // NS_SmelterSmoke rises from SM_VAT_Smelter_01's burnerVfxSocket, the
    // chimney's top, where Build_SmelterMk1 places the tower.
    smoke: [0, 7.92, 1.57],
    // Build_SmelterMk1's PowerConnection, on its turned body proxy.
    power: [2.2, 4.8, -3.1],
  },
  constructor: {
    model: "constructor",
    ports: { in: [0, 1, -3], out: [0, 1, 3] },
    footprint: [-3.8, -5, 3.8, 4.7],
    height: 7.3,
    recipe: RECIPES.castScrews,
    // Build_ConstructorMk1's PowerInput, up on its top.
    power: [2.1, 6.8717, -4.7],
  },
  depot: {
    model: "depot",
    ports: { in: [0, 1, 3.9] },
    footprint: [-2.5, -4.7, 2.5, 5.2],
    height: 6,
    recipe: RECIPES.upload,
    glowAccents: true,
    emitterOn: "power",
    lights: [
      // The Mercer sphere inside the top cap: the rings' centre, where
      // Build_CentralStorage's MainMesh places them; SM_Mercer_Rings'
      // 0.91 m sphere at the blueprint's 0.54 scale.
      // Its light leaves sideways, between the collar and the cap.
      {
        kind: "sphere",
        at: [0, 3.55, -1.09],
        radius: 0.49,
        reach: 8,
        band: [-12, 25],
        on: "power",
      },
      // The upload slot flashes out through the entrance as screws go up.
      { kind: "opening", port: "in", reach: 8, on: "upload" },
      // The windows down either side glow softly.
      ...([1, -1] as const).map(
        (side): LightSpec => ({
          kind: "panel",
          at: [side * 1.34, 2.21, 1.73],
          normal: [side, 0, 0],
          halfWidth: 0.78,
          halfHeight: 0.29,
          reach: 5,
          strength: 0.35,
        }),
      ),
    ],
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
    inset: 0.8,
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
    inset: 0.8,
  },
};

export const FOUNDATION = 8;
/** Top of the foundation slab. */
export const FLOOR = 1;
export const PORT_HEIGHT = 1;
/** Radius of a belt bend in the game's straight build mode, metres. */
export const BELT_BEND = 2;
/** Belt meshes are 2 m long; both tiers run their surface on the spline. */
export const BELT_SEGMENT = 2;

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
   * Stands on its resource node, like a miner. The slab runs on under it,
   * drawn faint so the node shows through.
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
  /** The ports it joins, by name, at its source and its target. */
  ports: readonly [string, string];
  /** The belt's spline, port to port. */
  points: Vec3[];
  /** Heading about y at each point, true to the arcs. */
  headings: number[];
  /** Hidden item travel inside the source and target buildings. */
  lead: number;
  tail: number;
  /** Item travel: lead, the spline, then tail. */
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
  /** By tile: under a building on its resource node, so drawn faint. */
  faint: boolean[];
  min: Vec3;
  max: Vec3;
}

const QUARTER = Math.PI / 2;
/** The constructor array runs along z, one machine every 10 m. */
const ARRAY_Z = [28, 38, 48, 58, 68] as const;
const LAST_Z = ARRAY_Z[ARRAY_Z.length - 1];
const SPLIT_X = 34;
const MAKE_X = 43;
const MERGE_X = 52;
/** The screws loop round the front of the array and back to the uploader. */
const LOOP_Z = LAST_Z + 10;
/** The uploader stands between smelter B and the array, fed up the middle. */
const DEPOT_X = 28;
const DEPOT_Z = 46;
/**
 * Smelters stand beside the array, each centred across its foundation row;
 * the first shares the first splitter's row.
 */
const SMELT_X = 26;
const SMELT_Z = [ARRAY_Z[0], 36] as const;
/** Their ingots merge just short of the first splitter. */
const INGOT_X = 31;
const ORE_X = 20;
/**
 * The miner stands on the slab in line with the ore splitter, facing it, so
 * its belt runs straight in.
 */
const MINER_Z = LOOP_Z - 4;

/** The splitter port that carries ingots on down the column. */
function passOn(i: number) {
  return i === 0 ? "+z" : "+x";
}

/** The splitter port that feeds its constructor. */
function feedOut(i: number) {
  return i === 0 ? "+x" : "-z";
}

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
      at: [ORE_X, MINER_Z],
      yaw: Math.PI,
      onNode: true,
    },
    {
      // Turned to face the miner's belt, it feeds smelter B and passes the rest on.
      id: "ore-split",
      group: "",
      kind: "splitter",
      at: [ORE_X, SMELT_Z[1]],
      yaw: QUARTER,
    },
    {
      id: "smelter-a",
      group: "Smelters",
      kind: "smelter",
      at: [SMELT_X, SMELT_Z[0]],
      yaw: QUARTER,
    },
    {
      id: "smelter-b",
      group: "Smelters",
      kind: "smelter",
      at: [SMELT_X, SMELT_Z[1]],
      yaw: QUARTER,
    },
    // Facing +x, the merger takes smelter A head on and smelter B from +z, and
    // passes the ingots straight on into the first splitter.
    {
      id: "ingot-merge",
      group: "",
      kind: "merger",
      at: [INGOT_X, SMELT_Z[0]],
      yaw: 0,
    },
    ...ARRAY_Z.flatMap((z, i): Placement[] => [
      // Turned a quarter back, a splitter passes +z and feeds +x from -z. The
      // first faces +x instead, to take the ingots head on.
      {
        id: `split-${i}`,
        group: "",
        kind: "splitter",
        at: [SPLIT_X, z],
        yaw: i === 0 ? 0 : -QUARTER,
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
      at: [DEPOT_X, DEPOT_Z],
      yaw: 0,
    },
  ],
  routes: [
    {
      from: ["miner", "out"],
      to: ["ore-split", "in"],
      tier: "mk1",
      item: "ore",
    },
    {
      from: ["ore-split", "+x"],
      to: ["smelter-a", "in"],
      via: [[ORE_X, SMELT_Z[0]]],
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
      tier: "mk1",
      item: "ingot",
    },
    {
      from: ["smelter-b", "out"],
      to: ["ingot-merge", "+z"],
      via: [[INGOT_X, SMELT_Z[1]]],
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
              from: [`split-${i - 1}`, passOn(i - 1)],
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
        from: [`split-${i}`, feedOut(i)],
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
  return bend(points, radius).points;
}

function heading(a: Vec3, b: Vec3) {
  return Math.atan2(b[0] - a[0], b[2] - a[2]);
}

/** Shortest turn from heading `a` to heading `b`, radians. */
function turnBetween(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** roundCorners, with the true heading at every point of the result. */
function bend(points: readonly Vec3[], radius: number) {
  const out: Vec3[] = [points[0]];
  const headings = [heading(points[0], points[1])];
  for (let i = 1; i < points.length - 1; i++) {
    const into = heading(points[i - 1], points[i]);
    const delta = turnBetween(into, heading(points[i], points[i + 1]));
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
      headings.push(into + delta / 2);
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
      headings.push(into + (delta * k) / steps);
    }
  }
  const n = points.length;
  out.push(points[n - 1]);
  headings.push(heading(points[n - 2], points[n - 1]));
  return { points: out, headings };
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
    const { points, headings } = bend([start, ...corners, end], BELT_BEND);
    const lead = BUILDINGS[buildings[from].kind].inset ?? 0;
    const tail = BUILDINGS[buildings[to].kind].inset ?? 0;
    return {
      points,
      headings,
      lead,
      tail,
      length: lead + polylineLength(points) + tail,
      ports: [route.from[1], route.to[1]],
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
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
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
  // Buildings on a resource node leave the slab under them faint.
  const nodes = buildings
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
  const faint: boolean[] = [];
  const first = (v: number) => Math.floor(v / FOUNDATION) * FOUNDATION;
  for (let x = first(x0); x < x1; x += FOUNDATION) {
    for (let z = first(z0); z < z1; z += FOUNDATION) {
      tiles.push([x + FOUNDATION / 2, z + FOUNDATION / 2]);
      faint.push(
        nodes.some(
          (h) =>
            h.x0 < x + FOUNDATION &&
            h.x1 > x &&
            h.z0 < z + FOUNDATION &&
            h.z1 > z,
        ),
      );
      min[0] = Math.min(min[0], x);
      max[0] = Math.max(max[0], x + FOUNDATION);
      min[2] = Math.min(min[2], z);
      max[2] = Math.max(max[2], z + FOUNDATION);
    }
  }

  return { buildings, belts, tiles, faint, min, max };
}

/** The simulation graph for a layout: one node per building, one belt per path. */
export function lineSpec(layout: FactoryLayout): {
  nodes: NodeSpec[];
  belts: BeltSpec[];
} {
  return {
    nodes: layout.buildings.map((b): NodeSpec => {
      const { recipe, startup } = BUILDINGS[b.kind];
      if (recipe) return { kind: "machine", recipe, startup };
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

/**
 * Point `t` metres along a belt's item travel, on its running surface. The
 * lead and tail run straight on from the end ports, inside the buildings.
 */
export function pointOnBelt(belt: BeltPath, t: number): BeltPoint {
  const { points, headings } = belt;
  const last = points.length - 1;
  let remaining = Math.min(Math.max(t, 0), belt.length) - belt.lead;
  for (let i = 1; i <= last; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const run = Math.hypot(dx, dy, dz);
    // Before the first point or past the last, carry on along the end run.
    if (remaining <= run || i === last) {
      const k = run > 0 ? remaining / run : 0;
      const along = Math.min(Math.max(k, 0), 1);
      return {
        position: [a[0] + dx * k, a[1] + dy * k, a[2] + dz * k],
        yaw:
          headings[i - 1] + turnBetween(headings[i - 1], headings[i]) * along,
        pitch: Math.atan2(dy, Math.hypot(dx, dz)),
      };
    }
    remaining -= run;
  }
  return { position: points[0], yaw: headings[0], pitch: 0 };
}

export interface PortVolume extends Opening {
  /** The building it opens through, by index, and the port's name. */
  building: number;
  name: string;
  /** The port, at belt height. */
  origin: Vec3;
  /** Level unit direction out of the building through the port. */
  outward: Vec3;
}

export interface Ports {
  ports: PortVolume[];
  /** Port indices of each building, every port whether a belt joins or not. */
  byBuilding: number[][];
  /** The port at each end of each belt: [start, end]. */
  byBelt: (readonly [number, number])[];
}

/**
 * Every opening of every building, placed in the world. `openingsOf` gives a
 * building's measured openings by port name.
 */
export function portVolumes(
  layout: FactoryLayout,
  openingsOf: (building: PlacedBuilding) => Record<string, Opening> | undefined,
): Ports {
  const ports: PortVolume[] = [];
  const index = new Map<string, number>();
  const byBuilding = layout.buildings.map((b, i) =>
    Object.entries(BUILDINGS[b.kind].ports).flatMap(([name, local]) => {
      const opening = openingsOf(b)?.[name];
      if (!opening) return [];
      const [x, , z] = rotate(local, b.yaw);
      const length = Math.hypot(x, z) || 1;
      ports.push({
        ...opening,
        building: i,
        name,
        origin: portOf(b, name),
        outward: [x / length, 0, z / length],
      });
      index.set(`${i}:${name}`, ports.length - 1);
      return [ports.length - 1];
    }),
  );
  const at = (building: number, port: string) =>
    index.get(`${building}:${port}`) ?? -1;
  const byBelt = layout.belts.map(
    (belt) =>
      [at(belt.from, belt.ports[0]), at(belt.to, belt.ports[1])] as const,
  );
  return { ports, byBuilding, byBelt };
}

export interface Light {
  kind: "sphere" | "opening" | "panel";
  /** The building that gives it off, by index. */
  building: number;
  /**
   * A sphere's centre, a panel's middle, or the middle of an opening at its
   * back wall: the glow fills the opening from there, so its light does too.
   */
  position: Vec3;
  reach: number;
  /** An opening's or panel's outward facing; level. */
  normal: Vec3;
  /** An opening's or panel's half width and half height. */
  halfWidth: number;
  halfHeight: number;
  /** A sphere's radius. */
  radius: number;
  /** Elevations, degrees above level, a sphere's light leaves between. */
  band: readonly [number, number];
  /** When it is lit. */
  on: LightOn;
  /** How bright beside the building's other lights, 0–1. */
  strength: number;
  /** Its palette colour. */
  colour: LightColour;
  /** The port an opening light glows through. */
  port?: string;
}

/** Every light the layout's buildings give off, placed in the world. */
export function lightsOf(
  layout: FactoryLayout,
  openingsOf: (building: PlacedBuilding) => Record<string, Opening> | undefined,
): Light[] {
  return layout.buildings.flatMap((b, i) =>
    (BUILDINGS[b.kind].lights ?? []).flatMap((spec): Light[] => {
      if (spec.kind === "sphere") {
        const [x, y, z] = rotate(spec.at, b.yaw);
        return [
          {
            kind: "sphere",
            building: i,
            position: [b.position[0] + x, b.position[1] + y, b.position[2] + z],
            reach: spec.reach,
            normal: [0, 0, 0],
            halfWidth: 0,
            halfHeight: 0,
            radius: spec.radius,
            band: spec.band ?? [-90, 90],
            on: spec.on ?? "work",
            strength: 1,
            colour: spec.colour ?? BUILDINGS[b.kind].lightColour ?? "glow",
          },
        ];
      }
      if (spec.kind === "panel") {
        const [x, y, z] = rotate(spec.at, b.yaw);
        return [
          {
            kind: "panel",
            building: i,
            position: [b.position[0] + x, b.position[1] + y, b.position[2] + z],
            reach: spec.reach,
            normal: rotate(spec.normal, b.yaw),
            halfWidth: spec.halfWidth,
            halfHeight: spec.halfHeight,
            radius: 0,
            band: [-90, 90],
            on: spec.on ?? "work",
            strength: spec.strength ?? 1,
            colour: spec.colour ?? BUILDINGS[b.kind].lightColour ?? "glow",
          },
        ];
      }
      const opening = openingsOf(b)?.[spec.port];
      if (!opening) return [];
      const local = BUILDINGS[b.kind].ports[spec.port];
      const [lx, , lz] = rotate(local, b.yaw);
      const length = Math.hypot(lx, lz) || 1;
      const out: Vec3 = [lx / length, 0, lz / length];
      const right: Vec3 = [-out[2], 0, out[0]];
      const [ox, oy, oz] = portOf(b, spec.port);
      const lift = (opening.floor + opening.top) / 2;
      return [
        {
          kind: "opening",
          building: i,
          position: [
            ox + out[0] * opening.wall + right[0] * opening.center,
            oy + lift,
            oz + out[2] * opening.wall + right[2] * opening.center,
          ],
          reach: spec.reach,
          normal: out,
          halfWidth: opening.halfWidth,
          halfHeight: (opening.top - opening.floor) / 2,
          radius: 0,
          band: [-90, 90],
          on: spec.on ?? "work",
          strength: 1,
          colour: spec.colour ?? BUILDINGS[b.kind].lightColour ?? "glow",
          port: spec.port,
        },
      ];
    }),
  );
}

/** A point a light's shadows are seen from, standing for part of its glow. */
export interface ShadowView {
  /** The light, by index. */
  light: number;
  origin: Vec3;
  /** Half the width of the part of the glow it stands for, metres. */
  size: number;
  /**
   * Items pass through what it sees, so its shadows move: an opening's. The
   * rest see only the buildings and are drawn once.
   */
  moving: boolean;
}

/** How far out from an opening's face its shadows are seen, clear of it. */
const SHADOW_LIFT = 0.05;

/**
 * Where each light's shadows are seen from. A sphere is small beside what it
 * lights: its centre will do, and so will a dim panel's middle, just out from
 * it. An opening is not: an item on the belt hides its lower half and not its
 * upper, so it is seen from the middle of each quarter of its face.
 */
export function shadowViews(lights: readonly Light[]): ShadowView[] {
  return lights.flatMap((light, i): ShadowView[] => {
    if (light.kind === "sphere") {
      return [
        { light: i, origin: light.position, size: light.radius, moving: false },
      ];
    }
    const [nx, , nz] = light.normal;
    const [x, y, z] = light.position;
    if (light.kind === "panel") {
      return [
        {
          light: i,
          origin: [x + nx * SHADOW_LIFT, y, z + nz * SHADOW_LIFT],
          size: Math.max(light.halfWidth, light.halfHeight),
          moving: false,
        },
      ];
    }
    const w = light.halfWidth / 2;
    const h = light.halfHeight / 2;
    return [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([u, v]) => ({
      light: i,
      origin: [
        x + nx * SHADOW_LIFT - nz * u * w,
        y + v * h,
        z + nz * SHADOW_LIFT + nx * u * w,
      ],
      size: Math.max(w, h),
      moving: true,
    }));
  });
}

/** Every chimney that smokes, by building, placed in the world. */
export function smokeOf(layout: FactoryLayout) {
  return layout.buildings.flatMap((b, i) => {
    const at = BUILDINGS[b.kind].smoke;
    if (!at) return [];
    const [x, y, z] = rotate(at, b.yaw);
    const position: Vec3 = [
      b.position[0] + x,
      b.position[1] + y,
      b.position[2] + z,
    ];
    return [{ building: i, position }];
  });
}

/** A point in a building's own frame, placed in the world. */
export function toWorld(building: PlacedBuilding, at: Vec3): Vec3 {
  const [x, y, z] = rotate(at, building.yaw);
  return [
    building.position[0] + x,
    building.position[1] + y,
    building.position[2] + z,
  ];
}

/** A Mk1 power pole: SM_PowerPole_Mk1, its wires on the PowerConnection 7 m up. */
const POLE_TOP = 7;
/** How far the grid feed runs back off the pole, level with its top. */
const FEED_RUN = 24;
/** Share of the feed, from the pole, drawn whole before it dissolves. */
const FEED_SOLID = 0.3;

export interface PowerWire {
  from: Vec3;
  to: Vec3;
  /** Past this share of its run, the wire dissolves into halftone dots. */
  fade?: number;
}

/**
 * The factory's power, run square to the floor grid: every wire goes along
 * x or along z. One feed pole stands where the miner's line crosses the far
 * smelter's: the grid feed comes in along x, the miner's wire runs up its
 * line along z and the far smelter's along x. The rest daisy-chain, as the
 * game allows: back along the smelters, across to the first constructor
 * (their plugs share a row), then down the array. The uploader takes no
 * power in the game.
 */
export function powerOf(layout: FactoryLayout) {
  const base = layout.buildings[0]?.position[1] ?? 0;
  const plug = (b: PlacedBuilding) => {
    const at = BUILDINGS[b.kind].power;
    return at ? toWorld(b, at) : null;
  };
  const plugs = (kind: BuildingKind) =>
    layout.buildings
      .filter((b) => b.kind === kind)
      .map(plug)
      .filter((p): p is Vec3 => p !== null)
      .sort((a, b) => a[2] - b[2]);
  const miner = plugs("miner")[0];
  const smelters = plugs("smelter").reverse();
  const constructors = plugs("constructor");
  const far = smelters[0];
  if (!miner || !far) return { poles: [] as Vec3[], wires: [] as PowerWire[] };
  const pole: Vec3 = [miner[0], base, far[2]];
  const top: Vec3 = [pole[0], base + POLE_TOP, pole[2]];
  const wires: PowerWire[] = [
    // The grid feed: back across the platform's far edge, fading away.
    { from: top, to: [top[0], top[1], top[2] - FEED_RUN], fade: FEED_SOLID },
    { from: top, to: miner },
  ];
  let last = top;
  for (const at of [...smelters, ...constructors]) {
    wires.push({ from: last, to: at });
    last = at;
  }
  return { poles: [pole], wires };
}

/** How far a wire sags at its middle: a little, more on longer spans. */
export const SAG_PER_METRE = 0.025;

/** Points along a wire, sagging as a parabola between its ends. */
export function wirePoints(wire: PowerWire, segments = 24): Vec3[] {
  const { from, to } = wire;
  // Sag grows with the level distance spanned; a wire straight up hangs true.
  const span = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const sag = span * SAG_PER_METRE;
  return Array.from({ length: segments + 1 }, (_, i): Vec3 => {
    const t = i / segments;
    return [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t - 4 * sag * t * (1 - t),
      from[2] + (to[2] - from[2]) * t,
    ];
  });
}

/**
 * Points that bound what is actually drawn, for framing the picture: each
 * building's own box, the foundation's slab, and the power up to where the
 * feed has faded. The layout's overall box is looser: in this view its
 * top-back corner stands well above anything there.
 */
export function contentPoints(layout: FactoryLayout): Vec3[] {
  const points: Vec3[] = [];
  for (const b of layout.buildings) {
    const { footprint, height } = BUILDINGS[b.kind];
    const [fx0, fz0, fx1, fz1] = footprint;
    for (const [x, z] of [
      [fx0, fz0],
      [fx1, fz0],
      [fx0, fz1],
      [fx1, fz1],
    ] as const) {
      points.push(toWorld(b, [x, 0, z]), toWorld(b, [x, height, z]));
    }
  }
  const half = FOUNDATION / 2;
  for (const [x, z] of layout.tiles) {
    for (const y of [0, FLOOR]) {
      points.push(
        [x - half, y, z - half],
        [x + half, y, z - half],
        [x - half, y, z + half],
        [x + half, y, z + half],
      );
    }
  }
  const { poles, wires } = powerOf(layout);
  for (const [x, y, z] of poles) points.push([x, y + POLE_TOP, z]);
  for (const { from, to, fade } of wires) {
    // A fading wire counts out to where it is mostly gone.
    const reach = fade === undefined ? 1 : fade + (1 - fade) / 2;
    points.push(from, [
      from[0] + (to[0] - from[0]) * reach,
      from[1] + (to[1] - from[1]) * reach,
      from[2] + (to[2] - from[2]) * reach,
    ]);
  }
  return points;
}
