import { describe, expect, it } from "vitest";
import {
  CONSTRUCTOR_WELDS,
  createWelder,
  sparkLook,
  stepWelder,
  weldAt,
} from "@/components/figures/factory/sparks";

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const here = (p: [number, number, number]) => p;

describe("weld sparks", () => {
  it("follows each arm's path, about a metre up, in metres", () => {
    const [left, right] = CONSTRUCTOR_WELDS;
    const [x, y, z] = weldAt(left, left.start);
    // Unreal (-40.2, -31.9, 125.2) cm, less the emitter's 20 cm drop.
    expect(x).toBeCloseTo(-0.402);
    expect(y).toBeCloseTo(1.052);
    expect(z).toBeCloseTo(-0.319);
    expect(weldAt(right, right.end)[0]).toBeCloseTo(-0.613);
  });

  it("bursts as a weld opens, sprays while it burns, stops outside it", () => {
    const welder = createWelder();
    const random = seeded();
    stepWelder(welder, 1, 0.1, here, CONSTRUCTOR_WELDS, random);
    expect(welder.sparks).toHaveLength(0);
    const [weld] = CONSTRUCTOR_WELDS;
    stepWelder(welder, weld.start + 0.001, 0.1, here, [weld], random);
    // The opening burst of 50 and a tenth of a second at 120 a second.
    expect(welder.sparks).toHaveLength(62);
    for (let t = 0; t < 1; t += 0.05) {
      stepWelder(welder, null, 0.05, here, [weld], random);
    }
    expect(welder.sparks).toHaveLength(0);
  });

  it("flies up and out, falls, and cools from white toward red", () => {
    const welder = createWelder();
    const [weld] = CONSTRUCTOR_WELDS;
    stepWelder(welder, weld.start, 0.01, here, [weld], seeded(5));
    const s = welder.sparks[0];
    expect(s.velocity[1]).toBeGreaterThan(0);
    expect(sparkLook(s).heat).toBe(1);
    const rising = s.velocity[1];
    stepWelder(welder, null, 0.1, here, [weld]);
    expect(s.velocity[1]).toBeCloseTo(rising - 0.98);
    expect(sparkLook(s).heat).toBeLessThan(1);
  });
});
