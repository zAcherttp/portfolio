import { describe, expect, it } from "vitest";
import {
  createGovernor,
  FAST_FOR,
  type Governor,
  govern,
} from "@/components/figures/factory/quality";

function run(g: Governor, delta: number, seconds: number) {
  for (let t = 0; t < seconds; t += delta) govern(g, delta);
}

describe("factory quality governor", () => {
  it("holds full quality at 60 fps", () => {
    const g = createGovernor(3);
    run(g, 1 / 60, 20);
    expect(g.cap).toBe(3);
  });

  it("steps down when frames run under ~52 fps for a while", () => {
    const g = createGovernor(3);
    run(g, 1 / 45, 1.5);
    expect(g.cap).toBe(2);
  });

  it("ignores a single hitch", () => {
    const g = createGovernor(3);
    run(g, 1 / 60, 1);
    govern(g, 2);
    run(g, 1 / 60, 1);
    expect(g.cap).toBe(3);
  });

  it("tries a level back after a long smooth stretch", () => {
    const g = createGovernor(3);
    run(g, 1 / 45, 1.5);
    expect(g.cap).toBe(2);
    run(g, 1 / 60, FAST_FOR + 1);
    expect(g.cap).toBe(3);
  });

  it("stops trying a level that runs slow again", () => {
    const g = createGovernor(3);
    run(g, 1 / 45, 1.5);
    run(g, 1 / 60, FAST_FOR + 1);
    expect(g.cap).toBe(3);
    // The tried level is too much: down again, and never back up.
    run(g, 1 / 45, 1.5);
    expect(g.cap).toBe(2);
    run(g, 1 / 60, FAST_FOR * 3);
    expect(g.cap).toBe(2);
  });
});
