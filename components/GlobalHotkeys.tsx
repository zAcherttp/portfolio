"use client";

import { type RegisterableHotkey, useHotkey } from "@tanstack/react-hotkeys";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import { hasPhysicalKeyCode } from "@/lib/keyboard";
import { playRandomPopSound } from "@/lib/play-pop-sound";

export type GlobalHotkeysProps = {
  /** Key that toggles between the resolved light and dark themes. */
  shortcut?: RegisterableHotkey;
  /** Minimum delay between accepted shortcut presses, in milliseconds. */
  throttleMs?: number;
  /** Prevents the shortcut from firing while an editable control is focused. */
  ignoreInputs?: boolean;
  /**
   * While the shortcut is held down and repeating, switch themes without CSS
   * transitions, so the page doesn't restart every colour transition on each
   * toggle. A single press still transitions as usual.
   */
  instantWhileHeld?: boolean;
};

const PAUSE_CSS = "*,*::before,*::after{transition:none!important}";

/**
 * Turns CSS transitions off until `resume`. Resuming forces a style pass
 * first, so the last theme lands before transitions return and nothing
 * fades on release.
 */
function pauseTransitions() {
  const style = document.createElement("style");
  style.textContent = PAUSE_CSS;
  document.head.appendChild(style);
  return function resume() {
    window.getComputedStyle(document.body).getPropertyValue("color");
    style.remove();
  };
}

export default function GlobalHotkeys({
  shortcut = "D",
  throttleMs = 50,
  ignoreInputs = true,
  instantWhileHeld = true,
}: GlobalHotkeysProps = {}) {
  const { theme, setTheme, systemTheme } = useTheme();
  const activeTheme = theme === "system" ? systemTheme : theme;
  const colorTheme = activeTheme === "dark" ? "dark" : "light";
  const colorThemeRef = useRef(colorTheme);

  useEffect(() => {
    colorThemeRef.current = colorTheme;
  }, [colorTheme]);

  // Held down, the key repeats: pause transitions until it comes back up
  // (or the window loses focus, or this unmounts).
  const holdRef = useRef<{ code: string; end: () => void } | null>(null);
  const hold = useCallback((code: string) => {
    if (holdRef.current) return;
    const resume = pauseTransitions();
    const up = (event: KeyboardEvent) => {
      if (event.code === code) end();
    };
    const end = () => {
      holdRef.current = null;
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", end);
      resume();
    };
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", end);
    holdRef.current = { code, end };
  }, []);
  useEffect(() => () => holdRef.current?.end(), []);

  const toggleTheme = useThrottledCallback(
    () => {
      const nextTheme = colorThemeRef.current === "dark" ? "light" : "dark";
      colorThemeRef.current = nextTheme;
      setTheme(nextTheme);
      playRandomPopSound();
    },
    // 50 ms gives a nice performance while still allowing for rapid toggling without feeling sluggish.
    { trailing: false, wait: throttleMs },
  );

  useHotkey(
    shortcut,
    (event) => {
      if (!hasPhysicalKeyCode(event.code)) return;
      if (instantWhileHeld && event.repeat) hold(event.code);
      toggleTheme();
    },
    {
      ignoreInputs,
      preventDefault: true,
      stopPropagation: true,
    },
  );

  return null;
}
