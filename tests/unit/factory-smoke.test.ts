import { describe, expect, it } from "vitest";
import {
  contentPoints,
  layoutFactory,
  smokeOf,
} from "@/components/figures/factory/layout";
import {
  createSmoke,
  puffLook,
  stepSmoke,
} from "@/components/figures/factory/smoke";
import { framePoints, viewBasis } from "@/components/figures/factory/view";

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function run(seconds: number, rate: number, random = seeded()) {
  const source = createSmoke([0, 8, 0]);
  for (let t = 0; t < seconds; t += 0.05) stepSmoke(source, rate, 0.05, random);
  return source;
}

describe("chimney smoke", () => {
  it("puffs once a second while producing, about ten aloft", () => {
    const source = run(30, 1);
    expect(source.puffs.length).toBeGreaterThanOrEqual(9);
    expect(source.puffs.length).toBeLessThanOrEqual(11);
  });

  it("starts small on the socket and swells as it rises and drifts", () => {
    const random = seeded(7);
    const source = createSmoke([0, 8, 0]);
    stepSmoke(source, 1, 1, random);
    const [puff] = source.puffs;
    const born = puffLook(puff);
    // Half the game's 1.2–2 m at birth, grown in over its first fifth.
    expect(born.size).toBeGreaterThan(0.6);
    expect(born.size).toBeLessThan(1);
    expect(born.alpha).toBe(0);
    for (let t = 0; t < 5; t += 0.05) stepSmoke(source, 0, 0.05, random);
    const later = puffLook(puff);
    expect(later.size).toBeGreaterThan(5);
    expect(later.alpha).toBeGreaterThan(0.9);
    expect(puff.position[1]).toBeGreaterThan(9);
    // Carried by the wind, toward the picture's upper left: world −x.
    expect(puff.position[0]).toBeLessThan(-0.5);
  });

  it("stops puffing when production stops and clears within the longest life", () => {
    const random = seeded(3);
    const source = run(20, 1, random);
    expect(source.puffs.length).toBeGreaterThan(0);
    for (let t = 0; t < 10.6; t += 0.05) stepSmoke(source, 0, 0.05, random);
    expect(source.puffs).toHaveLength(0);
  });

  it("rises from each smelter's chimney", () => {
    const layout = layoutFactory();
    const chimneys = smokeOf(layout);
    const smelters = layout.buildings.filter((b) => b.kind === "smelter");
    expect(chimneys).toHaveLength(smelters.length);
    for (const c of chimneys) {
      const b = layout.buildings[c.building];
      expect(b.kind).toBe("smelter");
      expect(c.position[1] - b.position[1]).toBeCloseTo(7.92);
    }
  });

  it("frames the picture tall enough for the plume it shows", () => {
    // Run each chimney's real smoke and find the highest well-seen puff top
    // on screen, against the top of the picture it is framed in.
    const layout = layoutFactory();
    const { up } = viewBasis();
    const screenUp = (p: readonly number[]) =>
      p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
    let plumeTop = -Infinity;
    for (const chimney of smokeOf(layout)) {
      const source = createSmoke(chimney.position);
      const random = seeded(3);
      for (let t = 0; t < 30; t += 0.05) {
        stepSmoke(source, 1, 0.05, random);
        for (const puff of source.puffs) {
          const { size, alpha } = puffLook(puff);
          if (alpha > 0.3) {
            plumeTop = Math.max(plumeTop, screenUp(puff.position) + size * 0.3);
          }
        }
      }
    }
    const frame = framePoints(contentPoints(layout));
    expect(screenUp(frame.center) + frame.height / 2).toBeGreaterThanOrEqual(
      plumeTop,
    );
  });
});
