// Chimney smoke as the game makes it: NS_SmelterSmoke, spawned at the
// smelter tower's burnerVfxSocket while it produces. One puff a second
// (User.Rate 1, 0 when it stops, the rest living out), each a camera-facing
// ball that swells as it rises, slows in drag and drifts with the wind. The
// numbers come from the emitter's compiled spawn and update scripts; curves
// are their lookup tables, read as straight lines between keys. Units are
// metres and seconds (the game's centimetres over 100).

type Vec3 = [number, number, number];

/** A curve over a puff's normalised age, through (t, value) keys. */
function curve(keys: readonly (readonly [number, number])[]) {
  return (t: number) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Size over life: the per-puff share, and the share every puff keeps. */
const GROW = curve([
  [0, 0.08],
  [0.2, 0.125],
  [0.5, 0.49],
  [0.8, 0.88],
  [1, 0.96],
]);
const SWELL = curve([
  [0, 0.32],
  [0.32, 1],
]);
/** Drift with the wind and lift, as shares of 5.12 and 3.92 m/s². */
const DRIFT = curve([
  [0, -0.16],
  [0.1, 0.32],
  [0.3, 0.66],
  [0.5, 0.96],
]);
const SINK = curve([
  [0, -0.64],
  [0.32, -0.64],
  [0.5, -0.54],
  [0.7, -0.27],
  [1, 0.16],
]);
/** Drag over life, as a share of the 2 /s it adds to 2 /s. */
const THICKEN = curve([
  [0, 0.32],
  [0.64, 0.96],
]);
/** Opacity over life, before the 0.96 it is scaled by. */
const FADE = curve([
  [0, 0],
  [0.05, 0.96],
  [0.2, 1],
  [0.6, 1.03],
  [0.7, 0.85],
  [0.8, 0.51],
  [0.9, 0.16],
  [1, 0],
]);

/** Puffs a second at Rate 1. */
const RATE = 1;
/** Puffs start on a sphere this wide round the socket. */
const JITTER = 0.32;

export interface Puff {
  position: Vec3;
  velocity: Vec3;
  age: number;
  life: number;
  /** Sprite width at full size, metres. */
  base: number;
  /** This puff's share of the growth, 0.75–1.25. */
  spread: number;
}

export interface SmokeSource {
  /** The chimney's socket, in the world. */
  at: Vec3;
  /** Which way the wind carries it, level and of unit length: (x, z). */
  wind: [number, number];
  puffs: Puff[];
  /** Seconds of spawning owed toward the next puff. */
  owed: number;
  /** Whether it was puffing last step. */
  on: boolean;
}

/**
 * The game drifts its smoke along the world's +x; here the wind blows toward
 * the picture's upper left, world −x, unless given.
 */
export function createSmoke(
  at: Readonly<Vec3>,
  wind: [number, number] = [-1, 0],
): SmokeSource {
  return { at: [at[0], at[1], at[2]], wind, puffs: [], owed: 0, on: false };
}

/** Most puffs a source holds at once: a second's worth over the longest life. */
export const MAX_PUFFS = 12;

function spawn(source: SmokeSource, random: () => number): Puff {
  // A uniform direction on the jitter sphere.
  const z = random() * 2 - 1;
  const a = random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z) * JITTER;
  const [x, y, w] = source.at;
  return {
    position: [x + Math.cos(a) * r, y + z * JITTER, w + Math.sin(a) * r],
    velocity: [0, 0, 0],
    age: 0,
    life: 9.5 + random(),
    base: 6.75 + random() * 0.5,
    spread: 0.75 + random() * 0.5,
  };
}

/**
 * Moves a source's smoke on by dt seconds: puffs age, rise and drift, and a
 * new one comes each second while `rate` (the game's User.Rate) is 1.
 */
export function stepSmoke(
  source: SmokeSource,
  rate: number,
  dt: number,
  random: () => number = Math.random,
) {
  for (const puff of source.puffs) {
    const t = Math.min(1, puff.age / puff.life);
    const drift = 5.12 * DRIFT(t);
    const ay = -3.92 * SINK(t);
    const drag = 2 + 2 * THICKEN(t);
    const v = puff.velocity;
    const [wx, wz] = source.wind;
    v[0] = (v[0] + wx * drift * dt) / (1 + drag * dt);
    v[1] = (v[1] + ay * dt) / (1 + drag * dt);
    v[2] = (v[2] + wz * drift * dt) / (1 + drag * dt);
    for (let k = 0; k < 3; k++) puff.position[k] += v[k] * dt;
    puff.age += dt;
  }
  source.puffs = source.puffs.filter((p) => p.age < p.life);
  if (rate <= 0) {
    source.owed = 0;
    source.on = false;
    return;
  }
  // Each time it starts, the first puff comes at once.
  if (!source.on) source.owed = 1;
  source.on = true;
  source.owed += dt * rate * RATE;
  while (source.owed >= 1) {
    source.owed -= 1;
    if (source.puffs.length < MAX_PUFFS)
      source.puffs.push(spawn(source, random));
  }
}

/**
 * Softer than the game at the chimney: a puff starts at half the game's size
 * and fades in over its first fifth, so it leaves the mouth thin rather than
 * as a ball already cut by the tower.
 */
const EMERGE = 0.2;

/** A puff's sprite width (metres) and opacity now. */
export function puffLook(puff: Puff) {
  const t = Math.min(1, puff.age / puff.life);
  const emerge = Math.min(1, t / EMERGE);
  const ease = emerge * emerge * (3 - 2 * emerge);
  return {
    size:
      puff.base * (GROW(t) * puff.spread + 0.5 * SWELL(t)) * (0.5 + 0.5 * ease),
    alpha: 0.96 * FADE(t) * ease,
  };
}
