import { describe, expect, it } from "vitest";
import {
  BELT_BEND,
  BUILDINGS,
  layoutFactory,
  lightsOf,
  lineSpec,
  pointOnBelt,
  portOf,
  portVolumes,
  roundCorners,
  SCREW_FACTORY,
} from "@/components/figures/factory/layout";
import {
  createLine,
  deliveredRate,
  flashLevel,
  type Line,
  RECIPES,
  recipeRate,
  setClock,
  stepLine,
} from "@/components/figures/factory/sim";

function screwFactory(): Line {
  const { nodes, belts } = lineSpec(layoutFactory());
  return createLine(nodes, belts);
}

function run(line: Line, seconds: number) {
  line.powered = true;
  stepLine(line, seconds);
  return line;
}

describe("factory miner", () => {
  it("spins up for the game's startup time before its first ore", () => {
    const line = createLine(
      [
        { kind: "machine", recipe: RECIPES.ironOre, startup: 15 },
        { kind: "machine", recipe: RECIPES.ironIngot },
      ],
      [{ from: 0, to: 1, length: 4, item: "ore", tier: "mk1" }],
    );
    run(line, 14.9);
    expect(line.nodes[0].status).toBe("working");
    expect(line.nodes[0].output + line.belts[0].items.length).toBe(0);
    run(line, 1.2);
    expect(line.nodes[0].output + line.belts[0].items.length).toBe(1);
  });
});

describe("factory recipes", () => {
  it("match the game's per-minute rates", () => {
    expect(recipeRate(RECIPES.ironOre)).toBe(60);
    expect(recipeRate(RECIPES.ironIngot)).toBe(30);
    expect(recipeRate(RECIPES.castScrews)).toBe(50);
    expect(recipeRate(RECIPES.upload)).toBe(240);
  });

  it("rejects a belt that carries the wrong item", () => {
    expect(() =>
      createLine(
        [
          { kind: "machine", recipe: RECIPES.ironOre },
          { kind: "machine", recipe: RECIPES.castScrews },
        ],
        [{ from: 0, to: 1, length: 4, item: "ore", tier: "mk1" }],
      ),
    ).toThrow(/cannot take ore/);
  });
});

describe("screw factory simulation", () => {
  it("stays still while unpowered", () => {
    const line = screwFactory();
    stepLine(line, 30);
    expect(line.nodes.every((n) => n.status === "off")).toBe(true);
    expect(line.belts.every((b) => b.items.length === 0)).toBe(true);
    expect(deliveredRate(line)).toBe(0);
  });

  it("uploads about 240 screws a minute once settled", () => {
    // 60 ore → 60 ingots → 4.8 constructors' worth of Cast Screws.
    const line = run(screwFactory(), 900);
    expect(deliveredRate(line)).toBeGreaterThan(225);
    expect(deliveredRate(line)).toBeLessThanOrEqual(241);
  });

  it("shares ingots among all five constructors", () => {
    const line = run(screwFactory(), 900);
    const layout = layoutFactory();
    const makers = layout.buildings
      .map((b, i) => (b.kind === "constructor" ? i : -1))
      .filter((i) => i >= 0);
    const working = makers.map(() => 0);
    const steps = 600;
    for (let s = 0; s < steps; s++) {
      stepLine(line, 0.5);
      makers.forEach((n, k) => {
        if (line.nodes[n].status === "working") working[k]++;
      });
    }
    for (const w of working) expect(w / steps).toBeGreaterThan(0.75);
  });

  it("keeps items at least one spacing apart", () => {
    const line = run(screwFactory(), 300);
    for (const belt of line.belts) {
      for (let i = 1; i < belt.items.length; i++) {
        expect(belt.items[i - 1] - belt.items[i]).toBeGreaterThanOrEqual(
          belt.spacing - 1e-9,
        );
      }
      expect(belt.items.every((t) => t >= 0 && t <= belt.length)).toBe(true);
    }
  });

  it("clamps clock speed to the game's 1% to 250%", () => {
    const line = screwFactory();
    const smelter = line.nodes.findIndex((n) => n.recipe === RECIPES.ironIngot);
    setClock(line, smelter, 9);
    expect(line.nodes[smelter].clock).toBe(2.5);
    setClock(line, smelter, 0);
    expect(line.nodes[smelter].clock).toBe(0.01);
  });
});

