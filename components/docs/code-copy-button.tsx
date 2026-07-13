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
      className="absolute top-1 right-2 z-10 inline-flex size-7 items-center justify-center bg-[var(--code-background)] text-muted-foreground opacity-100 transition-colors hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover/code:opacity-100"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
