import { describe, expect, it } from "vitest";
import { measureOpening } from "@/scripts/factory/openings.mjs";

/** Quads as two triangles each, appended to shared buffers. */
function mesh(quads: number[][][]) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const quad of quads) {
    const o = positions.length / 3;
    positions.push(...quad.flat());
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return { positions: Float32Array.from(positions), indices };
}

describe("factory port openings", () => {
  // A tunnel opening out along +z from a port at z = 2, 1 m above the floor:
  // back wall at z = 1.5, walls at x = ±1, roof 1.8 m above the port, floor
  // 0.2 m below it, running out to a rim at z = 3.
  const tunnel = mesh([
    [
      [-1, 0.8, 1.5],
      [1, 0.8, 1.5],
      [1, 2.8, 1.5],
      [-1, 2.8, 1.5],
    ],
    [
      [1, 0.8, 1.5],
      [1, 0.8, 3],
      [1, 2.8, 3],
      [1, 2.8, 1.5],
    ],
    [
      [-1, 0.8, 1.5],
      [-1, 0.8, 3],
      [-1, 2.8, 3],
      [-1, 2.8, 1.5],
    ],
    [
      [-1, 2.8, 1.5],
      [1, 2.8, 1.5],
      [1, 2.8, 3],
      [-1, 2.8, 3],
    ],
    [
      [-1, 0.8, 1.5],
      [1, 0.8, 1.5],
      [1, 0.8, 3],
      [-1, 0.8, 3],
    ],
  ]);

  it("finds the back wall, walls, roof, floor and rim", () => {
    const o = measureOpening(tunnel.positions, tunnel.indices, [0, 1, 2]);
    expect(o.wall).toBeCloseTo(-0.5, 2);
    expect(o.rim).toBeGreaterThan(0.9);
    expect(o.rim).toBeLessThanOrEqual(1 + 1e-9);
    expect(o.center).toBeCloseTo(0, 2);
    expect(o.halfWidth).toBeCloseTo(1, 2);
    expect(o.top).toBeCloseTo(1.8, 2);
    expect(o.floor).toBeCloseTo(-0.2, 2);
  });
});
