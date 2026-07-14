import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocsTabs } from "@/components/docs/component-docs-tabs";

const tabs = [
  { label: "Preview", content: <div>Rendered preview</div> },
  { label: "Code", content: <div>Rendered code</div> },
];

describe("DocsTabs", () => {
  it("exposes an accessible selected tab and panel", () => {
    render(<DocsTabs ariaLabel="Component example" tabs={tabs} />);

    expect(
      screen.getByRole("tablist", { name: "Component example" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Rendered preview");
  });

  it("supports arrow, home, and end keyboard navigation", () => {
    render(<DocsTabs ariaLabel="Component example" tabs={tabs} />);

    const preview = screen.getByRole("tab", { name: "Preview" });
    preview.focus();
    fireEvent.keyDown(preview, { key: "ArrowRight" });

    const code = screen.getByRole("tab", { name: "Code" });
    expect(code).toHaveFocus();
    expect(code).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Rendered code");

    fireEvent.keyDown(code, { key: "Home" });
    expect(preview).toHaveFocus();
    expect(preview).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(preview, { key: "End" });
    expect(code).toHaveFocus();
  });
});
