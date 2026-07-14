import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  it("keeps Motion seconds and CSS milliseconds in sync", () => {
    for (const [name, duration] of Object.entries(MOTION_DURATION_MS)) {
      const cssName = name.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      );

      expect(MOTION_CSS_VARIABLES[`--motion-duration-${cssName}`]).toBe(
        `${duration}ms`,
      );
    }

    expect(MOTION_TRANSITION.feedback.duration * 1000).toBe(
      MOTION_DURATION_MS.feedback,
    );
    expect(MOTION_TRANSITION.hover.duration * 1000).toBe(
      MOTION_DURATION_MS.hover,
    );
    expect(MOTION_TRANSITION.enter.duration * 1000).toBe(
      MOTION_DURATION_MS.enter,
    );
    expect(MOTION_TRANSITION.move.duration * 1000).toBe(
      MOTION_DURATION_MS.move,
    );
    expect(MOTION_TRANSITION.reveal.duration * 1000).toBe(
      MOTION_DURATION_MS.reveal,
    );
  });

  it("derives CSS easing curves from the Motion tuples", () => {
    for (const [name, easing] of Object.entries(MOTION_EASING)) {
      const cssName = name.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      );

      expect(MOTION_CSS_VARIABLES[`--motion-ease-${cssName}`]).toBe(
        `cubic-bezier(${easing.join(", ")})`,
      );
    }
  });

  it("keeps UI motion and stagger inside the interaction budget", () => {
    const { cascade, ...frequentInteractionDurations } = MOTION_DURATION_MS;

    expect(
      Math.max(...Object.values(frequentInteractionDurations)),
    ).toBeLessThanOrEqual(240);
    expect(cascade).toBe(380);
    expect(getStaggerDelay(20, 21)).toBe(MOTION_STAGGER.maxDelay);
    expect(MOTION_TRANSITION.cascade.duration + getStaggerDelay(20, 21)).toBe(
      0.6,
    );
  });

  it("preserves generic instant hover-in with explicit motion opt-ins", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain(
      "transition-duration: var(--motion-duration-hover-out, 100ms)",
    );
    expect(css).toContain(
      "transition-duration: var(--motion-duration-instant, 0ms)",
    );
    expect(css).toMatch(/\.motion-hover,\s*\.motion-hover:hover/);
  });
});
