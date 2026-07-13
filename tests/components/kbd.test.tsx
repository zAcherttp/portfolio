import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hotkey = vi.hoisted(() => ({
  held: false,
  useKeyHold: vi.fn(() => false),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useKeyHold: hotkey.useKeyHold,
}));

import { Kbd, KbdGroup } from "@/components/ui/kbd";

describe("Kbd", () => {
  beforeEach(() => {
    hotkey.held = false;
    hotkey.useKeyHold.mockImplementation(() => hotkey.held);
    hotkey.useKeyHold.mockClear();
  });

  it("renders a semantic keyboard key", () => {
    render(<Kbd>D</Kbd>);

    expect(screen.getByText("D").tagName).toBe("KBD");
    expect(screen.getByText("D")).toHaveAttribute("data-state", "idle");
    expect(hotkey.useKeyHold).not.toHaveBeenCalled();
  });

  it("forwards HTML attributes and custom classes", () => {
    render(
      <Kbd className="custom-key" data-testid="shortcut-key" title="Shortcut">
        D
      </Kbd>,
    );

    expect(screen.getByTestId("shortcut-key")).toHaveClass("custom-key");
    expect(screen.getByTestId("shortcut-key")).toHaveAttribute(
      "title",
      "Shortcut",
    );
  });

  it("renders a controlled pressed state without subscribing", () => {
    render(<Kbd pressed>Space</Kbd>);

    expect(screen.getByText("Space")).toHaveAttribute("data-state", "pressed");
    expect(hotkey.useKeyHold).not.toHaveBeenCalled();
  });

  it("subscribes only when reactive and follows the held key", () => {
    const { rerender } = render(
      <Kbd keyName="D" reactive>
        D
      </Kbd>,
    );

    expect(hotkey.useKeyHold).toHaveBeenCalledWith("D");
    expect(screen.getByText("D")).toHaveAttribute("data-state", "idle");
    expect(screen.getByText("D")).not.toHaveAttribute("reactive");

    hotkey.held = true;
    rerender(
      <Kbd keyName="D" reactive>
        D
      </Kbd>,
    );
    expect(screen.getByText("D")).toHaveAttribute("data-state", "pressed");
  });

  it("groups shortcut keys without changing their semantics", () => {
    render(
      <KbdGroup data-testid="shortcut-group">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    );

    const group = screen.getByTestId("shortcut-group");
    expect(group.tagName).toBe("SPAN");
    expect(group.querySelectorAll("kbd")).toHaveLength(2);
    expect(hotkey.useKeyHold).not.toHaveBeenCalled();
  });
});
