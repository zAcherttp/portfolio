import { describe, expect, it } from "vitest";
import { layoutFactory } from "@/components/figures/factory/layout";
import {
  builtShare,
  DONE,
  HIDDEN,
  PHASES,
  type RevealPlan,
  revealClock,
  revealPlanOf,
  scheduleOf,
  seamsAt,
} from "@/components/figures/factory/reveal";

const plan: RevealPlan = {
  buildings: [
    { base: 1, top: 20, phase: "miner" },
    { base: 1, top: 10, phase: "smelters" },
    { base: 1, top: 10, phase: "smelters" },
    { base: 2, top: 4, phase: "smelterLogistics" },
    { base: 1, top: 8, phase: "constructors" },
    { base: 2, top: 4, phase: "constructorLogistics" },
    { base: 1, top: 7, phase: "depot" },
  ],
  belts: [
    { length: 12, phase: "belts" },
    { length: 30, phase: "depotBelt" },
  ],
  pole: { base: 1, top: 8 },
  wires: [40, 10],
};
const schedule = scheduleOf(plan);
const startOf = (i: number) => schedule.buildings[i].start;

describe("factory build reveal", () => {
  it("stands built by default", () => {
    const seams = seamsAt("built", null, plan, schedule);
    expect(seams.done).toBe(true);
    expect(seams.buildings.every((s) => s === DONE)).toBe(true);
  });

  it("places nothing before the build starts", () => {
    const seams = seamsAt("place", null, plan, schedule);
    expect(seams.platform).toBe(HIDDEN);
    expect(seams.buildings.every((s) => s === HIDDEN)).toBe(true);
    expect(seams.belts.every((s) => s === HIDDEN)).toBe(true);
  });

  it("builds in the game's order, platform to power", () => {
    // The platform glitches in first, then builds.
    expect(schedule.glitch.start).toBe(0);
    expect(schedule.platform.start).toBe(
      schedule.glitch.start + schedule.glitch.time,
    );
    // Miner, smelters, their logistics, constructors, theirs.
    expect(startOf(0)).toBeGreaterThan(0);
    expect(startOf(1)).toBeGreaterThan(startOf(0));
    expect(startOf(2)).toBeGreaterThan(startOf(1));
    expect(startOf(3)).toBeGreaterThan(startOf(2));
    expect(startOf(4)).toBeGreaterThan(startOf(3));
    expect(startOf(5)).toBeGreaterThan(startOf(4));
    // Then the belts, the uploader, its belt, and the power last.
    expect(schedule.belts[0].start).toBeGreaterThan(startOf(5));
    expect(startOf(6)).toBeGreaterThan(schedule.belts[0].start);
    expect(schedule.belts[1].start).toBeGreaterThan(startOf(6));
    expect(schedule.pole.start).toBeGreaterThan(schedule.belts[1].start);
    expect(schedule.wires[0].start).toBeGreaterThan(schedule.pole.start);
    expect(schedule.end).toBeGreaterThanOrEqual(
      schedule.wires[1].start + schedule.wires[1].time,
    );
  });

  it("raises machines up from their base and lays belts along their run", () => {
    const mid = (slot: { start: number; time: number }) =>
      slot.start + slot.time / 2;
    const rising = seamsAt("place", mid(schedule.buildings[0]), plan, schedule);
    expect(rising.buildings[0]).toBeGreaterThan(1);
    expect(rising.buildings[0]).toBeLessThan(20.6);
    expect(rising.items).toBe(HIDDEN);

    const laying = seamsAt("place", mid(schedule.belts[0]), plan, schedule);
    expect(laying.belts[0]).toBeGreaterThan(0);
    expect(laying.belts[0]).toBeLessThan(12.6);

    const after = seamsAt("place", schedule.end + 0.1, plan, schedule);
    expect(after.done).toBe(true);
    expect(after.items).toBe(DONE);
    expect(after.wires.every((s) => s === DONE)).toBe(true);
  });

  it("lays belts at an even pace and eases machines out", () => {
    const [belt] = schedule.belts;
    const laid = (share: number) =>
      seamsAt("place", belt.start + belt.time * share, plan, schedule).belts[0];
    // Linear: equal time, equal length.
    expect(laid(0.5) - laid(0.25)).toBeCloseTo(laid(0.75) - laid(0.5));
    const [miner] = schedule.buildings;
    const risen = (share: number) =>
      seamsAt("place", miner.start + miner.time * share, plan, schedule)
        .buildings[0];
    // Ease-out: most of the height in the first quarter.
    expect(risen(0.25) - risen(0)).toBeGreaterThan(
      risen(1 - 1e-6) - risen(0.75),
    );
    expect(builtShare(5, 1, 9)).toBeCloseTo(0.5);
    expect(builtShare(HIDDEN, 1, 9)).toBe(0);
    expect(builtShare(DONE, 1, 9)).toBe(1);
  });

  it("sorts the real line into the game's build steps", () => {
    const layout = layoutFactory();
    const real = revealPlanOf(layout, [10]);
    const phaseOf = (kind: string) =>
      layout.buildings
        .map((b, i) => ({ kind: b.kind, phase: real.buildings[i].phase }))
        .filter((b) => b.kind === kind)
        .map((b) => b.phase);
    expect(new Set(phaseOf("smelter"))).toEqual(new Set(["smelters"]));
    // One splitter feeds the smelters and one merger joins their output;
    // the rest serve the constructors.
    const logistics = [...phaseOf("splitter"), ...phaseOf("merger")];
    expect(logistics.filter((p) => p === "smelterLogistics")).toHaveLength(2);
    expect(logistics.filter((p) => p === "constructorLogistics")).toHaveLength(
      10,
    );
    // Only the belt into the uploader waits for it.
    expect(real.belts.filter((b) => b.phase === "depotBelt")).toHaveLength(1);

    // Every step starts after the one before it.
    const timed = scheduleOf(real);
    const firstStart = (phase: (typeof PHASES)[number]) =>
      Math.min(
        ...real.buildings
          .map((b, i) => (b.phase === phase ? timed.buildings[i].start : 1e9))
          .concat(
            real.belts.map((b, i) =>
              b.phase === phase ? timed.belts[i].start : 1e9,
            ),
          ),
      );
    const order = PHASES.filter((p) => p !== "platform" && p !== "power").map(
      firstStart,
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(timed.pole.start).toBeGreaterThan(order[order.length - 1]);
  });

  it("glitches the platform on and off before it builds", () => {
    const { glitch } = schedule;
    const shown = (t: number) =>
      seamsAt("place", t, plan, schedule).platform !== HIDDEN;
    const samples = Array.from({ length: 60 }, (_, i) =>
      shown(glitch.start + (glitch.time * i) / 60),
    );
    // It flickers: on and off more than once, and nothing else is up yet.
    const flips = samples.filter((on, i) => i > 0 && on !== samples[i - 1]);
    expect(flips.length).toBeGreaterThanOrEqual(4);
    const early = seamsAt("place", glitch.start + 0.01, plan, schedule);
    expect(early.buildings.every((s) => s === HIDDEN)).toBe(true);
    expect(early.belts.every((s) => s === HIDDEN)).toBe(true);
  });
});

describe("factory reveal clock", () => {
  it("waits, unstarted, until the picture is seen", () => {
    expect(revealClock(null, false, 1 / 60)).toBeNull();
  });

  it("starts the build from its beginning on the first frame after", () => {
    // The first frame can be held up for seconds, compiling shaders.
    expect(revealClock(null, true, 2)).toBe(0);
  });

  it("does not skip part of the build over a held-up frame", () => {
    const after = revealClock(0, true, 1.5) ?? Number.NaN;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(0.05);
  });

  it("runs at the frames' own pace otherwise", () => {
    expect(revealClock(1, true, 1 / 60)).toBeCloseTo(1 + 1 / 60);
  });
});
