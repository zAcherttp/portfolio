import { describe, expect, it } from "vitest";
import {
  type FloatingTooltipPlacement,
  resolveTooltipPosition,
} from "@/components/registry/floating-tooltip";

const anchor = { left: 100, top: 100, width: 20, height: 20 };
const size = { width: 40, height: 20 };
const bounds = { left: 0, top: 0, right: 500, bottom: 500 };

describe("resolveTooltipPosition", () => {
  it.each<[FloatingTooltipPlacement, { left: number; top: number }]>([
    ["top-left", { left: 54, top: 74 }],
    ["top", { left: 90, top: 74 }],
    ["top-right", { left: 126, top: 74 }],
    ["right", { left: 126, top: 100 }],
    ["bottom-right", { left: 126, top: 126 }],
    ["bottom", { left: 90, top: 126 }],
    ["bottom-left", { left: 54, top: 126 }],
    ["left", { left: 54, top: 100 }],
  ])("anchors %s with the default gap", (placement, expected) => {
    expect(resolveTooltipPosition({ anchor, bounds, placement, size })).toEqual(
      { ...expected, placement },
    );
  });

  it("applies an explicit offset without the default gap", () => {
    expect(
      resolveTooltipPosition({
        anchor,
        bounds,
        offset: { x: 3, y: -10 },
        placement: "top",
        size,
      }),
    ).toEqual({ left: 93, top: 70, placement: "top" });
  });

  it("flips to the opposite side when the requested side overflows", () => {
    expect(
      resolveTooltipPosition({
        anchor: { left: 90, top: 2, width: 20, height: 20 },
        bounds: { left: 0, top: 0, right: 200, bottom: 200 },
        placement: "top",
        size,
      }),
    ).toEqual({ left: 80, top: 28, placement: "bottom" });
  });

  it("mirrors both axes at a constrained corner", () => {
    const result = resolveTooltipPosition({
      anchor: { left: 2, top: 2, width: 20, height: 20 },
      bounds: { left: 0, top: 0, right: 200, bottom: 200 },
      placement: "top-left",
      size,
    });

    expect(result.placement).toBe("bottom-right");
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.top).toBeGreaterThanOrEqual(0);
  });

  it("clamps a tooltip that is larger than its available width", () => {
    expect(
      resolveTooltipPosition({
        anchor: { left: 20, top: 20, width: 10, height: 10 },
        bounds: { left: 0, top: 0, right: 50, bottom: 100 },
        placement: "bottom",
        size: { width: 80, height: 20 },
      }).left,
    ).toBe(0);
  });
});
