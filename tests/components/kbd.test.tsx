import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

describe("Kbd", () => {
  it("renders a semantic keyboard key", () => {
    render(<Kbd>D</Kbd>);

    expect(screen.getByText("D").tagName).toBe("KBD");
    expect(screen.getByText("D")).toHaveAttribute("data-state", "idle");
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
  });
});
