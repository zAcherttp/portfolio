"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";

const buttonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs text-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

function ThemeStatus() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <output className="font-mono text-xs text-muted-foreground">
      Active theme: {mounted ? (resolvedTheme ?? "system") : "mounting"}
    </output>
  );
}

export function ThemeHotkeyDefaultFixture() {
  return (
    <div className="flex flex-col items-center gap-4">
      <ThemeStatus />
      <button className={buttonClassName} type="button">
        Focus here, then press <Kbd className="ml-1.5">D</Kbd>
      </button>
    </div>
  );
}

export function ThemeHotkeyInputFixture() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <ThemeStatus />
      <p className="text-xs text-muted-foreground">
        Typing <Kbd className="mx-1">D</Kbd> here should not toggle the theme.
      </p>
      <input
        className="h-9 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
        placeholder="Type here without toggling the theme"
      />
    </div>
  );
}

export function ThemeHotkeyRapidFixture() {
  return (
    <div className="flex flex-col items-center gap-4">
      <ThemeStatus />
      <button className={buttonClassName} type="button">
        Hold <Kbd className="mx-1.5">D</Kbd> to inspect throttling
      </button>
    </div>
  );
}