describe("screw factory layout", () => {
  const layout = layoutFactory();

  it("starts and ends every belt on its ports", () => {
    SCREW_FACTORY.routes.forEach((route, i) => {
      const belt = layout.belts[i];
      const from = layout.buildings[belt.from];
      const to = layout.buildings[belt.to];
      expect(belt.points[0]).toEqual(portOf(from, route.from[1]));
      expect(belt.points.at(-1)).toEqual(portOf(to, route.to[1]));
      expect(belt.length).toBeGreaterThan(1.5);
    });
  });

  it("bends belts in smooth arcs, never sharp corners", () => {
    for (const belt of layout.belts) {
      for (let i = 2; i < belt.points.length; i++) {
        const [ax, , az] = belt.points[i - 2];
        const [bx, , bz] = belt.points[i - 1];
        const [cx, , cz] = belt.points[i];
        const turn = Math.abs(
          Math.atan2(
            (bx - ax) * (cz - bz) - (bz - az) * (cx - bx),
            (bx - ax) * (cx - bx) + (bz - az) * (cz - bz),
          ),
        );
        expect(turn).toBeLessThan(Math.PI / 12);
      }
    }
  });

  it("rounds a right angle into a quarter circle of the bend radius", () => {
    const arc = roundCorners([
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 10],
    ]);
    const corner = arc.slice(1, -1);
    // Every arc point sits on the circle centred at (8, 2).
    for (const [x, , z] of corner) {
      expect(Math.hypot(x - 8, z - 2)).toBeCloseTo(BELT_BEND);
    }
    expect(corner[0][0]).toBeCloseTo(8);
    expect(corner.at(-1)?.[2]).toBeCloseTo(2);
  });
  it("lays whole foundations under every slab building", () => {
    for (const [x, z] of layout.tiles) {
      expect((x - 4) % 8).toBeCloseTo(0);
      expect((z - 4) % 8).toBeCloseTo(0);
    }
    for (const b of layout.buildings.filter((b) => !b.onNode)) {
      const [x, , z] = b.position;
      expect(
        layout.tiles.some(
          ([tx, tz]) => Math.abs(tx - x) <= 4 && Math.abs(tz - z) <= 4,
        ),
      ).toBe(true);
    }
  });

  it("walks a belt from its first port to its last", () => {
    const belt = layout.belts[1]; // ore round the corner to the first smelter
    const last = belt.points.at(-1) ?? belt.points[0];
    const start = pointOnBelt(belt, belt.lead).position;
    expect(start[0]).toBeCloseTo(belt.points[0][0]);
    expect(start[2]).toBeCloseTo(belt.points[0][2]);
    const end = pointOnBelt(belt, belt.length - belt.tail).position;
    expect(end[0]).toBeCloseTo(last[0]);
    expect(end[2]).toBeCloseTo(last[2]);
    // The bend makes it shorter than the two straight legs (7 + 3 m).
    const spline = belt.length - belt.lead - belt.tail;
    expect(spline).toBeLessThan(10);
    expect(spline).toBeCloseTo(10 - 4 + Math.PI, 1);
  });

  it("opens every port of every building, belts or not", () => {
    const opening = {
      wall: 0,
      rim: 1,
      center: 0,
      halfWidth: 0.9,
      floor: -0.2,
      top: 1.7,
      radiusTop: 0.05,
      radiusBottom: 0.05,
    };
    const { ports, byBelt, byBuilding } = portVolumes(layout, (b) =>
      Object.fromEntries(
        Object.keys(BUILDINGS[b.kind].ports).map((name) => [name, opening]),
      ),
    );
    const all = layout.buildings.reduce(
      (n, b) => n + Object.keys(BUILDINGS[b.kind].ports).length,
      0,
    );
    expect(ports).toHaveLength(all);
    // Splitters open on all four sides, though not every side has a belt.
    const splitter = layout.buildings.findIndex((b) => b.id === "split-0");
    expect(byBuilding[splitter]).toHaveLength(4);
    layout.belts.forEach((belt, i) => {
      const [start, end] = byBelt[i];
      expect(byBuilding[belt.from]).toContain(start);
      expect(byBuilding[belt.to]).toContain(end);
      for (const [port, building] of [
        [ports[start], layout.buildings[belt.from]],
        [ports[end], layout.buildings[belt.to]],
      ] as const) {
        // Each port's outward axis points away from its building's centre.
        const [x, , z] = port.origin;
        const [ox, , oz] = port.outward;
        const out =
          (x - building.position[0]) * ox + (z - building.position[2]) * oz;
        expect(out).toBeGreaterThan(0);
      }
    });
  });

  it("merges the ingots straight into the first splitter", () => {
    const merge = layout.buildings.findIndex((b) => b.id === "ingot-merge");
    const split = layout.buildings.findIndex((b) => b.id === "split-0");
    const belt = layout.belts.find((b) => b.from === merge && b.to === split);
    expect(belt?.points).toHaveLength(2);
    expect(belt?.points[0][2]).toBeCloseTo(belt?.points[1][2] ?? Number.NaN);
  });

  it("brings items out of a splitter's walls, not its opening", () => {
    const belt = layout.belts[1];
    const splitter = layout.buildings[belt.from];
    expect(belt.lead).toBeGreaterThan(0);
    // Item travel starts inside the splitter, nearer its centre than the port.
    const [x, , z] = pointOnBelt(belt, 0).position;
    const [px, , pz] = belt.points[0];
    const [cx, , cz] = splitter.position;
    expect(Math.hypot(x - cx, z - cz)).toBeLessThan(
      Math.hypot(px - cx, pz - cz) - 0.5,
    );
  });

  it("turns items smoothly through a bend", () => {
    const belt = layout.belts[1];
    let previous = pointOnBelt(belt, 0).yaw;
    for (let t = 0.05; t <= belt.length; t += 0.05) {
      const { yaw } = pointOnBelt(belt, t);
      const step = Math.atan2(
        Math.sin(yaw - previous),
        Math.cos(yaw - previous),
      );
      // A 2 m bend turns 1 rad per metre: 0.05 m steps turn about 1.4°.
      expect(Math.abs(step)).toBeLessThan(0.03);
      previous = yaw;
    }
    expect(Math.abs(previous - pointOnBelt(belt, 0).yaw)).toBeCloseTo(
      Math.PI / 2,
    );
  });
});

