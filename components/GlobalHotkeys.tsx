"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

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
    },
    // 300 ms gives Telex IME (d → dd → đ) time to settle before toggling
    { wait: 300 },
  );

  useHotkey(
    "D",
    (event) => {
      // Ignore intermediate IME composition keystrokes (e.g. Telex Vietnamese
      // input: each "đ" requires two "d" presses; isComposing is true during
      // the pending phase so we never fire on the in-progress sequence).
      if (event.isComposing) return;
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
