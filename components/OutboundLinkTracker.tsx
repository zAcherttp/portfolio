"use client";

import { track } from "@vercel/analytics";
import { useEffect } from "react";
import {
  getOutboundPathGroup,
  normalizeOutboundContext,
} from "@/lib/attribution";

export function OutboundLinkTracker() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (
        !["http:", "https:"].includes(destination.protocol) ||
        destination.origin === window.location.origin
      ) {
        return;
      }

      track("Outbound Link", {
        context: normalizeOutboundContext(anchor.dataset.outboundContext),
        destinationHost: destination.hostname,
        destinationPath: getOutboundPathGroup(destination.pathname),
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
