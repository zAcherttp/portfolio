// Exploring the factory in place: zoom in about the pointer, pan within the
// factory's own extent with rubber-band edges, and pull past an edge far
// enough to let go, back to the whole picture. Pure state; the scene eases
// the camera toward `viewOf` and turns gestures into these calls.

/** How far in the zoom goes, over the whole picture. */
export const MAX_ZOOM = 8;
/** Pulled this far past an edge (CSS pixels of gesture), it lets go. */
export const LET_GO = 160;
/** Rubber-band stiffness, as iOS's scroll views: lower gives more. */
const RUBBER = 0.55;

/** Where the viewer is: zoom over the fitted picture, and its centre. */
export interface Explore {
  zoom: number;
  /** Picture-plane offset of the centre, metres. */
  x: number;
  y: number;
  /** Gesture pulled past the edges, CSS pixels, not yet let go. */
  pullX: number;
  pullY: number;
}

/** The picture and the canvas it is drawn in. */
export interface Stage {
  /** The fitted picture's size, metres. */
  width: number;
  height: number;
  /** CSS pixels per metre at zoom 1. */
  fit: number;
  /** The canvas, CSS pixels. */
  viewWidth: number;
  viewHeight: number;
}

export const WHOLE: Explore = { zoom: 1, x: 0, y: 0, pullX: 0, pullY: 0 };

export function zoomed(state: Explore) {
  return state.zoom > 1.001;
}

/** How far the centre may move each way at a zoom, metres. */
function limits(zoom: number, stage: Stage) {
  return {
    x: (stage.width / 2) * (1 - 1 / zoom),
    y: (stage.height / 2) * (1 - 1 / zoom),
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Zooms by `factor` about a point `sx`, `sy` CSS pixels from the canvas's
 * centre (y down), keeping what is under it there.
 */
export function zoomAbout(
  state: Explore,
  factor: number,
  sx: number,
  sy: number,
  stage: Stage,
): Explore {
  const zoom = clamp(state.zoom * factor, 1, MAX_ZOOM);
  const before = stage.fit * state.zoom;
  const after = stage.fit * zoom;
  const reach = limits(zoom, stage);
  return {
    zoom,
    x: clamp(state.x + sx * (1 / before - 1 / after), -reach.x, reach.x),
    y: clamp(state.y - sy * (1 / before - 1 / after), -reach.y, reach.y),
    pullX: 0,
    pullY: 0,
  };
}

/**
 * Pans by a gesture of `dx`, `dy` CSS pixels (content follows the gesture:
 * a drag right moves the picture right). Past an edge the gesture pulls
 * instead; pulled past LET_GO, it lets go and the picture returns whole.
 */
export function panBy(
  state: Explore,
  dx: number,
  dy: number,
  stage: Stage,
): { state: Explore; letGo: boolean } {
  const scale = stage.fit * state.zoom;
  const reach = limits(state.zoom, stage);
  const axis = (at: number, pulled: number, moved: number, limit: number) => {
    let pull = pulled;
    let move = moved;
    // Moving back toward the picture first takes up the pull. The pull has
    // the gesture's sign when it was made, so `taken` runs against this move:
    // it shrinks both.
    if (pull !== 0 && move !== 0 && Math.sign(move) !== Math.sign(pull)) {
      const taken = Math.sign(pull) * Math.min(Math.abs(pull), Math.abs(move));
      pull -= taken;
      move += taken;
    }
    const next = at - move / scale;
    if (next > limit) return { at: limit, pull: pull - (next - limit) * scale };
    if (next < -limit)
      return { at: -limit, pull: pull - (next + limit) * scale };
    return { at: next, pull };
  };
  const x = axis(state.x, state.pullX, dx, reach.x);
  // Screen y runs down, the picture's up.
  const y = axis(state.y, state.pullY, -dy, reach.y);
  const next = { ...state, x: x.at, y: y.at, pullX: x.pull, pullY: y.pull };
  if (Math.max(Math.abs(next.pullX), Math.abs(next.pullY)) > LET_GO) {
    return { state: WHOLE, letGo: true };
  }
  return { state: next, letGo: false };
}

/** The gesture ended: the pull springs back. */
export function release(state: Explore): Explore {
  return { ...state, pullX: 0, pullY: 0 };
}

/** Rubber-band: how far a pull shows, CSS pixels, giving less as it grows. */
export function rubber(pull: number, size: number) {
  const d = Math.abs(pull);
  return Math.sign(pull) * (1 - 1 / ((d * RUBBER) / size + 1)) * size;
}

/** What the camera should show: the state, with its pulls shown rubbery. */
export function viewOf(state: Explore, stage: Stage) {
  const scale = stage.fit * state.zoom;
  return {
    zoom: state.zoom,
    x: state.x - rubber(state.pullX, stage.viewWidth) / scale,
    y: state.y - rubber(state.pullY, stage.viewHeight) / scale,
  };
}
