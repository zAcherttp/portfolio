"use client";

import { Check, ChevronDown, Copy, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatGPT as ChatGPTIcon,
  Claude as ClaudeIcon,
  GitHub as GitHubIcon,
  Markdown as MarkdownIcon,
  V0 as V0Icon,
} from "@/components/ui/icons";
import { copyText } from "@/lib/copy-text";
import { DocActionMenu, DocActionMenuLink } from "./doc-action-menu";

type CopyState = "idle" | "loading" | "copied" | "error";

const markdownCache = new Map<string, string>();

export function LLMCopyButtonWithViewOptions({
  markdownUrl,
  githubUrl,
}: {
  markdownUrl: string;
  githubUrl: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const [origin, setOrigin] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const fullMarkdownUrl = origin
    ? new URL(markdownUrl, origin).toString()
    : markdownUrl;
  const prompt = `I'm looking at this component documentation: ${fullMarkdownUrl}\n\nHelp me understand how to use it in a React and TypeScript project, including practical examples and common pitfalls.`;
  const viewOptions = useMemo(
    () => [
      {
        label: "View as Markdown",
        href: fullMarkdownUrl,
        icon: MarkdownIcon,
      },
      { label: "Open in GitHub", href: githubUrl, icon: GitHubIcon },
      {
        label: "Open in ChatGPT",
        href: `https://chatgpt.com/?${new URLSearchParams({ hints: "search", q: prompt })}`,
        icon: ChatGPTIcon,
      },
      {
        label: "Open in Claude",
        href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
        icon: ClaudeIcon,
      },
      {
        label: "Open in v0",
        href: `https://v0.app/?${new URLSearchParams({ q: prompt })}`,
        icon: V0Icon,
      },
    ],
    [fullMarkdownUrl, githubUrl, prompt],
  );

  async function handleCopy() {
    if (state === "loading") return;
    setState("loading");

    try {
      let markdown = markdownCache.get(markdownUrl);
      if (!markdown) {
        const response = await fetch(markdownUrl);
        if (!response.ok) throw new Error("Unable to load page Markdown");
        markdown = await response.text();
        markdownCache.set(markdownUrl, markdown);
      }

      await copyText(markdown);
      setState("copied");
    } catch {
      setState("error");
    }

    resetTimer.current = setTimeout(() => setState("idle"), 1600);
  }

  const Icon =
    state === "loading"
      ? LoaderCircle
      : state === "copied"
        ? Check
        : state === "error"
          ? X
          : Copy;
  return (
    <div className="inline-flex h-8 items-center rounded-lg bg-muted/60 p-0.5 ring-1 ring-border/70">
      <button
        aria-busy={state === "loading"}
        aria-label="Copy page"
        className="docs-pressable inline-flex h-7 items-center gap-1.5 rounded-l-md rounded-r-none px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-background/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        disabled={state === "loading"}
        onClick={handleCopy}
        type="button"
      >
        <Icon
          aria-hidden="true"
          className={`size-3.5 ${state === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`}
        />
        <span className="max-[520px]:hidden">Copy page</span>
        <span aria-live="polite" className="sr-only">
          {state === "copied"
            ? "Page Markdown copied"
            : state === "error"
              ? "Page Markdown could not be copied"
              : ""}
        </span>
      </button>
      <DocActionMenu
        icon={<ChevronDown aria-hidden="true" className="size-3.5" />}
        label="View options"
        triggerClassName="size-7 rounded-l-none border-l border-border/70 hover:bg-background/70 data-popup-open:bg-background/70"
      >
        {viewOptions.map(({ label: optionLabel, href, icon: OptionIcon }) => (
          <DocActionMenuLink href={href} key={optionLabel}>
            <OptionIcon aria-hidden="true" className="size-4" />
            {optionLabel}
          </DocActionMenuLink>
        ))}
      </DocActionMenu>
    </div>
  );
}
