// Satisfactory's conventions, and how they map onto the factory scene. Every
// conversion from game data goes through here, so units, axes and facing are
// decided once.
//
// The scene is glTF: metres, y up, right-handed. The game is Unreal: Unreal
// units (centimetres), z up, left-handed. CUE4Parse writes glTF with
// glTF (x, y, z) = Unreal (X, Z, Y): two axes swap, which mirrors space.

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

/** Unreal units per metre. */
export const UNITS_PER_METRE = 100;

/** An Unreal position or direction in our frame, before unit conversion. */
export function fromUnrealAxes([x, y, z]: Vec3): Vec3 {
  return [x, z, y];
}

/** An Unreal position in Unreal units → metres in our frame. */
export function fromUnrealUnits(v: Vec3): Vec3 {
  const [x, y, z] = fromUnrealAxes(v);
  return [x / UNITS_PER_METRE, y / UNITS_PER_METRE, z / UNITS_PER_METRE];
}

/**
 * An Unreal rotation [x, y, z, w] in our frame. The axis swaps like a
 * position; swapping two axes mirrors space, which flips the angle.
 */
export function fromUnrealRotation([x, y, z, w]: Quat): Quat {
  return [-x, -z, -y, w];
}

/**
 * An Unreal yaw (degrees, turning X toward Y) as a turn about our y axis,
 * where positive turns x toward -z.
 */
export function fromUnrealYaw(degrees: number) {
  return (-degrees * Math.PI) / 180;
}

/**
 * Unreal meshes face +X. Items ride a belt facing their direction of travel,
 * so an item turned by `heading` (radians from +z, our belt heading) needs
 * this extra turn to bring its +x along the belt.
 */
export function itemYaw(heading: number) {
  return heading - Math.PI / 2;
}

/**
 * Conveyors (FGBuildableConveyorBase.h and the Build_ConveyorBelt blueprints):
 * items ride ITEM_SPACING = 120 units apart, origin to origin, and belts move
 * at mSpeed units per second; throughput is speed ÷ spacing.
 */
export const CONVEYOR = {
  /** ITEM_SPACING: 1.2 m between item origins. */
  itemSpacing: 120 / UNITS_PER_METRE,
  /** mSpeed by tier, metres per second. */
  speed: {
    mk1: 120 / UNITS_PER_METRE,
    mk3: 540 / UNITS_PER_METRE,
  },
} as const;

/** Items per minute a belt tier carries. */
export function beltRate(tier: keyof typeof CONVEYOR.speed) {
  return (CONVEYOR.speed[tier] / CONVEYOR.itemSpacing) * 60;
}

/**
 * Baked vertex animation (MM_FactoryBaked_VAT): bone offsets are stored in
 * metres along Unreal axes. The material's UpscaleANim does not scale them;
 * reading them as centimetres × UpscaleANim threw the constructor's arms
 * metres out of the machine.
 */
export const VAT_OFFSET_METRES_PER_UNIT = 1;

/**
 * Build_MinerMk1's mExtractStartupTime: seconds a miner spins up after it
 * first gets power before it extracts anything.
 */
export const MINER_STARTUP_SECONDS = 15;
