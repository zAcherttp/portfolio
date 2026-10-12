// The game's baked vertex animation (Satisfactory's MM_FactoryBaked_VAT).
//
// Each animated mesh vertex names a bone (TEXCOORD_2.y) and carries that
// bone's pivot (TEXCOORD_1.xy, TEXCOORD_2.x; metres). A clip is a pair of
// textures, frames across and bones down: the first holds each bone's offset
// (Unreal axes, signs packed in A; see decodeOffset), the second its rotation packed
// as 2·v − 1 with R = w and G, B, A = x, y, z. A posed vertex is
//   pivot + rotate(q, rest − pivot) + offset.

import {
  fromUnrealAxes,
  fromUnrealRotation,
  VAT_OFFSET_METRES_PER_UNIT,
} from "../../components/figures/factory/game.ts";

/** IEEE half to float. */
function half(h) {
  const s = h >> 15;
  const e = (h >> 10) & 31;
  const f = h & 1023;
  const v =
    e === 0
      ? (f / 1024) * 2 ** -14
      : e === 31
        ? f
          ? Number.NaN
          : Number.POSITIVE_INFINITY
        : (1 + f / 1024) * 2 ** (e - 15);
  return s ? -v : v;
}

/** A raw first-mip texture (from the exporter's `rawtex`) as RGBA floats. */
export function decodeTexture(meta, bytes) {
  const texels = meta.width * meta.height;
  const out = new Float32Array(texels * 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (meta.format === "PF_A32B32G32R32F") {
    for (let i = 0; i < texels * 4; i++) out[i] = view.getFloat32(i * 4, true);
  } else if (meta.format === "PF_FloatRGBA") {
    for (let i = 0; i < texels * 4; i++)
      out[i] = half(view.getUint16(i * 2, true));
  } else {
    throw new Error(`Unsupported VAT texture format ${meta.format}.`);
  }
  return out;
}

/** Hamilton product a · b of [x, y, z, w] quaternions. */
export function multiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Turns [x, y, z] by `yaw` about y, the way the blueprint turns a component. */
export function turn([x, y, z], yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, y, -x * s + z * c];
}

/**
 * UE's rotation texel → a glTF-frame quaternion [x, y, z, w]. Unpacked as
 * 2·v − 1, the Unreal quaternion is (−G, B, −A, R): with that, every joint of
 * the constructor's arms stays on its parent through the whole loop.
 */
export function unpackRotation(r, g, b, a) {
  const q = fromUnrealRotation([1 - g * 2, b * 2 - 1, 1 - a * 2, r * 2 - 1]);
  const n = Math.hypot(...q) || 1;
  return q.map((v) => v / n);
}

/**
 * A position texel's offset along Unreal axes, metres. RGB hold magnitudes;
 * A is a 16-bit code, ((100·x + 10·y + z) · 4 + e) · 64 + 63, where each
 * digit is 1 for a negative axis and 2 for a positive one. In 32-bit
 * textures `e` is a shared range: the offset is RGB · (e + 1), keeping RGB
 * below 1. Half-float textures (the smelter's) carry no range there.
 */
export function decodeOffset(r, g, b, a, { ranged }) {
  // Half floats hold the code to about ±8, well inside a step of 64.
  const code = Math.round((a * 65535 - 63) / 64);
  const digits = code >> 2;
  const scale = ranged ? (code & 3) + 1 : 1;
  const sign = (place) =>
    Math.floor(digits / place) % 10 === 1 ? -scale : scale;
  return [r * sign(100), g * sign(10), b * sign(1)];
}

/**
 * One clip in the actor frame: per frame, per bone, offset (metres) and
 * rotation, 7 floats each. `yaw` is the component's turn in the blueprint;
 * `ranged` marks a position texture whose A carries a range (see
 * decodeOffset).
 */
export function convertClip(
  position,
  rotation,
  { frames, bones, yaw, ranged = false },
) {
  const data = new Float32Array(frames * bones * 7);
  const spin = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const unspin = [0, -Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  for (let f = 0; f < frames; f++) {
    for (let bone = 0; bone < bones; bone++) {
      const t = (bone * frames + f) * 4;
      const offset = turn(
        fromUnrealAxes(
          decodeOffset(...position.subarray(t, t + 4), { ranged }),
        ).map((v) => v * VAT_OFFSET_METRES_PER_UNIT),
        yaw,
      );
      const q = multiply(
        multiply(spin, unpackRotation(...rotation.subarray(t, t + 4))),
        unspin,
      );
      data.set([...offset, ...q], (f * bones + bone) * 7);
    }
  }
  return data;
}
