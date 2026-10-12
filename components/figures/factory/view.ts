// The anatomy camera: orthographic, azimuth 45°, elevation 30°.

import type { Vec3 } from "./layout";

export const AZIMUTH = Math.PI / 4;
export const ELEVATION = Math.PI / 6;

export interface ViewBasis {
  /** Screen right, on the floor plane. */
  right: Vec3;
  /** Screen up. */
  up: Vec3;
  /** From the scene toward the camera. */
  back: Vec3;
}

export function viewBasis(azimuth = AZIMUTH, elevation = ELEVATION): ViewBasis {
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);
  return {
    right: [ca, 0, -sa],
    up: [-se * sa, ce, -se * ca],
    back: [ce * sa, se, ce * ca],
  };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface Framing {
  /** World point at the centre of the picture. */
  center: Vec3;
  /** Picture size in metres. */
  width: number;
  height: number;
}

/** Fits a world-space box in the picture. */
export function frameBox(min: Vec3, max: Vec3, basis = viewBasis()): Framing {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p: Vec3 = [
      i & 1 ? max[0] : min[0],
      i & 2 ? max[1] : min[1],
      i & 4 ? max[2] : min[2],
    ];
    const x = dot(p, basis.right);
    const y = dot(p, basis.up);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const { right: r, up: u } = basis;
  return {
    center: [
      r[0] * cx + u[0] * cy,
      r[1] * cx + u[1] * cy,
      r[2] * cx + u[2] * cy,
    ],
    width: x1 - x0,
    height: y1 - y0,
  };
}

/** Light direction on the floor plane: horizontal, from screen-left. */
export function lightFromLeft(basis = viewBasis()): [number, number] {
  return [-basis.right[0], -basis.right[2]];
}
