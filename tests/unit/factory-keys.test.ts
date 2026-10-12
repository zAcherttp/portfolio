import { describe, expect, it } from "vitest";
import { poseOf } from "@/components/figures/factory/animation";
import {
  gather,
  keyFrames,
  offsetRanges,
  packKeys,
} from "@/scripts/factory/keys.mjs";

/** One bone, no rotation, moving through `xs` along x, a frame each. */
function track(xs: number[]) {
  return Float32Array.from(xs.flatMap((x) => [x, 0, 0, 0, 0, 0, 1]));
}

describe("factory clip keys", () => {
  const options = { bones: 1, reach: [0], tolerance: 0.01 };

  it("drops the frames of a steady move", () => {
    const steady = track([0, 1, 2, 3, 4, 5]);
    expect(keyFrames(steady, { ...options, frames: 6 })).toEqual([0, 5]);
  });

  it("keeps the frame where a move turns back", () => {
    const turn = track([0, 1, 2, 3, 2, 1]);
    expect(keyFrames(turn, { ...options, frames: 6 })).toEqual([0, 3, 5]);
  });

  it("weighs a turn by how far the bone's vertices reach", () => {
    const s = Math.sin(0.05);
    const c = Math.cos(0.05);
    // A small wobble about y: 0.1 rad at the middle frame only.
    const wobble = Float32Array.from([
      ...[0, 0, 0, 0, 0, 0, 1],
      ...[0, 0, 0, 0, s, 0, c],
      ...[0, 0, 0, 0, 0, 0, 1],
    ]);
    expect(keyFrames(wobble, { ...options, frames: 3 })).toEqual([0, 2]);
    expect(keyFrames(wobble, { ...options, frames: 3, reach: [1] })).toEqual([
      0, 1, 2,
    ]);
  });

  it("packs columns as 16-bit integers within a fraction of a millimetre", () => {
    const data = gather(track([0, 4.5, -2]), 1, [0, 1, 2]);
    const ranges = offsetRanges([data], 1);
    expect(ranges).toEqual([4.5]);
    const packed = packKeys(data, 1, ranges);
    const back = (i: number) =>
      (packed[i] / 32767) * (i % 7 < 3 ? ranges[0] : 1);
    expect(Math.abs(back(7) - 4.5)).toBeLessThan(1e-4);
    expect(Math.abs(back(14) + 2)).toBeLessThan(1e-4);
    expect(back(6)).toBeCloseTo(1, 4);
  });

  it("blends between uneven keys by time", () => {
    const clips = {
      producing: { start: 10, frames: 3, length: 4, times: [0, 1, 3] },
    };
    expect(poseOf({ clip: "producing", time: 2 }, clips)).toEqual({
      a: 11,
      b: 12,
      mix: 0.5,
    });
    // The loop wraps from the last key back to the first over the last second.
    expect(poseOf({ clip: "producing", time: 3.5 }, clips)).toEqual({
      a: 12,
      b: 10,
      mix: 0.5,
    });
  });
});
