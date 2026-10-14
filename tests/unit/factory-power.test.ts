import { describe, expect, it } from "vitest";
import {
  layoutFactory,
  powerOf,
  SAG_PER_METRE,
  wirePoints,
} from "@/components/figures/factory/layout";

describe("factory power", () => {
  const layout = layoutFactory();
  const { poles, wires } = powerOf(layout);
  const same = (a: readonly number[], b: readonly number[]) =>
    a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

  it("feeds one pole, within a Mk1 pole's four links", () => {
    expect(poles).toHaveLength(1);
    const top = wires[0].from;
    const links = wires.filter((w) => same(w.from, top) || same(w.to, top));
    expect(links.length).toBeLessThanOrEqual(4);
    expect(top[1] - poles[0][1]).toBeCloseTo(7);
  });

  it("reaches every powered machine and never the uploader", () => {
    const powered = layout.buildings.filter((b) =>
      ["miner", "smelter", "constructor"].includes(b.kind),
    );
    // The feed, then one wire into each powered machine.
    expect(wires).toHaveLength(1 + powered.length);
    const depot = layout.buildings.find((b) => b.kind === "depot");
    if (!depot) throw new Error("No uploader.");
    for (const w of wires) {
      expect(
        Math.hypot(w.to[0] - depot.position[0], w.to[2] - depot.position[2]),
      ).toBeGreaterThan(3);
    }
  });

  it("runs every wire square to the grid, along x or along z", () => {
    for (const { from, to } of wires) {
      const dx = Math.abs(to[0] - from[0]);
      const dz = Math.abs(to[2] - from[2]);
      expect(Math.min(dx, dz)).toBeLessThan(0.25);
    }
  });

  it("feeds the pole level from behind, fading out along its run", () => {
    const [feed] = wires;
    expect(feed.to[0]).toBe(feed.from[0]);
    expect(feed.to[1]).toBe(feed.from[1]);
    expect(feed.to[2]).toBeLessThan(feed.from[2]);
    expect(feed.fade).toBeGreaterThan(0);
    expect(feed.fade).toBeLessThan(1);
    // Only the feed fades; the machines' wires run whole.
    expect(wires.slice(1).every((w) => w.fade === undefined)).toBe(true);
  });

  it("sags a little at the middle, more on longer spans", () => {
    const wire = { from: [0, 10, 0], to: [20, 10, 0] } as const;
    const points = wirePoints({ from: [...wire.from], to: [...wire.to] }, 2);
    expect(points[1][1]).toBeCloseTo(10 - 20 * SAG_PER_METRE);
    expect(points[0][1]).toBe(10);
    expect(points[2][1]).toBe(10);
  });
});
