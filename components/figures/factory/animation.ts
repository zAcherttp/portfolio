// Plays a machine's baked clips by its state: Idle while quiet, Startup into
// a looping Producing while it works, Shutdown back to Idle. Machines without
// a Shutdown finish the loop they are in and rest on its first frame, then
// pick the loop straight back up, as the game's miner resumes from Suspended.
// A layer clip, like the miner's Reload, plays over some bones on a timer of
// its own. Pure: the scene only reads the poses.

export interface ClipInfo {
  /** First column of the clip in the animation texture. */
  start: number;
  /** Columns: the clip's kept key frames. */
  frames: number;
  /** Seconds. */
  length: number;
  /**
   * Seconds at which each column sits, rising from 0, when the keys are not
   * evenly spaced. A loop wraps from the last key back to the first at
   * `length`.
   */
  times?: readonly number[];
}

export type Clips = Record<string, ClipInfo>;

export interface Player {
  /** Clip name, or "rest" for the first frame of Producing. */
  clip: string;
  time: number;
}

export interface Pose {
  /** Animation texture columns to blend between. */
  a: number;
  b: number;
  mix: number;
}

export function startPlayer(clips: Clips): Player {
  return { clip: clips.idle ? "idle" : "rest", time: 0 };
}

/** Advances a player by `dt` seconds towards working or not. */
export function stepPlayer(
  player: Player,
  working: boolean,
  clips: Clips,
  dt: number,
): Player {
  let { clip, time } = player;
  time += dt;
  const quiet = clips.idle ? "idle" : "rest";
  const begin = (name: string) => {
    clip = name;
    time = 0;
  };
  // A few steps at most: each branch either holds or moves to the next clip.
  for (let guard = 0; guard < 4; guard++) {
    const current = clips[clip];
    if (clip === "idle" || clip === "rest") {
      // Leaving the pose keeps the time already spent in this step.
      if (working) {
        clip = clip === "idle" && clips.startup ? "startup" : "producing";
      } else return { clip, time: 0 };
    } else if (clip === "startup") {
      if (time < (current?.length ?? 0)) break;
      time -= current?.length ?? 0;
      clip = working ? "producing" : clips.shutdown ? "shutdown" : "rest";
    } else if (clip === "producing") {
      const length = current?.length ?? 1;
      if (working) {
        time %= length;
        break;
      }
      if (clips.shutdown) begin("shutdown");
      else if (time >= length) begin("rest");
      else break;
    } else if (clip === "shutdown") {
      if (time < (current?.length ?? 0)) break;
      time -= current?.length ?? 0;
      clip = working ? (clips.startup ? "startup" : "producing") : quiet;
    } else {
      begin(quiet);
    }
  }
  return { clip, time };
}

/** Texture columns and blend for the player's moment. */
export function poseOf(player: Player, clips: Clips): Pose {
  const name = player.clip === "rest" ? "producing" : player.clip;
  const clip = clips[name];
  if (!clip) return { a: 0, b: 0, mix: 0 };
  if (player.clip === "rest" || clip.frames <= 1) {
    return { a: clip.start, b: clip.start, mix: 0 };
  }
  const loops = name === "producing";
  const n = clip.frames;
  const at = (k: number) => clip.times?.[k] ?? (k * clip.length) / n;
  let t = loops
    ? ((player.time % clip.length) + clip.length) % clip.length
    : player.time;
  const last = n - 1;
  if (t >= at(last)) {
    if (!loops) return { a: clip.start + last, b: clip.start + last, mix: 0 };
    const span = clip.length - at(last);
    return {
      a: clip.start + last,
      b: clip.start,
      mix: span > 0 ? Math.min(1, (t - at(last)) / span) : 0,
    };
  }
  t = Math.max(0, t);
  // The last key at or before t.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at(mid) <= t) lo = mid;
    else hi = mid;
  }
  const span = at(lo + 1) - at(lo);
  return {
    a: clip.start + lo,
    b: clip.start + lo + 1,
    mix: span > 0 ? (t - at(lo)) / span : 0,
  };
}

/** BPA_MinerMk1's mReloadTimer: seconds between chances to reload. */
export const RELOAD_PERIOD = 30;

export interface Layer {
  /** Seconds into the current timer period. */
  timer: number;
  /** The timer fired while the machine worked; the clip starts next. */
  ready: boolean;
  /** Seconds into the layer clip, or null while it rests on its first frame. */
  time: number | null;
}

export function startLayer(): Layer {
  return { timer: 0, ready: false, time: null };
}

/**
 * Advances a layer: a looping timer marks it ready if the machine is working
 * when it fires, and a ready layer plays its clip once through.
 */
export function stepLayer(
  layer: Layer,
  working: boolean,
  clip: ClipInfo,
  dt: number,
  period = RELOAD_PERIOD,
): Layer {
  let { timer, ready, time } = layer;
  timer += dt;
  while (timer >= period) {
    timer -= period;
    if (working) ready = true;
  }
  if (time !== null) {
    time += dt;
    if (time >= clip.length) time = null;
  } else if (ready) {
    // Entering the clip clears the flag, as MinerEnteredReloadState does.
    time = 0;
    ready = false;
  }
  return { timer, ready, time };
}

/** Texture columns and blend for a layer's moment. */
export function layerPose(layer: Layer, name: string, clips: Clips): Pose {
  if (layer.time === null) {
    const start = clips[name]?.start ?? 0;
    return { a: start, b: start, mix: 0 };
  }
  return poseOf({ clip: name, time: layer.time }, clips);
}
