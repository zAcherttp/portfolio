import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({ play: vi.fn() }));

vi.mock("@/utils/playThockSound", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/utils/playThockSound")>();
  return { ...actual, playThockSound: audio.play };
});

import { Keyboard60Preview } from "@/components/docs/keyboard-60-preview";

function setCaptureSupport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
}

function enableCapture() {
  fireEvent.click(
    screen.getByRole("button", { name: "Enable keyboard capture" }),
  );
}

describe("Keyboard60Preview thock lifecycle", () => {
  beforeEach(() => {
    audio.play.mockClear();
    setCaptureSupport(true);
  });

  it("is inert until the user explicitly enables capture", () => {
    const { container } = render(<Keyboard60Preview />);
    const key = container.querySelector('kbd[data-key="A"]');

    expect(screen.getByTestId("keyboard-60")).toHaveAttribute(
      "data-capture-state",
      "static",
    );
    expect(fireEvent.keyDown(document, { code: "KeyA", key: "a" })).toBe(true);
    expect(key).toHaveAttribute("data-state", "idle");
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("plays one Down and one matching Up while ignoring repeats", () => {
    render(<Keyboard60Preview />);
    enableCapture();

    fireEvent.keyDown(document, { code: "KeyA", key: "a", repeat: false });
    fireEvent.keyDown(document, { code: "KeyA", key: "a", repeat: true });
    fireEvent.keyDown(document, { code: "KeyA", key: "a", repeat: false });
    fireEvent.keyUp(document, { code: "KeyA", key: "a" });
    fireEvent.keyUp(document, { code: "KeyA", key: "a" });

    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(audio.play).toHaveBeenNthCalledWith(1, "normal", {
      event: "down",
    });
    expect(audio.play).toHaveBeenNthCalledWith(2, "normal", { event: "up" });
  });

  it("clears held sounds on blur without creating an Up burst", () => {
    render(<Keyboard60Preview />);
    enableCapture();

    fireEvent.keyDown(document, {
      code: "Enter",
      key: "Enter",
      repeat: false,
    });
    fireEvent.blur(window);
    fireEvent.keyUp(document, { code: "Enter", key: "Enter" });

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.play).toHaveBeenCalledWith("wide", { event: "down" });
  });

  it("owns Alt and always releases its controlled visual state", () => {
    const { container } = render(<Keyboard60Preview />);
    enableCapture();
    const altKeys = container.querySelectorAll('kbd[data-key="Alt"]');

    expect(altKeys).toHaveLength(2);
    expect(
      fireEvent.keyDown(document, {
        altKey: true,
        code: "AltLeft",
        key: "Alt",
      }),
    ).toBe(false);
    for (const key of altKeys)
      expect(key).toHaveAttribute("data-state", "pressed");

    fireEvent.keyUp(document, { code: "AltLeft", key: "Alt" });
    for (const key of altKeys)
      expect(key).toHaveAttribute("data-state", "idle");
  });

  it("recovers when the browser drops a modifier keyup", () => {
    const { container } = render(<Keyboard60Preview />);
    enableCapture();
    const altKeys = container.querySelectorAll('kbd[data-key="Alt"]');

    fireEvent.keyDown(document, {
      altKey: true,
      code: "AltLeft",
      key: "Alt",
    });
    for (const key of altKeys)
      expect(key).toHaveAttribute("data-state", "pressed");

    fireEvent.keyDown(document, { code: "KeyA", key: "a" });
    for (const key of altKeys)
      expect(key).toHaveAttribute("data-state", "idle");

    fireEvent.keyDown(document, {
      altKey: true,
      code: "AltLeft",
      key: "Alt",
    });
    expect(audio.play).toHaveBeenLastCalledWith("wide", { event: "down" });
  });

  it("captures Tab only while consent is active and Esc releases it", () => {
    const { container } = render(<Keyboard60Preview />);
    const tab = container.querySelector('kbd[data-key="Tab"]');
    enableCapture();

    expect(fireEvent.keyDown(document, { code: "Tab", key: "Tab" })).toBe(
      false,
    );
    expect(tab).toHaveAttribute("data-state", "pressed");
    expect(fireEvent.keyUp(document, { code: "Tab", key: "Tab" })).toBe(false);
    expect(tab).toHaveAttribute("data-state", "idle");

    expect(fireEvent.keyDown(document, { code: "Escape", key: "Escape" })).toBe(
      false,
    );
    expect(screen.getByTestId("keyboard-60")).toHaveAttribute(
      "data-capture-state",
      "static",
    );
    expect(
      screen.getByRole("button", { name: "Enable keyboard capture" }),
    ).toBeVisible();
    expect(fireEvent.keyDown(document, { code: "Tab", key: "Tab" })).toBe(true);
  });

  it("blocks global key handlers only while capture is enabled", () => {
    const globalKeyDown = vi.fn();
    document.addEventListener("keydown", globalKeyDown);
    render(<Keyboard60Preview />);

    fireEvent.keyDown(document, { code: "KeyD", key: "d" });
    expect(globalKeyDown).toHaveBeenCalledOnce();

    enableCapture();
    fireEvent.keyDown(document, { code: "KeyD", key: "d" });
    expect(globalKeyDown).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
    fireEvent.keyDown(document, { code: "KeyD", key: "d" });
    expect(globalKeyDown).toHaveBeenCalledTimes(2);

    document.removeEventListener("keydown", globalKeyDown);
  });

  it("stays static and omits consent controls on unsupported mobile", () => {
    setCaptureSupport(false);
    render(<Keyboard60Preview />);

    expect(screen.queryByTestId("keyboard-capture-consent")).toBeNull();
    expect(screen.getByTestId("keyboard-60")).toHaveAttribute(
      "data-capture-state",
      "static",
    );
    fireEvent.keyDown(document, { code: "KeyA", key: "a" });
    expect(audio.play).not.toHaveBeenCalled();
  });
});
