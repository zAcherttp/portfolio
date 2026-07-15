"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

export function CodeCollapsible({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative">
      <div
        className={expanded ? "overflow-hidden" : "max-h-80 overflow-hidden"}
      >
        {children}
      </div>
      {!expanded && (
        <div className="absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-linear-to-t from-background to-transparent pb-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="docs-pressable inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Expand <ChevronDown className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
