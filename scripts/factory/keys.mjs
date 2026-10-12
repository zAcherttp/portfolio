// Keyframe reduction for baked clips. The shader blends two key columns:
// offsets linearly, rotations by normalised lerp. Keeping only the frames that
// blend cannot stand in for leaves smooth stretches to a few keys and keeps
// every sharp turn: Ramer–Douglas–Peucker over time, with the error measured
// in metres where the vertices are.

const STRIDE = 7;

/** Where a bone stands at frame `f`: offset [0..3) and rotation [3..7). */
function pose(data, bones, f, b) {
  return data.subarray((f * bones + b) * STRIDE, (f * bones + b + 1) * STRIDE);
}

/**
 * How far a bone's farthest vertex strays between the true pose and the blend
 * of two keys `t` of the way from `a` to `b`.
 */
function miss(truth, a, b, t, reach) {
  let offset = 0;
  for (let k = 0; k < 3; k++) {
    offset += (truth[k] - (a[k] + (b[k] - a[k]) * t)) ** 2;
  }
  const flip =
    a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6] < 0 ? -1 : 1;
  const q = [0, 1, 2, 3].map(
    (k) => a[3 + k] + (flip * b[3 + k] - a[3 + k]) * t,
  );
  const n = Math.hypot(...q) || 1;
  const m = Math.hypot(truth[3], truth[4], truth[5], truth[6]) || 1;
  const dot = Math.abs(
    q.reduce((sum, v, k) => sum + (v / n) * (truth[3 + k] / m), 0),
  );
  const angle = 2 * Math.acos(Math.min(1, dot));
  return Math.sqrt(offset) + angle * reach;
}

/**
 * The source frames to keep, in order, so that every dropped frame blends back
 * within `tolerance` metres for every bone. `reach[b]` is the distance from
 * bone b's pivot to its farthest vertex.
 */
export function keyFrames(data, { frames, bones, reach, tolerance }) {
  if (frames <= 2) return Array.from({ length: frames }, (_, f) => f);
  const keep = new Set([0, frames - 1]);
  const spans = [[0, frames - 1]];
  while (spans.length > 0) {
    const [from, to] = spans.pop();
    let worst = 0;
    let at = -1;
    for (let f = from + 1; f < to; f++) {
      const t = (f - from) / (to - from);
      for (let b = 0; b < bones; b++) {
        const error = miss(
          pose(data, bones, f, b),
          pose(data, bones, from, b),
          pose(data, bones, to, b),
          t,
          reach[b] ?? 0,
        );
        if (error > worst) {
          worst = error;
          at = f;
        }
      }
    }
    if (worst > tolerance) {
      keep.add(at);
      spans.push([from, at], [at, to]);
    }
  }
  return [...keep].sort((x, y) => x - y);
}

/** The key frames' columns of a clip, packed the same way. */
export function gather(data, bones, keys) {
  const out = new Float32Array(keys.length * bones * STRIDE);
  keys.forEach((f, k) => {
    out.set(
      data.subarray(f * bones * STRIDE, (f + 1) * bones * STRIDE),
      k * bones * STRIDE,
    );
  });
  return out;
}

const FULL = 32767;

/**
 * Each bone's largest offset across the clips: the scale its offsets are
 * stored against as 16-bit integers.
 */
export function offsetRanges(clips, bones) {
  const ranges = new Array(bones).fill(0);
  for (const data of clips) {
    for (let i = 0; i < data.length; i += STRIDE) {
      const b = (i / STRIDE) % bones;
      for (let k = 0; k < 3; k++) {
        ranges[b] = Math.max(ranges[b], Math.abs(data[i + k]));
      }
    }
  }
  return ranges.map((r) => r || 1);
}

/**
 * A clip's columns as 16-bit integers: offsets against their bone's range,
 * rotation components (unit length) as they are.
 */
export function packKeys(data, bones, ranges) {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const k = i % STRIDE;
    const scale = k < 3 ? ranges[Math.floor(i / STRIDE) % bones] : 1;
    out[i] = Math.round((data[i] / scale) * FULL);
  }
  return out;
}
