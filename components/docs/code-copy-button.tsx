"use client";

import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";

export function CodeCopyButton({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);
  const copyId = `code-copy-${useId()}`;

  async function copy() {
    const renderedValue = document
      .querySelector<HTMLElement>(`[data-code-copy-id="${copyId}"]`)
      ?.closest("[data-code-frame]")
      ?.querySelector("pre")?.textContent;
    await navigator.clipboard.writeText(value ?? renderedValue ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      data-code-copy-id={copyId}
      onClick={copy}
      aria-label="Copy code"
      title="Copy code"
      className="docs-pressable absolute top-2 right-2 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-3.5" />
      <span className="sr-only" aria-live="polite">
        {copied ? "Code copied" : ""}
      </span>
    </button>
  );
}
