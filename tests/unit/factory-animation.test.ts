import { describe, expect, it } from "vitest";
import {
  type Clips,
  layerPose,
  poseOf,
  RELOAD_PERIOD,
  startLayer,
  startPlayer,
  stepLayer,
  stepPlayer,
} from "@/components/figures/factory/animation";

describe("factory layer clip", () => {
  const clips: Clips = { reload: { start: 20, frames: 10, length: 10 } };

  it("reloads once per timer period, only while working", () => {
    let layer = stepLayer(startLayer(), false, clips.reload, RELOAD_PERIOD);
    expect(layer.time).toBeNull();
    layer = stepLayer(layer, true, clips.reload, RELOAD_PERIOD);
    expect(layer.time).toBe(0);
    expect(layer.ready).toBe(false);
    layer = stepLayer(layer, true, clips.reload, 4.5);
    expect(layerPose(layer, "reload", clips).a).toBe(24);
    layer = stepLayer(layer, true, clips.reload, 6);
    expect(layer.time).toBeNull();
    expect(layerPose(layer, "reload", clips)).toEqual({ a: 20, b: 20, mix: 0 });
  });
});

const smelter: Clips = {
  idle: { start: 0, frames: 1, length: 1.27 },
  startup: { start: 1, frames: 38, length: 1.27 },
  producing: { start: 39, frames: 74, length: 2.53 },
  shutdown: { start: 113, frames: 31, length: 1.03 },
};
const press: Clips = {
  producing: { start: 0, frames: 119, length: 119 / 30 },
};

describe("factory clip player", () => {
  it("rests on the idle pose until it works", () => {
    let p = startPlayer(smelter);
    p = stepPlayer(p, false, smelter, 5);
    expect(p).toEqual({ clip: "idle", time: 0 });
    expect(poseOf(p, smelter)).toEqual({ a: 0, b: 0, mix: 0 });
  });

  it("starts up into a producing loop", () => {
    let p = stepPlayer(startPlayer(smelter), true, smelter, 0.5);
    expect(p.clip).toBe("startup");
    p = stepPlayer(p, true, smelter, 1);
    expect(p.clip).toBe("producing");
    expect(p.time).toBeCloseTo(0.23);
    p = stepPlayer(p, true, smelter, 10);
    expect(p.clip).toBe("producing");
    expect(p.time).toBeLessThan(2.53);
  });

  it("shuts down back to idle", () => {
    let p = { clip: "producing", time: 1 };
    p = stepPlayer(p, false, smelter, 0.1);
    expect(p.clip).toBe("shutdown");
    p = stepPlayer(p, false, smelter, 2);
    expect(p).toEqual({ clip: "idle", time: 0 });
  });

  it("finishes the loop and rests when there is no shutdown clip", () => {
    let p = stepPlayer(startPlayer(press), true, press, 1);
    expect(p.clip).toBe("producing");
    p = stepPlayer(p, false, press, 1);
    expect(p.clip).toBe("producing");
    p = stepPlayer(p, false, press, 3);
    expect(p.clip).toBe("rest");
    expect(poseOf(p, press)).toEqual({ a: 0, b: 0, mix: 0 });
  });

  it("resumes the loop without starting up again, like a suspended miner", () => {
    const miner: Clips = {
      idle: { start: 0, frames: 1, length: 0.03 },
      startup: { start: 1, frames: 10, length: 2 },
      producing: { start: 11, frames: 5, length: 1 },
    };
    let p = stepPlayer(startPlayer(miner), true, miner, 2.5);
    expect(p.clip).toBe("producing");
    p = stepPlayer(p, false, miner, 2);
    expect(p.clip).toBe("rest");
    p = stepPlayer(p, true, miner, 0.1);
    expect(p.clip).toBe("producing");
  });

  it("blends between neighbouring frames and wraps the loop", () => {
    const mid = poseOf({ clip: "producing", time: 1.265 }, smelter);
    expect(mid.a).toBe(39 + 37);
    expect(mid.b).toBe(39 + 38);
    expect(mid.mix).toBeCloseTo(0, 1);
    const end = poseOf({ clip: "producing", time: 2.52 }, smelter);
    expect(end.b).toBe(39);
    const last = poseOf({ clip: "shutdown", time: 5 }, smelter);
    expect(last).toEqual({ a: 143, b: 143, mix: 0 });
  });
});
