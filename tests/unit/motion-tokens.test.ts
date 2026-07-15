import { describe, expect, it } from "vitest";
import {
  getStaggerDelay,
  MOTION_CSS_VARIABLES,
  MOTION_DURATION_MS,
  MOTION_EASING,
  MOTION_STAGGER,
  MOTION_TRANSITION,
} from "@/constants/motion";

describe("motion tokens", () => {
  it("publishes the documented duration contract to Motion and CSS consumers", () => {
    expect(MOTION_DURATION_MS).toEqual({
      instant: 0,
      hoverOut: 100,
      feedback: 120,
      hover: 140,
      enter: 180,
      move: 200,
      reveal: 240,
      cascade: 380,
    });
    expect(MOTION_TRANSITION).toMatchObject({
      instant: { duration: 0 },
      feedback: { duration: 0.12 },
      hover: { duration: 0.14 },
      enter: { duration: 0.18 },
      move: { duration: 0.2 },
      reveal: { duration: 0.24 },
      cascade: { duration: 0.38 },
    });
    expect(MOTION_CSS_VARIABLES).toMatchObject({
      "--motion-duration-instant": "0ms",
      "--motion-duration-hover-out": "100ms",
      "--motion-duration-feedback": "120ms",
      "--motion-duration-hover": "140ms",
      "--motion-duration-enter": "180ms",
      "--motion-duration-move": "200ms",
      "--motion-duration-reveal": "240ms",
      "--motion-duration-cascade": "380ms",
    });
  });

  it("publishes the documented easing contract to Motion and CSS consumers", () => {
    expect(MOTION_EASING).toEqual({
      standard: [0.25, 0.1, 0.25, 1],
      out: [0.23, 1, 0.32, 1],
      inOut: [0.77, 0, 0.175, 1],
      cascade: [0.16, 1, 0.3, 1],
    });
    expect(MOTION_CSS_VARIABLES).toMatchObject({
      "--motion-ease-standard": "cubic-bezier(0.25, 0.1, 0.25, 1)",
      "--motion-ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
      "--motion-ease-in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      "--motion-ease-cascade": "cubic-bezier(0.16, 1, 0.3, 1)",
    });
  });

  it("keeps UI motion and stagger inside the interaction budget", () => {
    const { cascade, ...frequentInteractionDurations } = MOTION_DURATION_MS;

    expect(
      Math.max(...Object.values(frequentInteractionDurations)),
    ).toBeLessThanOrEqual(240);
    expect(cascade).toBe(380);
    expect(MOTION_STAGGER.maxDelay).toBe(0.22);
    expect(getStaggerDelay(20, 21)).toBeCloseTo(0.22);
    expect(
      MOTION_TRANSITION.cascade.duration + getStaggerDelay(20, 21),
    ).toBeCloseTo(0.6);
  });
});
