"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export function PackageCommand({ packages }: { packages: readonly string[] }) {
  const [manager, setManager] = useState<PackageManager>("pnpm");
  const [copied, setCopied] = useState(false);
  const commands = useMemo(
    () => ({
      pnpm: `pnpm add ${packages.join(" ")}`,
      npm: `npm install ${packages.join(" ")}`,
      yarn: `yarn add ${packages.join(" ")}`,
      bun: `bun add ${packages.join(" ")}`,
    }),
    [packages],
  );

  async function copy() {
    await navigator.clipboard.writeText(commands[manager]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const Icon = copied ? Check : Copy;
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-4 border-b border-border px-3">
        {(Object.keys(commands) as PackageManager[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setManager(item)}
            className={`border-b py-2 font-mono text-[10px] ${manager === item ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 bg-muted/20 px-4 py-3 font-mono text-xs">
        <code className="overflow-x-auto">{commands[manager]}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy install command"
          title="Copy install command"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Icon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
