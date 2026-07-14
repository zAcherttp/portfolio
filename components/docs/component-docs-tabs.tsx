"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Tab = { label: string; content: ReactNode };

export function DocsTabs({
  tabs,
  initialTab = 0,
  ariaLabel,
  className,
  listClassName,
  panelClassName,
}: {
  tabs: Tab[];
  initialTab?: number;
  ariaLabel: string;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
}) {
  const [active, setActive] = useState(initialTab);
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: number) {
    setActive(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (active + 1) % tabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (active - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "flex max-w-full gap-6 overflow-x-auto overscroll-x-contain",
          listClassName,
        )}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`${id}-panel`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={handleKeyDown}
            className={cn(
              "docs-pressable shrink-0 border-b-2 px-0.5 pb-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active === index
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className={panelClassName}
      >
        {tabs[active]?.content}
      </div>
    </div>
  );
}
