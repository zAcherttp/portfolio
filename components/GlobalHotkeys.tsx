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
    { wait: 100 },
  );

  useHotkey(
    "D",
    () => {
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
