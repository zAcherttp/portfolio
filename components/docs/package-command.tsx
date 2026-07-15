"use client";

import { Check, Copy, SquareTerminal } from "lucide-react";
import { useMemo, useState } from "react";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export function PackageCommand({ slug }: { slug: string }) {
  const [manager, setManager] = useState<PackageManager>("pnpm");
  const [copied, setCopied] = useState(false);
  const registryItem = `@zacherttp/${slug}`;
  const commands = useMemo(
    () => ({
      pnpm: `pnpm dlx shadcn@latest add ${registryItem}`,
      npm: `npx shadcn@latest add ${registryItem}`,
      yarn: `yarn dlx shadcn@latest add ${registryItem}`,
      bun: `bunx --bun shadcn@latest add ${registryItem}`,
    }),
    [registryItem],
  );

  async function copy() {
    await navigator.clipboard.writeText(commands[manager]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const Icon = copied ? Check : Copy;
  return (
    <div className="overflow-hidden rounded-xl bg-muted/55">
      <div className="flex min-h-11 items-center gap-2 border-b border-border/70 px-3">
        <SquareTerminal
          aria-hidden="true"
          className="mr-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <fieldset className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5">
          <legend className="sr-only">Package manager</legend>
          {(Object.keys(commands) as PackageManager[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={manager === item}
              onClick={() => setManager(item)}
              className={`docs-pressable shrink-0 rounded-md px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${manager === item ? "bg-background text-foreground shadow-xs ring-1 ring-inset ring-border/70" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy install command"
          title="Copy install command"
          className="docs-pressable inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="size-3.5" />
          <span className="sr-only" aria-live="polite">
            {copied ? "Install command copied" : ""}
          </span>
        </button>
      </div>
      <div className="overflow-x-auto overscroll-x-contain px-4 py-4 font-mono text-xs leading-5">
        <code className="whitespace-nowrap">{commands[manager]}</code>
      </div>
    </div>
  );
}
