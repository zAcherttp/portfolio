import { describe, expect, it } from "vitest";
import {
  BELT_BEND,
  layoutFactory,
  lineSpec,
  pointOnBelt,
  portOf,
  roundCorners,
  SCREW_FACTORY,
} from "@/components/figures/factory/layout";
import {
  createLine,
  deliveredRate,
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
    expect(pointOnBelt(belt, 0).position[0]).toBeCloseTo(belt.points[0][0]);
    const end = pointOnBelt(belt, belt.length).position;
    expect(end[0]).toBeCloseTo(last[0]);
    expect(end[2]).toBeCloseTo(last[2]);
    // The bend makes it shorter than the two straight legs (7 + 4 m).
    expect(belt.length).toBeLessThan(11);
    expect(belt.length).toBeCloseTo(11 - 4 + Math.PI, 1);
  });
});
