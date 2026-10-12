// Plays a machine's baked clips by its state: Idle while quiet, Startup into
// a looping Producing while it works, Shutdown back to Idle. Machines with
// only a Producing loop finish the loop they are in and rest on its first
// frame. Pure: the scene only reads the pose.

export interface ClipInfo {
  /** First column of the clip in the animation texture. */
  start: number;
  frames: number;
  /** Seconds. */
  length: number;
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
      if (working) clip = clips.startup ? "startup" : "producing";
      else return { clip, time: 0 };
    } else if (clip === "startup") {
      if (time < (current?.length ?? 0)) break;
      time -= current?.length ?? 0;
      clip = working ? "producing" : clips.shutdown ? "shutdown" : quiet;
    } else if (clip === "producing") {
      const length = current?.length ?? 1;
      if (working) {
        time %= length;
        break;
      }
      if (clips.shutdown) begin("shutdown");
      else if (time >= length) begin(quiet);
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
  const x = (player.time / clip.length) * clip.frames;
  if (loops) {
    const f = Math.floor(x);
    return {
      a: clip.start + (f % clip.frames),
      b: clip.start + ((f + 1) % clip.frames),
      mix: x - f,
    };
  }
  const end = clip.frames - 1;
  const f = Math.min(Math.floor(x), end);
  return {
    a: clip.start + f,
    b: clip.start + Math.min(f + 1, end),
    mix: f >= end ? 0 : x - f,
  };
}
