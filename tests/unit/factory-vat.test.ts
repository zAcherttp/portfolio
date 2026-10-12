import { describe, expect, it } from "vitest";
import {
  convertClip,
  decodeOffset,
  decodeTexture,
  multiply,
  turn,
  unpackRotation,
} from "@/scripts/factory/vat.mjs";

/** Rotates [x, y, z] by quaternion [x, y, z, w]. */
function rotate(q: number[], v: number[]) {
  const p = multiply(multiply(q, [...v, 0]), [-q[0], -q[1], -q[2], q[3]]);
  return p.slice(0, 3);
}

describe("factory vertex animation", () => {
  it("reads packed identity as no rotation", () => {
    const q = unpackRotation(1, 0.5, 0.5, 0.5);
    [0, 0, 0, 1].forEach((v, i) => {
      expect(q[i]).toBeCloseTo(v);
    });
  });

  it("maps a turn about UE's up axis to a mirrored turn about glTF's", () => {
    // 90° about UE Z (up): w = x component cos/sin 45°, packed.
    const s = Math.SQRT1_2;
    const q = unpackRotation(s * 0.5 + 0.5, 0.5, 0.5, s * 0.5 + 0.5);
    // UE X (forward) → UE Y under that turn; in glTF, x → z, but mirrored → -z.
    const v = rotate(q, [1, 0, 0]);
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(0);
    // The texture stores Z negated: this texel turns UE X to −Y, glTF −z.
    expect(v[2]).toBeCloseTo(-1);
  });

  it("decodes half floats and 32-bit floats", () => {
    const halfBytes = new Uint8Array(8);
    const view = new DataView(halfBytes.buffer);
    [0x3c00, 0x3800, 0xb800, 0x0000].forEach((h, i) => {
      view.setUint16(i * 2, h, true);
    });
    expect([
      ...decodeTexture(
        { width: 1, height: 1, format: "PF_FloatRGBA" },
        halfBytes,
      ),
    ]).toEqual([1, 0.5, -0.5, 0]);
    const floats = new Uint8Array(new Float32Array([0.25, 2, -3, 4]).buffer);
    expect([
      ...decodeTexture(
        { width: 1, height: 1, format: "PF_A32B32G32R32F" },
        floats,
      ),
    ]).toEqual([0.25, 2, -3, 4]);
  });

  it("reads signs and range from the packed alpha", () => {
    const code = (digits: number, range: number) =>
      ((digits * 4 + range) * 64 + 63) / 65535;
    // X negative, Y positive, Z negative; range 1 doubles the magnitudes.
    const ranged = decodeOffset(0.5, 0.25, 0.75, code(121, 1), {
      ranged: true,
    });
    expect(ranged).toEqual([-1, 0.5, -1.5]);
    // Half-float textures keep magnitudes as stored, even rounded.
    const half = decodeOffset(0.5, 0.25, 0.75, code(212, 2) + 0.0001, {
      ranged: false,
    });
    expect(half).toEqual([0.5, -0.25, 0.75]);
  });

  it("turns offsets and rotations with the component", () => {
    // One frame, one bone: offset 1 m along UE X.
    const position = Float32Array.from([1, 0, 0, 0]);
    const rotation = Float32Array.from([1, 0.5, 0.5, 0.5]);
    const clip = convertClip(position, rotation, {
      frames: 1,
      bones: 1,
      yaw: Math.PI,
    });
    // Half a turn sends +x to -x.
    expect(clip[0]).toBeCloseTo(-1);
    expect(clip[1]).toBeCloseTo(0);
    expect(clip[2]).toBeCloseTo(0);
    // Identity stays identity.
    expect(Math.abs(clip[6])).toBeCloseTo(1);
    expect(turn([1, 0, 0], Math.PI / 2)[2]).toBeCloseTo(-1);
  });
});
