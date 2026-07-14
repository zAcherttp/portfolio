"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { playRandomPopSound } from "@/lib/play-pop-sound";

export default function GlobalHotkeys() {
  const { theme, setTheme, systemTheme } = useTheme();
  const activeTheme = theme === "system" ? systemTheme : theme;
  const colorTheme = activeTheme === "dark" ? "dark" : "light";
  const colorThemeRef = useRef(colorTheme);

  useEffect(() => {
    colorThemeRef.current = colorTheme;
  }, [colorTheme]);

  const toggleTheme = useThrottledCallback(
    () => {
      const nextTheme = colorThemeRef.current === "dark" ? "light" : "dark";
      colorThemeRef.current = nextTheme;
      setTheme(nextTheme);
      playRandomPopSound();
    },
    // 50 ms gives a nice performance while still allowing for rapid toggling without feeling sluggish.
    { wait: 50 },
  );

  useHotkey(
    "D",
    (event) => {
      // Windows Telex IME doesn't use browser composition APIs (isComposing is
      // always false). Instead it synthesises raw keydown events when replaying
      // buffered input — these synthetic events have an empty `code` string.
      // Real physical keystrokes always carry a non-empty code (e.g. "KeyD").
      // Bailing on empty code cleanly filters out all Telex phantom events.
      if (!event.code) return;
      toggleTheme();
    },
    {
      ignoreInputs: true,
      preventDefault: true,
      stopPropagation: true,
    },
  );

  return null;
}
