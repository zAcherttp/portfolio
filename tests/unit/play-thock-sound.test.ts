import { describe, expect, it } from "vitest";
import {
  getThockSoundProfile,
  getThockSoundVoices,
  normalizeThockVolume,
  THOCK_VARIANT_COUNT,
} from "@/utils/playThockSound";

describe("getThockSoundProfile", () => {
  it("gives the space bar the roomiest voice", () => {
    expect(getThockSoundProfile(" ", "Space")).toBe("space");
  });

  it("groups every non-space key wider than one unit", () => {
    for (const key of [
      "Alt",
      "Backspace",
      "CapsLock",
      "ContextMenu",
      "Control",
      "Enter",
      "Escape",
      "Fn",
      "Meta",
      "Shift",
      "Tab",
      "\\",
    ]) {
      expect(getThockSoundProfile(key)).toBe("wide");
    }
    expect(getThockSoundProfile("\\", "Backslash")).toBe("wide");
  });

  it("keeps regular one-unit keys normal", () => {
    expect(getThockSoundProfile("A", "KeyA")).toBe("normal");
    expect(getThockSoundProfile(";", "Semicolon")).toBe("normal");
  });

  it("ignores keys outside the 60% preview", () => {
    expect(getThockSoundProfile("ArrowUp", "ArrowUp")).toBeNull();
    expect(getThockSoundProfile("F5", "F5")).toBeNull();
  });

  it("keeps volume within the supported gain range", () => {
    expect(normalizeThockVolume()).toBe(1);
    expect(normalizeThockVolume(1.5)).toBe(1.5);
    expect(normalizeThockVolume(-1)).toBe(0);
    expect(normalizeThockVolume(3)).toBe(2);
    expect(normalizeThockVolume(Number.NaN)).toBe(1);
  });

  it("exposes three sizes, two events, and six variants", () => {
    expect(getThockSoundVoices()).toEqual([
      { event: "down", profile: "normal" },
      { event: "up", profile: "normal" },
      { event: "down", profile: "wide" },
      { event: "up", profile: "wide" },
      { event: "down", profile: "space" },
      { event: "up", profile: "space" },
    ]);
    expect(THOCK_VARIANT_COUNT).toBe(6);
  });
});