describe("depot light", () => {
  it("flashes with each upload and goes dark without them", () => {
    const line = screwFactory();
    expect(flashLevel(line)).toBe(0);
    line.time = 10;
    line.arrivals.push(10);
    expect(flashLevel(line)).toBe(0);
    line.time = 10.1;
    const peak = flashLevel(line);
    expect(peak).toBeGreaterThan(0.5);
    line.time = 11;
    expect(flashLevel(line)).toBeLessThan(peak * 0.1);
    line.time = 20;
    expect(flashLevel(line)).toBe(0);
  });

  it("glows out of the uploader's entrance, facing out of it", () => {
    const layout = layoutFactory();
    const depot = layout.buildings.findIndex((b) => b.kind === "depot");
    const opening = {
      wall: 0.2,
      rim: 0.6,
      center: 0,
      halfWidth: 0.7,
      floor: 0,
      top: 1.2,
      radiusTop: 0,
      radiusBottom: 0,
    };
    const lights = lightsOf(layout, (b) =>
      b.kind === "depot" ? { in: opening } : undefined,
    );
    const entrance = lights.find((l) => l.kind === "opening");
    expect(entrance?.building).toBe(depot);
    expect(entrance?.on).toBe("upload");
    const port = portOf(layout.buildings[depot], "in");
    const [nx, , nz] = entrance?.normal ?? [0, 0, 0];
    const [px, , pz] = entrance?.position ?? [0, 0, 0];
    // Out from the port to the back wall, along the normal.
    expect((px - port[0]) * nx + (pz - port[2]) * nz).toBeCloseTo(0.2);
    expect(entrance?.position[1]).toBeCloseTo(port[1] + 0.6);
    expect(lights.find((l) => l.kind === "sphere")?.on).toBe("power");
  });
});
