import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/registry/floating-tooltip/virtual-tooltip", () => ({
  VirtualTooltip: ({
    children,
    id,
    open,
  }: {
    children: ReactNode;
    id?: string;
    open?: boolean;
  }) =>
    open ? (
      <div id={id} role="tooltip">
        {children}
      </div>
    ) : null,
}));

import { Tooltip } from "@/components/registry/floating-tooltip/tooltip";

describe("Tooltip", () => {
  beforeEach(() => vi.useRealTimers());

  it("opens for a mouse pointer and composes aria-describedby", () => {
    render(
      <Tooltip content="Helpful context">
        <button aria-describedby="existing" type="button">
          Trigger
        </button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Helpful context");
    expect(trigger).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("existing"),
    );
    expect(trigger.getAttribute("aria-describedby")).toContain(tooltip.id);

    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on focus and closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <Tooltip content="Keyboard context" onOpenChange={onOpenChange}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("ignores touch pointers and the disabled state", () => {
    const { rerender } = render(
      <Tooltip content="Context">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });

    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <Tooltip content="Context" disabled>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("honors open and close delays", () => {
    vi.useFakeTimers();
    render(
      <Tooltip closeDelay={75} content="Delayed" openDelay={100}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });

    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(74));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("preserves trigger handlers and refs", () => {
    const onPointerEnter = vi.fn();
    const ref = vi.fn();
    render(
      <Tooltip content="Context">
        <button onPointerEnter={onPointerEnter} ref={ref} type="button">
          Trigger
        </button>
      </Tooltip>,
    );

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Trigger" }), {
      pointerType: "mouse",
    });
    expect(onPointerEnter).toHaveBeenCalledOnce();
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });
});
