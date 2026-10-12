// Measures the opening round each of a building's ports by casting rays at
// its mesh, in the model's frame: straight in from outside to find the flat
// back wall, then sideways, up and down from just in front of it for the
// walls, roof and floor, then outward until the walls stop for the rim.
//
// Distances run along the port's outward axis from the port itself: `wall`
// and `rim` are where the back wall and the rim stand, `center` is how far
// the opening sits to the port's right, and `floor`/`top` are heights above it.
// Its corners are rounded: `radiusTop` and `radiusBottom`, from diagonal rays.

const EPSILON = 1e-7;

/** Distance along a ray to the nearest triangle within `limit`, or Infinity. */
function cast(positions, indices, origin, direction, limit = Infinity) {
  let nearest = Infinity;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = direction;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const e1x = positions[b] - positions[a];
    const e1y = positions[b + 1] - positions[a + 1];
    const e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a];
    const e2y = positions[c + 1] - positions[a + 1];
    const e2z = positions[c + 2] - positions[a + 2];
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < EPSILON) continue;
    const inv = 1 / det;
    const tx = ox - positions[a];
    const ty = oy - positions[a + 1];
    const tz = oz - positions[a + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const hit = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (hit > 1e-4 && hit < nearest && hit <= limit) nearest = hit;
  }
  return nearest;
}

/**
 * The opening round `port` ([x, y, z] in the model's frame, on a level axis
 * from the model's origin). `depth` is how far items travel in past the port;
 * a see-through opening with no back wall ends there.
 */
export function measureOpening(positions, indices, port, depth = 0) {
  const length = Math.hypot(port[0], port[2]);
  const out = [port[0] / length, 0, port[2] / length];
  const right = [-out[2], 0, out[0]];
  const at = (t, s, h) => [
    port[0] + out[0] * t + right[0] * s,
    port[1] + h,
    port[2] + out[2] * t + right[2] * s,
  ];
  const neg = (v) => v.map((x) => -x);
  const MID = 0.9;
  const START = 6;
  // The back wall: the first surface a ray from outside meets on the axis.
  const travel = cast(positions, indices, at(START, 0, MID), neg(out), 12);
  const wall = Number.isFinite(travel) ? START - travel : -depth;
  // Walls, roof and floor, from a little in front of the back wall.
  const probe = at(wall + 0.3, 0, MID);
  const reach = 3;
  const toRight = Math.min(
    cast(positions, indices, probe, right, reach),
    reach,
  );
  const toLeft = Math.min(
    cast(positions, indices, probe, neg(right), reach),
    reach,
  );
  const up = Math.min(cast(positions, indices, probe, [0, 1, 0], reach), reach);
  const down = Math.min(
    cast(positions, indices, probe, [0, -1, 0], reach),
    reach,
  );
  const center = (toRight - toLeft) / 2;
  const halfWidth = (toRight + toLeft) / 2;
  const top = MID + up;
  const floor = MID - down;
  // The rim: step out until the side walls and roof are no longer there.
  let rim = wall + 0.3;
  for (let t = wall + 0.3; t < START; t += 0.05) {
    const p = at(t, center, MID);
    const side = halfWidth + 0.2;
    const r = cast(positions, indices, p, right, side);
    const l = cast(positions, indices, p, neg(right), side);
    const u = cast(
      positions,
      indices,
      at(t, center, floor + 0.2),
      [0, 1, 0],
      top - floor,
    );
    if (!Number.isFinite(r) && !Number.isFinite(l) && !Number.isFinite(u))
      break;
    rim = t;
  }
  // Corners, inside the tunnel: a ray from the middle of the opening towards
  // each corner of its box meets the rounded corner short of it; the
  // shortfall gives the radius.
  const a = halfWidth;
  const b = (top - floor) / 2;
  const mid = at(wall + 0.3, center, (top + floor) / 2);
  const corner = (sx, sy) => {
    const length = Math.hypot(a, b);
    const dir = [
      (right[0] * sx * a) / length,
      (sy * b) / length,
      (right[2] * sx * a) / length,
    ];
    const hit = cast(positions, indices, mid, dir, length + 0.2);
    if (!Number.isFinite(hit)) return 0;
    // Where the ray meets a circle of radius r inset r from both sides.
    const px = (hit * a) / length;
    const py = (hit * b) / length;
    const k = px - a + (py - b);
    const c = (px - a) ** 2 + (py - b) ** 2;
    const disc = k * k - c;
    if (disc < 0) return 0;
    const r = -k - Math.sqrt(disc);
    return Math.min(Math.max(r, 0), Math.min(a, b));
  };
  const radiusTop = (corner(1, 1) + corner(-1, 1)) / 2;
  const radiusBottom = (corner(1, -1) + corner(-1, -1)) / 2;
  return { wall, rim, center, halfWidth, floor, top, radiusTop, radiusBottom };
}
