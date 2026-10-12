import { describe, expect, it } from "vitest";
import {
  packModels,
  scramble,
  unpackModels,
} from "@/components/figures/factory/pack";

describe("factory model pack", () => {
  it("round-trips named entries", () => {
    const entries = [
      { name: "miner", data: Uint8Array.from([1, 2, 3, 4, 5]) },
      { name: "belt", data: new Uint8Array(0) },
      {
        name: "screw",
        data: Uint8Array.from({ length: 300 }, (_, i) => i % 256),
      },
    ];
    const unpacked = unpackModels(packModels(entries));
    expect([...unpacked.keys()]).toEqual(["miner", "belt", "screw"]);
    for (const e of entries) {
      expect([...(unpacked.get(e.name) ?? [])]).toEqual([...e.data]);
    }
  });

  it("hides recognisable bytes such as a glTF header", () => {
    const glb = new TextEncoder().encode('glTF........JSON{"asset":{}}');
    const blob = packModels([{ name: "a", data: glb }]);
    const text = new TextDecoder("latin1").decode(blob);
    expect(text).not.toContain("glTF");
    expect(text).not.toContain("asset");
  });

  it("scrambles reversibly", () => {
    const bytes = Uint8Array.from({ length: 64 }, (_, i) => i);
    const copy = bytes.slice();
    scramble(scramble(bytes));
    expect([...bytes]).toEqual([...copy]);
  });

  it("rejects anything else", () => {
    expect(() => unpackModels(new Uint8Array(16))).toThrow(/not a factory/i);
  });
});
