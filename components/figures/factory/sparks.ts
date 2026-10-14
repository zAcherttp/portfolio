// Weld sparks as the game makes them: the constructor's producing loop
// carries two FGAnimatedVFXNotify windows, one per welder arm, that play
// NS_WeldSparks_01 along a keyed path. LWSparks spawns 120 a second plus a
// burst of 50 as each window opens; each spark lives 0.2–0.5 s, leaves at
// 3–7 m/s inside a 90° cone about the path's up and falls under gravity,
// drawn as a velocity-aligned streak that shortens as it cools. The game
// whitens only its first eighth; ours cools over its whole life, white
// through yellow and orange to red, to read hotter. Units are metres and seconds in our
// frame (the game's centimetres over 100, its z up as our y).

type Vec3 = [number, number, number];
type Keys = readonly (readonly [number, number])[];

interface Weld {
  /** Seconds into the producing loop the window opens and closes. */
  start: number;
  end: number;
  /** The path in the actor frame, Unreal centimetres by loop time. */
  x: Keys;
  y: Keys;
  z: Keys;
}

/** Build_ConstructorMk1's two weld notifies (FGAnimatedVFXNotify_7 and _6). */
export const CONSTRUCTOR_WELDS: readonly Weld[] = [
  {
    start: 2.3393,
    end: 3.5695,
    x: [
      [2.339, -40.2],
      [2.455, -36.9],
      [2.57, -36.7],
      [2.608, -34.1],
      [2.647, -28],
      [2.685, -19.2],
      [2.878, 35.9],
      [2.916, 45.3],
      [2.954, 53.4],
      [2.993, 60.2],
      [3.031, 61.4],
      [3.493, 61.4],
      [3.569, 57.5],
    ],
    y: [
      [2.339, -31.9],
      [3.108, -31.9],
      [3.147, -30.3],
      [3.185, -21.7],
      [3.223, -6],
      [3.3, 34.2],
      [3.339, 51.2],
      [3.377, 61.7],
      [3.416, 64.5],
      [3.493, 64.5],
      [3.569, 68.4],
    ],
    z: [
      [2.339, 125.2],
      [2.378, 122.8],
      [2.416, 118.9],
      [2.455, 117.2],
      [2.57, 117.2],
      [2.608, 116.3],
      [2.762, 107.7],
      [2.839, 105.7],
      [2.916, 106.1],
      [2.993, 108.9],
      [3.493, 109.2],
      [3.531, 110.8],
      [3.569, 114.1],
    ],
  },
  {
    start: 2.3522,
    end: 3.5824,
    x: [
      [2.352, 42.1],
      [2.391, 42.7],
      [2.468, 38.1],
      [2.583, 38.1],
      [2.621, 37.1],
      [2.66, 32.9],
      [2.698, 25.4],
      [2.737, 15.4],
      [2.89, -30.3],
      [2.929, -40.6],
      [2.967, -49.5],
      [3.006, -57],
      [3.044, -61.7],
      [3.582, -61.3],
    ],
    y: [
      [2.352, 37.9],
      [3.16, 37.9],
      [3.198, 33.7],
      [3.236, 20.2],
      [3.275, 0.5],
      [3.313, -21.4],
      [3.352, -41.9],
      [3.39, -57.6],
      [3.429, -64.9],
      [3.505, -65.5],
      [3.544, -64],
      [3.582, -54.2],
    ],
    z: [
      [2.352, 132.1],
      [2.391, 128.3],
      [2.468, 117.1],
      [2.621, 116.7],
      [2.814, 106.9],
      [2.89, 105.3],
      [2.967, 106.4],
      [3.044, 109.2],
      [3.582, 109.5],
    ],
  },
];

function along(keys: Keys, t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Where a weld is at loop time t, in the building's own frame (metres):
 * the path, with the emitter's own 20 cm drop.
 */
export function weldAt(weld: Weld, t: number): Vec3 {
  const x = along(weld.x, t);
  const y = along(weld.y, t);
  const z = along(weld.z, t) - 20;
  return [x / 100, z / 100, y / 100];
}

export interface Spark {
  position: Vec3;
  velocity: Vec3;
  age: number;
  life: number;
}

/** Sparks a second while a weld burns, and the burst it opens with. */
const RATE = 120;
const BURST = 50;
const GRAVITY = 9.8;
/** The cone's half angle about up, radians. */
const CONE = Math.PI / 4;

export interface Welder {
  sparks: Spark[];
  /** Spawning owed toward the next spark, per weld. */
  owed: number[];
  /** Whether each weld burned last step. */
  burning: boolean[];
}

export function createWelder(welds = CONSTRUCTOR_WELDS): Welder {
  return {
    sparks: [],
    owed: welds.map(() => 0),
    burning: welds.map(() => false),
  };
}

function spark(at: Readonly<Vec3>, random: () => number): Spark {
  // A direction in the cone about up; speed falls a little off its axis.
  const tilt = Math.acos(1 - random() * (1 - Math.cos(CONE)));
  const turn = random() * Math.PI * 2;
  const speed = (3 + random() * 4) * (1 - 0.4 * (tilt / CONE) ** 2);
  const s = Math.sin(tilt);
  return {
    position: [at[0], at[1], at[2]],
    velocity: [
      Math.cos(turn) * s * speed,
      Math.cos(tilt) * speed,
      Math.sin(turn) * s * speed,
    ],
    age: 0,
    life: 0.2 + random() * 0.3,
  };
}

/**
 * Moves a welder's sparks on by dt seconds. `loop` is the producing loop's
 * time now, or null while it is not producing; `place` takes a point in the
 * building's frame to the world.
 */
export function stepWelder(
  welder: Welder,
  loop: number | null,
  dt: number,
  place: (local: Vec3) => Readonly<Vec3>,
  welds = CONSTRUCTOR_WELDS,
  random: () => number = Math.random,
) {
  for (const s of welder.sparks) {
    s.velocity[1] -= GRAVITY * dt;
    for (let k = 0; k < 3; k++) s.position[k] += s.velocity[k] * dt;
    s.age += dt;
  }
  welder.sparks = welder.sparks.filter((s) => s.age < s.life);
  welds.forEach((weld, w) => {
    const burning = loop !== null && loop >= weld.start && loop < weld.end;
    if (!burning) {
      welder.burning[w] = false;
      welder.owed[w] = 0;
      return;
    }
    const at = place(weldAt(weld, loop));
    let count = 0;
    if (!welder.burning[w]) count += BURST;
    welder.burning[w] = true;
    welder.owed[w] += dt * RATE;
    count += Math.floor(welder.owed[w]);
    welder.owed[w] -= Math.floor(welder.owed[w]);
    for (let i = 0; i < count; i++) welder.sparks.push(spark(at, random));
  });
}

/** Most sparks one welder holds: two bursts and half a second of both welds. */
export const MAX_SPARKS = 2 * BURST + 2 * RATE * 0.5;

/** How hot a spark still is, 1 white to 0 red, and its streak length scale. */
export function sparkLook(spark: Spark) {
  const t = Math.min(1, spark.age / spark.life);
  const heat = 1 - t;
  // LWSparks' length scale eases from 20 to 1 over its life.
  const ease = 1 - (1 - t) * (1 - t);
  return { heat, stretch: 20 - 19 * ease };
}
