"use client";

import { Check, Ellipsis, Link as LinkIcon, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LinkedIn as LinkedInIcon } from "@/components/ui/icons";
import { copyText } from "@/lib/copy-text";
import {
  DocActionMenu,
  DocActionMenuItem,
  DocActionMenuLink,
} from "./doc-action-menu";

export function DocShareMenu({ title, url }: { title: string; url: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const absoluteUrl = origin ? new URL(url, origin).toString() : url;
  const encodedUrl = encodeURIComponent(absoluteUrl);

  async function handleCopy() {
    await copyText(absoluteUrl);
    setCopied(true);
    resetTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <DocActionMenu
      icon={<Share2 aria-hidden="true" className="size-3.5" />}
      label="Share component documentation"
    >
      <DocActionMenuItem closeOnClick={false} onClick={handleCopy}>
        {copied ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <LinkIcon aria-hidden="true" className="size-4" />
        )}
        {copied ? "Link copied" : "Copy link"}
      </DocActionMenuItem>
      <DocActionMenuLink
        href={`https://x.com/intent/tweet?${new URLSearchParams({ text: title, url: absoluteUrl })}`}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-4 items-center justify-center text-xs font-semibold"
        >
          X
        </span>
        Share on X
      </DocActionMenuLink>
      <DocActionMenuLink
        href={`https://www.linkedin.com/sharing/share-offsite?url=${encodedUrl}`}
      >
        <LinkedInIcon aria-hidden="true" className="size-4" />
        Share on LinkedIn
      </DocActionMenuLink>
      {canShare && (
        <DocActionMenuItem
          closeOnClick={false}
          onClick={() => {
            navigator.share({ title, url: absoluteUrl }).catch(() => {});
          }}
        >
          <Ellipsis aria-hidden="true" className="size-4" />
          Other app
        </DocActionMenuItem>
      )}
    </DocActionMenu>
  );
}
