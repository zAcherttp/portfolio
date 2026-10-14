import { describe, expect, it } from "vitest";
import {
  LET_GO,
  MAX_ZOOM,
  panBy,
  release,
  type Stage,
  viewOf,
  WHOLE,
  zoomAbout,
  zoomed,
} from "@/components/figures/factory/explore";

const stage: Stage = {
  width: 100,
  height: 60,
  fit: 8,
  viewWidth: 800,
  viewHeight: 480,
};

describe("exploring the factory", () => {
  it("zooms about the pointer, keeping what is under it there", () => {
    const state = zoomAbout(WHOLE, 2, 200, -100, stage);
    expect(state.zoom).toBe(2);
    expect(zoomed(state)).toBe(true);
    // The world point under the pointer before and after.
    const under = (s: typeof state) => ({
      x: s.x + 200 / (stage.fit * s.zoom),
      y: s.y + 100 / (stage.fit * s.zoom),
    });
    expect(under(state).x).toBeCloseTo(under(WHOLE).x);
    expect(under(state).y).toBeCloseTo(under(WHOLE).y);
  });

  it("stays between the whole picture and its deepest zoom", () => {
    expect(zoomAbout(WHOLE, 0.5, 0, 0, stage).zoom).toBe(1);
    expect(zoomAbout(WHOLE, 100, 0, 0, stage).zoom).toBe(MAX_ZOOM);
  });

  it("pans within the factory, then pulls rubbery past its edge", () => {
    const deep = zoomAbout(WHOLE, 2, 0, 0, stage);
    // Drag right 500 px: 400 reach the left edge, the rest is pull.
    const { state, letGo } = panBy(deep, 500, 0, stage);
    expect(letGo).toBe(false);
    expect(state.x).toBeCloseTo(-25);
    expect(Math.abs(state.pullX)).toBeGreaterThan(0);
    // The pull shows, but less than the gesture made.
    const shown = (deep.x - viewOf(state, stage).x) * stage.fit * deep.zoom;
    expect(shown).toBeGreaterThan(400);
    expect(shown).toBeLessThan(400 + Math.abs(state.pullX));
    // A drag back takes up the pull before moving the view.
    const back = panBy(state, -Math.abs(state.pullX), 0, stage).state;
    expect(back.pullX).toBeCloseTo(0);
    expect(back.x).toBeCloseTo(-25);
    expect(release(state).pullX).toBe(0);
  });

  it("lets go back to the whole picture when pulled far enough", () => {
    const deep = zoomAbout(WHOLE, 3, 0, 0, stage);
    // To the bottom edge, then past it by more than LET_GO.
    const toEdge = panBy(deep, 0, -10_000, stage);
    expect(toEdge.letGo).toBe(true);
    expect(toEdge.state).toEqual(WHOLE);
    // At 3×, the edge is 480 px of drag away.
    const near = panBy(deep, 0, -(480 + LET_GO - 1), stage);
    expect(near.letGo).toBe(false);
  });

  it("keeps one axis's pull while panning only along the other", () => {
    const deep = zoomAbout(WHOLE, 2, 0, 0, stage);
    const pulled = panBy(deep, 500, 0, stage).state;
    // A purely vertical move used to recurse forever on the pulled x axis.
    const moved = panBy(pulled, 0, 10, stage).state;
    expect(moved.pullX).toBe(pulled.pullX);
    expect(moved.y).not.toBe(pulled.y);
  });
});
