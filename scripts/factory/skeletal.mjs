// The game's skeletal animation, baked into the same per-bone clips as its
// vertex animation (see vat.mjs), so one shader poses both.
//
// CUE4Parse writes clips as ActorX .psa: bone names, parents and the reference
// pose, then one key per bone per frame, local to the parent, in Unreal units.
// It mirrors the keys on the way out (Y of position and rotation negated, the
// root's W too) but not the reference pose; readPsa undoes the mirror.

import {
  fromUnrealRotation,
  fromUnrealUnits,
} from "../../components/figures/factory/game.ts";
import { multiply, turn } from "./vat.mjs";

const HEADER = 32;

function text(bytes, at, length) {
  const end = bytes.indexOf(0, at);
  return bytes.toString(
    "latin1",
    at,
    end < 0 || end > at + length ? at + length : end,
  );
}

/** An ActorX .psa as Unreal-space bones and per-frame local keys. */
export function readPsa(bytes) {
  const out = { bones: [], frames: 0, rate: 30, keys: new Float32Array(0) };
  let at = 0;
  while (at + HEADER <= bytes.length) {
    const id = text(bytes, at, 20);
    const size = bytes.readInt32LE(at + 24);
    const count = bytes.readInt32LE(at + 28);
    at += HEADER;
    if (id === "BONENAMES") {
      for (let i = 0; i < count; i++) {
        const p = at + i * size;
        out.bones.push({
          name: text(bytes, p, 64),
          parent: bytes.readInt32LE(p + 72),
          rotation: [0, 1, 2, 3].map((k) => bytes.readFloatLE(p + 76 + k * 4)),
          position: [0, 1, 2].map((k) => bytes.readFloatLE(p + 92 + k * 4)),
        });
      }
    } else if (id === "ANIMINFO") {
      out.rate = bytes.readFloatLE(at + 152);
      out.frames = bytes.readInt32LE(at + 164);
    } else if (id === "ANIMKEYS") {
      const bones = out.bones.length;
      out.keys = new Float32Array(count * 7);
      for (let i = 0; i < count; i++) {
        const p = at + i * size;
        const v = Array.from({ length: 7 }, (_, k) =>
          bytes.readFloatLE(p + k * 4),
        );
        // Undo the mirror: position Y, rotation Y, and the root's W.
        v[1] = -v[1];
        v[4] = -v[4];
        if (i % bones === 0) v[6] = -v[6];
        out.keys.set(v, i * 7);
      }
    }
    at += size * count;
  }
  if (out.keys.length === 0) throw new Error("No ANIMKEYS in the clip.");
  return out;
}

const conjugate = ([x, y, z, w]) => [-x, -y, -z, w];

function rotate(q, v) {
  return multiply(multiply(q, [...v, 0]), conjugate(q)).slice(0, 3);
}

/** World transforms of every bone from local ones, parents first. */
function compose(bones, local) {
  const world = [];
  bones.forEach((bone, b) => {
    const { rotation, position } = local(b);
    const parent = world[bone.parent];
    if (bone.parent < 0 || !parent) {
      world.push({ rotation, position });
      return;
    }
    const moved = rotate(parent.rotation, position);
    world.push({
      rotation: multiply(parent.rotation, rotation),
      position: moved.map((v, i) => v + parent.position[i]),
    });
  });
  return world;
}

/** Bones at or below `name`, by index. */
export function subtree(bones, name) {
  const inside = new Set();
  bones.forEach((bone, b) => {
    if (bone.name === name || inside.has(bone.parent)) inside.add(b);
  });
  return inside;
}

/**
 * Clips baked per bone in the actor frame, as convertClip lays them out:
 * per frame, per bone, offset (metres) then rotation, about each bone's
 * reference position. `use` lists the bones to keep, by name; `step` keeps
 * every nth frame of a long clip.
 *
 * @param {ReturnType<typeof readPsa>} psa
 * @param {{ use: string[], yaw?: number, step?: number, first?: number, last?: number }} options
 */
export function bakeSkeletal(psa, { use, yaw = 0, step = 1, first, last }) {
  const index = use.map((name) => {
    const b = psa.bones.findIndex((bone) => bone.name === name);
    if (b < 0) throw new Error(`No bone ${name} in the clip.`);
    return b;
  });
  const rest = compose(psa.bones, (b) => psa.bones[b]);
  const spin = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const unspin = conjugate(spin);
  const start = first ?? 0;
  const end = last ?? psa.frames - 1;
  const frames = [];
  for (let f = start; f <= end; f += step) frames.push(f);
  const data = new Float32Array(frames.length * index.length * 7);
  frames.forEach((f, k) => {
    const pose = compose(psa.bones, (b) => {
      const v = psa.keys.subarray((f * psa.bones.length + b) * 7);
      return {
        position: [v[0], v[1], v[2]],
        rotation: [v[3], v[4], v[5], v[6]],
      };
    });
    index.forEach((b, j) => {
      // Posed = turn about the rest position, then move: R (p − rest) + now.
      const turnBy = multiply(pose[b].rotation, conjugate(rest[b].rotation));
      const move = pose[b].position.map((v, i) => v - rest[b].position[i]);
      const offset = turn(fromUnrealUnits(move), yaw);
      const raw = multiply(multiply(spin, fromUnrealRotation(turnBy)), unspin);
      // The game's keys are not quite unit length; the shader expects unit.
      const length = Math.hypot(...raw) || 1;
      const q = raw.map((v) => v / length);
      data.set([...offset, ...q], (k * index.length + j) * 7);
    });
  });
  const pivots = index.map((b) => turn(fromUnrealUnits(rest[b].position), yaw));
  return { frames: frames.length, data, pivots };
}
