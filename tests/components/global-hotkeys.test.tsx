import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hotkeyHandler: undefined as ((event: KeyboardEvent) => void) | undefined,
  hotkeyOptions: undefined as Record<string, unknown> | undefined,
  playSound: vi.fn(),
  setTheme: vi.fn(),
  systemTheme: "light" as string | undefined,
  theme: "light" as string | undefined,
  throttleOptions: undefined as { wait?: number } | undefined,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: mocks.setTheme,
    systemTheme: mocks.systemTheme,
    theme: mocks.theme,
  }),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useHotkey: (
    _key: string,
    handler: (event: KeyboardEvent) => void,
    options: Record<string, unknown>,
  ) => {
    mocks.hotkeyHandler = handler;
    mocks.hotkeyOptions = options;
  },
}));

vi.mock("@tanstack/react-pacer/throttler", () => ({
  useThrottledCallback: (callback: () => void, options: { wait?: number }) => {
    mocks.throttleOptions = options;
    return callback;
  },
}));

vi.mock("@/utils/playPopSound", () => ({
  playRandomPopSound: mocks.playSound,
}));

import GlobalHotkeys from "@/components/GlobalHotkeys";

describe("GlobalHotkeys", () => {
  beforeEach(() => {
    mocks.hotkeyHandler = undefined;
    mocks.hotkeyOptions = undefined;
    mocks.playSound.mockClear();
    mocks.setTheme.mockClear();
    mocks.systemTheme = "light";
    mocks.theme = "light";
    mocks.throttleOptions = undefined;
  });

  it("registers D with input guards and a 50 ms throttle", () => {
    render(<GlobalHotkeys />);

    expect(mocks.hotkeyOptions).toEqual({
      ignoreInputs: true,
      preventDefault: true,
      stopPropagation: true,
    });
    expect(mocks.throttleOptions).toEqual({ wait: 50 });
  });

  it("toggles from the explicit color theme and plays feedback", () => {
    mocks.theme = "dark";
    render(<GlobalHotkeys />);

    mocks.hotkeyHandler?.(
      new KeyboardEvent("keydown", { code: "KeyD", key: "d" }),
    );
    expect(mocks.setTheme).toHaveBeenCalledWith("light");
    expect(mocks.playSound).toHaveBeenCalledOnce();
  });

  it("resolves system theme before toggling", () => {
    mocks.theme = "system";
    mocks.systemTheme = "dark";
    render(<GlobalHotkeys />);

    mocks.hotkeyHandler?.(
      new KeyboardEvent("keydown", { code: "KeyD", key: "d" }),
    );
    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("ignores synthetic Telex events with an empty code", () => {
    render(<GlobalHotkeys />);

    mocks.hotkeyHandler?.(new KeyboardEvent("keydown", { code: "", key: "d" }));
    expect(mocks.setTheme).not.toHaveBeenCalled();
    expect(mocks.playSound).not.toHaveBeenCalled();
  });
});
