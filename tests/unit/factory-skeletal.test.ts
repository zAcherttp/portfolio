import { describe, expect, it } from "vitest";
import { bakeSkeletal, readPsa, subtree } from "@/scripts/factory/skeletal.mjs";

type Key = { position: number[]; rotation: number[] };

function chunk(id: string, size: number, rows: Buffer[]) {
  const header = Buffer.alloc(32);
  header.write(id, 0, "latin1");
  header.writeInt32LE(size, 24);
  header.writeInt32LE(rows.length, 28);
  return Buffer.concat([header, ...rows]);
}

/** A tiny .psa as CUE4Parse writes it: keys mirrored, reference pose not. */
function psa(
  bones: { name: string; parent: number; position: number[] }[],
  frames: Key[][],
) {
  const names = bones.map((bone) => {
    const row = Buffer.alloc(120);
    row.write(bone.name, 0, "latin1");
    row.writeInt32LE(bone.parent, 72);
    [0, 0, 0, 1].forEach((v, k) => {
      row.writeFloatLE(v, 76 + k * 4);
    });
    bone.position.forEach((v, k) => {
      row.writeFloatLE(v, 92 + k * 4);
    });
    return row;
  });
  const info = Buffer.alloc(168);
  info.writeFloatLE(30, 152);
  info.writeInt32LE(frames.length, 164);
  const keys = frames.flatMap((frame) =>
    frame.map(({ position, rotation }, b) => {
      const row = Buffer.alloc(32);
      const mirrored = [
        position[0],
        -position[1],
        position[2],
        rotation[0],
        -rotation[1],
        rotation[2],
        b === 0 ? -rotation[3] : rotation[3],
      ];
      mirrored.forEach((v, k) => {
        row.writeFloatLE(v, k * 4);
      });
      return row;
    }),
  );
  return Buffer.concat([
    chunk("ANIMHEAD", 0, []),
    chunk("BONENAMES", 120, names),
    chunk("ANIMINFO", 168, [info]),
    chunk("ANIMKEYS", 32, keys),
  ]);
}

describe("factory skeletal clips", () => {
  const s = Math.SQRT1_2;
  const bones = [
    { name: "root", parent: -1, position: [0, 0, 0] },
    { name: "arm", parent: 0, position: [100, 0, 0] },
  ];
  const rest: Key[] = [
    { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    { position: [100, 0, 0], rotation: [0, 0, 0, 1] },
  ];
  // The root turns 90° about Unreal's up axis and carries the arm round.
  const turned: Key[] = [{ ...rest[0], rotation: [0, 0, s, s] }, rest[1]];
  const clip = readPsa(psa(bones, [rest, turned]));

  it("undoes the mirror CUE4Parse writes into the keys", () => {
    expect(clip.frames).toBe(2);
    expect([...clip.keys.subarray(14, 21)].map((v) => +v.toFixed(4))).toEqual([
      0,
      0,
      0,
      0,
      0,
      +s.toFixed(4),
      +s.toFixed(4),
    ]);
  });

  it("moves a child with its parent, in metres and glTF axes", () => {
    const baked = bakeSkeletal(clip, { use: ["arm"] });
    expect(baked.pivots[0]).toEqual([1, 0, 0]);
    expect([...baked.data.subarray(0, 3)]).toEqual([0, 0, 0]);
    // UE (100, 0, 0) cm turns to (0, 100, 0): glTF (0, 0, 1) m, an offset of
    // (−1, 0, 1) from the rest position.
    const [x, y, z] = baked.data.subarray(7, 10);
    expect(x).toBeCloseTo(-1);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
  });

  it("finds a bone's subtree for a layer clip", () => {
    expect([...subtree(clip.bones, "arm")]).toEqual([1]);
    expect([...subtree(clip.bones, "root")]).toEqual([0, 1]);
  });
});
