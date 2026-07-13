import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "@/components/ui/kbd";

describe("Kbd", () => {
  it("renders a semantic keyboard key", () => {
    render(<Kbd>D</Kbd>);

    expect(screen.getByText("D").tagName).toBe("KBD");
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
});
