/**
 * Adaptive supersampling while the line runs. A smoothed frame time steps
 * the cap down when frames run long for a while, and tries it back up after
 * a long smooth stretch; a level that runs long again soon after being tried
 * is not tried again, so the picture doesn't flicker between two.
 */

/** Frames longer than this, smoothed, count as slow: under ~52 fps. */
export const SLOW_FRAME = 1 / 52;
/** Shorter than this count as smooth. */
export const FAST_FRAME = 1 / 58;
/** Seconds of slow frames before stepping down. */
export const SLOW_FOR = 1;
/** Seconds of smooth frames before trying a step up. */
export const FAST_FOR = 10;
/** A step up that runs slow within this many seconds was too much. */
export const TRIAL = 4;
/** A frame this long is a hitch (a tab switch, a GC), not the frame rate. */
export const HITCH = 0.25;

export interface Governor {
  /** The supersampling the frame may use. */
  cap: number;
  /** The most it will try again. */
  ceiling: number;
  ema: number;
  slow: number;
  fast: number;
  /** Seconds since the last step up, while it is on trial. */
  trial: number | null;
}

export function createGovernor(max: number): Governor {
  return {
    cap: max,
    ceiling: max,
    ema: 1 / 60,
    slow: 0,
    fast: 0,
    trial: null,
  };
}

/** Count one frame of `delta` seconds; returns whether the cap changed. */
export function govern(g: Governor, delta: number): boolean {
  if (delta > HITCH) return false;
  g.ema = g.ema * 0.9 + delta * 0.1;
  if (g.trial !== null) {
    g.trial += delta;
    if (g.trial > TRIAL) g.trial = null;
  }
  if (g.ema > SLOW_FRAME) {
    g.slow += delta;
    g.fast = 0;
    if (g.slow > SLOW_FOR && g.cap > 1) {
      // The level just tried was too much: stay under it from now on.
      if (g.trial !== null) g.ceiling = g.cap - 1;
      g.cap -= 1;
      g.slow = 0;
      g.trial = null;
      return true;
    }
  } else if (g.ema < FAST_FRAME) {
    g.fast += delta;
    g.slow = 0;
    if (g.fast > FAST_FOR && g.cap < g.ceiling) {
      g.cap += 1;
      g.fast = 0;
      g.trial = 0;
      return true;
    }
  }
  return false;
}
