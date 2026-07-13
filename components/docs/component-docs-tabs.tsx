"use client";

import { type ReactNode, useState } from "react";

type Tab = { label: string; content: ReactNode };

export function DocsTabs({
  tabs,
  initialTab = 0,
}: {
  tabs: Tab[];
  initialTab?: number;
}) {
  const [active, setActive] = useState(initialTab);
  return (
    <div className="border-y border-border">
      <div className="flex gap-5 border-b border-border px-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(index)}
            className={`border-b py-2 text-xs ${active === index ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{tabs[active]?.content}</div>
    </div>
  );
}
